const request = require('supertest');
const app = require('..');

async function adminLogin(){
  const email = `ref_opt_email_${Date.now()}@example.com`;
  await request(app).post('/api/auth/register').send({ email, password: 'Secret123', role: 'Administrador' });
  const login = await request(app).post('/api/auth/login').send({ email, password: 'Secret123' });
  return login.body.token;
}

function auth(t){ return { Authorization: `Bearer ${t}` }; }

describe('Referrers email opcional', () => {
  let token;
  beforeAll(async ()=>{ token = await adminLogin(); });

  test('crea referrer con email vacío', async () => {
    const unique = Date.now();
    const res = await request(app).post('/api/referrers').set(auth(token)).send({
      name: 'Dr Sin Email ' + unique,
      entity_type: 'Medico',
      specialty: 'General',
      email: '', // vacío intencional
      phone_number: '+52 55 1111 2222'
    });
    expect(res.status).toBe(201);
    expect(res.body.email === null || res.body.email === undefined).toBe(true);
  });

  test('actualiza referrer limpiando email', async () => {
    const unique = Date.now();
    // crear con email válido primero
    const create = await request(app).post('/api/referrers').set(auth(token)).send({
      name: 'Dr Con Email ' + unique,
      entity_type: 'Medico',
      email: 'doctor@example.com'
    });
    expect(create.status).toBe(201);
    expect(create.body.email).toBe('doctor@example.com');

    const id = create.body.id;
    // limpiar
    const upd = await request(app).put(`/api/referrers/${id}`).set(auth(token)).send({ email: '' });
    expect(upd.status).toBe(200);
    expect(upd.body.email === null || upd.body.email === undefined).toBe(true);
  });
});
