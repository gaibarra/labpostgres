const request = require('supertest');
const app = require('../index');
const { pool } = require('../db');

// Util to create an admin and get token
async function loginAsAdmin() {
  const ts = Date.now();
  const email = `ref_admin_${ts}@example.com`;
  await request(app).post('/api/auth/register').send({ email, password: 'Secret123', role: 'Administrador' });
  const res = await request(app).post('/api/auth/login').send({ email, password: 'Secret123' });
  return res.body.token;
}

describe('Referrers CRUD', () => {
  let token;
  beforeAll(async () => {
    token = await loginAsAdmin();
  });

  test('create/list/get/update/delete cycle', async () => {
    // create
    const createRes = await request(app)
      .post('/api/referrers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Dr. Test',
        entity_type: 'Medico',
        specialty: 'General',
        email: 'dr.test@example.com',
        phone_number: '+52 55 1234 5678',
        address: 'Calle 1',
      });
    expect(createRes.status).toBe(201);
    const created = createRes.body;
    expect(created.email).toBe('dr.test@example.com');
    expect(created.phone_number).toBeDefined();

    // list with search by email
    const listRes = await request(app)
      .get('/api/referrers?limit=5&search=dr.test@example.com')
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.some(r=>r.id===created.id)).toBe(true);

    // get by id
    const getRes = await request(app)
      .get(`/api/referrers/${created.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(created.id);

    // update
    const putRes = await request(app)
      .put(`/api/referrers/${created.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ phone_number: '+525512345679' });
    expect(putRes.status).toBe(200);
    expect(putRes.body.phone_number).toMatch(/\+?\d+/);

    // delete
    const delRes = await request(app)
      .delete(`/api/referrers/${created.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(delRes.status).toBe(204);
  });

  test("cannot delete 'Particular'", async () => {
    const listRes = await request(app)
      .get('/api/referrers?limit=50')
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    const p = Array.isArray(listRes.body.data) ? listRes.body.data.find(r => (r.name||'').toLowerCase() === 'particular') : null;
    if (!p) return; // si no existe en el entorno de pruebas, omitir
    const delRes = await request(app)
      .delete(`/api/referrers/${p.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect([400,409]).toContain(delRes.status);
  });
});
