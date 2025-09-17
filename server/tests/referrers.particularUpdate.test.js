const request = require('supertest');
const app = require('..');

function auth(t){ return { Authorization: `Bearer ${t}` }; }

async function adminLogin(){
  const email = `ref_part_admin_${Date.now()}@example.com`;
  await request(app).post('/api/auth/register').send({ email, password: 'Secret123', role: 'Administrador' });
  const login = await request(app).post('/api/auth/login').send({ email, password: 'Secret123' });
  return login.body.token;
}

describe('Referrers Particular update rules', () => {
  let token;
  beforeAll(async ()=>{ token = await adminLogin(); });

  test("solo permite cambiar listaprecios en 'Particular'", async () => {
    const list = await request(app).get('/api/referrers?limit=50').set(auth(token));
    expect(list.status).toBe(200);
    const p = list.body.data && list.body.data.find(r => (r.name||'').toLowerCase() === 'particular');
    if (!p) return; // omitir si no existe

    // intentar cambiar un campo protegido
    const forbid = await request(app).put(`/api/referrers/${p.id}`).set(auth(token)).send({ name: 'Particular X' });
    expect([400,403]).toContain(forbid.status);

    // cambiar listaprecios
    const ok = await request(app).put(`/api/referrers/${p.id}`).set(auth(token)).send({ listaprecios: { default: true } });
    expect(ok.status).toBe(200);
    expect(ok.body.listaprecios).toBeTruthy();
  });
});
