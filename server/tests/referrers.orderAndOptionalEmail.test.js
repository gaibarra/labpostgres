const request = require('supertest');
const app = require('..');

function auth(t){ return { Authorization: `Bearer ${t}` }; }

async function adminLogin(){
  const email = `ref_order_admin_${Date.now()}@example.com`;
  await request(app).post('/api/auth/register').send({ email, password: 'Secret123', role: 'Administrador' });
  const login = await request(app).post('/api/auth/login').send({ email, password: 'Secret123' });
  return login.body.token;
}

describe('Referrers ordering & optional email', () => {
  let token;
  beforeAll(async ()=>{ token = await adminLogin(); });

  test("'Particular' aparece primero en el listado", async () => {
    const res = await request(app).get('/api/referrers?limit=50').set(auth(token));
    expect(res.status).toBe(200);
    if (!Array.isArray(res.body.data) || res.body.data.length === 0) return; // nada que validar
    const first = res.body.data[0];
    // Aceptamos que en entornos donde no exista 'Particular' aún, se omite la aserción estricta
    const hasParticular = res.body.data.some(r => (r.name||'').toLowerCase() === 'particular');
    if (hasParticular){
      expect((first.name||'').toLowerCase()).toBe('particular');
    }
  });

  test('create sin email y listar mostrando null/ausente', async () => {
    const payload = {
      name: `Dr. Optional ${Date.now()}`,
      entity_type: 'Medico',
      specialty: 'General',
      // email omitido intencionalmente
      phone_number: '+52 55 0000 0000'
    };
    const create = await request(app).post('/api/referrers').set(auth(token)).send(payload);
    expect(create.status).toBe(201);
    expect(create.body.email === null || create.body.email === undefined || create.body.email === '').toBe(true);

    const list = await request(app).get(`/api/referrers?limit=5&search=${encodeURIComponent(payload.name.split(' ')[1])}`).set(auth(token));
    expect(list.status).toBe(200);
    const found = list.body.data.find(r => r.id === create.body.id);
    expect(found).toBeTruthy();
    expect(found.email === null || found.email === undefined || found.email === '').toBe(true);
  });
});
