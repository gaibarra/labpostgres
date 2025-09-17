const request = require('supertest');
const app = require('..');

// Este test verifica que se puedan crear órdenes después de asegurar columnas extendidas.
// Requiere que el seed inicial haya creado usuarios admin y guest con contraseñas conocidas.

let adminEmail;

function authHeader(token){ return { Authorization: `Bearer ${token}` }; }

describe('Work Orders creation', () => {
  let adminToken;
  beforeAll(async () => {
    adminEmail = `wo_admin_${Date.now()}@example.com`;
    await request(app).post('/api/auth/register').send({ email: adminEmail, password: 'Secret123', role: 'Administrador' });
    const login = await request(app).post('/api/auth/login').send({ email: adminEmail, password: 'Secret123' });
    adminToken = login.body.token;
  });

  test('crear orden mínima (campos opcionales null) responde 201', async () => {
    const folioRes = await request(app).get('/api/work-orders/next-folio').set(authHeader(adminToken));
    const folio = folioRes.body.folio || null;

    const payload = {
      folio,
      status: 'draft',
      selected_items: [],
      subtotal: 0,
      descuento: 0,
      anticipo: 0,
      total_price: 0,
      notas: 'Test auto',
      results: null,
      validation_notes: null
    };

    const res = await request(app)
      .post('/api/work-orders')
      .set(authHeader(adminToken))
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('folio');
    expect(res.body).toHaveProperty('subtotal');
    expect(res.body).toHaveProperty('descuento');
    expect(res.body).toHaveProperty('anticipo');
    expect(res.body).toHaveProperty('notas');
    expect(res.body).toHaveProperty('results');
    expect(res.body).toHaveProperty('validation_notes');
  });
});
