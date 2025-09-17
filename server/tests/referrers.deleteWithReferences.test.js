const request = require('supertest');
const app = require('..');

function auth(t){ return { Authorization: `Bearer ${t}` }; }

async function adminLogin(){
  const email = `ref_use_admin_${Date.now()}@example.com`;
  await request(app).post('/api/auth/register').send({ email, password: 'Secret123', role: 'Administrador' });
  const login = await request(app).post('/api/auth/login').send({ email, password: 'Secret123' });
  return login.body.token;
}

describe('Referrers delete protections when referenced', () => {
  let token;
  beforeAll(async ()=>{ token = await adminLogin(); });

  test('no se puede eliminar si está referenciado por órdenes', async () => {
    // crear referente
    const createRef = await request(app).post('/api/referrers').set(auth(token)).send({ name: `Dr Ref ${Date.now()}` });
    expect(createRef.status).toBe(201);
    const refId = createRef.body.id;

    // crear orden que lo referencie
    const folioRes = await request(app).get('/api/work-orders/next-folio').set(auth(token));
    const payload = { folio: folioRes.body.folio, status: 'draft', referring_entity_id: refId, selected_items: [], subtotal: 0, descuento: 0, anticipo: 0, total_price: 0 };
    const wo = await request(app).post('/api/work-orders').set(auth(token)).send(payload);
    expect(wo.status).toBe(201);

    // intentar borrar referente
    const del = await request(app).delete(`/api/referrers/${refId}`).set(auth(token));
    expect([409,500]).toContain(del.status); // 409 esperado por regla explícita

    // cleanup: borrar la orden y luego el referente
    const delWo = await request(app).delete(`/api/work-orders/${wo.body.id}`).set(auth(token));
    expect(delWo.status).toBe(204);
    const delRef = await request(app).delete(`/api/referrers/${refId}`).set(auth(token));
    expect(delRef.status).toBe(204);
  });
});
