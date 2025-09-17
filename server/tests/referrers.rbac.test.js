const request = require('supertest');
const app = require('..');

function auth(t){ return { Authorization: `Bearer ${t}` }; }

describe('Referrers RBAC', () => {
  let adminToken, guestToken;
  beforeAll(async () => {
    const aEmail = `ref_rbac_admin_${Date.now()}@example.com`;
    await request(app).post('/api/auth/register').send({ email: aEmail, password: 'Secret123', role: 'Administrador' });
    adminToken = (await request(app).post('/api/auth/login').send({ email: aEmail, password: 'Secret123' })).body.token;
    const gEmail = `ref_rbac_guest_${Date.now()}@example.com`;
    await request(app).post('/api/auth/register').send({ email: gEmail, password: 'Secret123', role: 'Invitado' });
    guestToken = (await request(app).post('/api/auth/login').send({ email: gEmail, password: 'Secret123' })).body.token;
  });

  test('guest cannot create/update/delete referrer', async () => {
    // create
    const create = await request(app).post('/api/referrers').set(auth(guestToken)).send({ name: 'Nope Guest' });
    expect([401,403]).toContain(create.status);

    // admin creates for next steps
    const created = await request(app).post('/api/referrers').set(auth(adminToken)).send({ name: 'RBAC Doctor' });
    expect(created.status).toBe(201);

    const id = created.body.id;
    // update
    const upd = await request(app).put(`/api/referrers/${id}`).set(auth(guestToken)).send({ specialty: 'X' });
    expect([401,403]).toContain(upd.status);

    // delete
    const del = await request(app).delete(`/api/referrers/${id}`).set(auth(guestToken));
    expect([401,403]).toContain(del.status);

    // cleanup by admin
    const delAdmin = await request(app).delete(`/api/referrers/${id}`).set(auth(adminToken));
    expect(delAdmin.status).toBe(204);
  });
});
