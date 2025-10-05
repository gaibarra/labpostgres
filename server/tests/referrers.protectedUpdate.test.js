const request = require('supertest');
const app = require('../index');

async function adminToken(){
  const email = `prot_part_${Date.now()}@example.com`;
  await request(app).post('/api/auth/register').send({ email, password: 'Secret123', role: 'Administrador' });
  const login = await request(app).post('/api/auth/login').send({ email, password: 'Secret123' });
  return login.body.token;
}

describe('Referrers Particular protection (only listaprecios mutable)', () => {
  let token; beforeAll(async ()=>{ token = await adminToken(); });

  test("changing name of 'Particular' is blocked but listaprecios allowed", async () => {
    const list = await request(app).get('/api/referrers?limit=100').set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    const p = list.body?.data?.find(r => (r.name||'').toLowerCase()==='particular');
    if(!p) return; // omit if not seeded

    // attempt forbidden change
    const forbid = await request(app)
      .put(`/api/referrers/${p.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Particular X' });
    expect([400,403,409]).toContain(forbid.status);

    // allowed change (listaprecios)
    const ok = await request(app)
      .put(`/api/referrers/${p.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ listaprecios: { studies: [], packages: [] } });
    expect(ok.status).toBe(200);
    expect(ok.body.listaprecios).toBeTruthy();
  });
});
