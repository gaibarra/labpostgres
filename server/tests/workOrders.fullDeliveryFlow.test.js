const request = require('supertest');
const app = require('..');

function auth(t){ return { Authorization: `Bearer ${t}` }; }

/**
 * Flujo definitivo de resultados hasta entrega:
 * 1. Admin registra usuarios (Admin, Lab, Recepcionista)
 * 2. Admin crea orden
 * 3. Lab ingresa resultados parciales
 * 4. Admin valida/amplía y marca status Reportada
 * 5. Recepcionista intenta enviar (debe permitir porque tiene send_report)
 * 6. Flujo alterno: si no hay results, send-report responde 400
 */

describe('Flujo completo entrega de resultados', () => {
  let adminToken, labToken, recepToken, orderId;

  async function reg(email, role){
    await request(app).post('/api/auth/register').send({ email, password: 'Secret123', role });
    const login = await request(app).post('/api/auth/login').send({ email, password: 'Secret123' });
    return login.body.token;
  }

  beforeAll(async () => {
    adminToken = await reg(`admin_delivery_${Date.now()}@ex.com`, 'Administrador');
    labToken = await reg(`lab_delivery_${Date.now()}@ex.com`, 'Laboratorista');
    recepToken = await reg(`recep_delivery_${Date.now()}@ex.com`, 'Recepcionista');
  });

  test('1) Admin crea orden', async () => {
    const folio = (await request(app).get('/api/work-orders/next-folio').set(auth(adminToken))).body.folio;
    const create = await request(app).post('/api/work-orders').set(auth(adminToken)).send({ folio, status: 'Pendiente', selected_items: [] });
    expect(create.status).toBe(201);
    orderId = create.body.id;
  });

  test('2) Lab ingresa primeros resultados', async () => {
    const upd = await request(app).put(`/api/work-orders/${orderId}`).set(auth(labToken)).send({ status: 'Procesando', results: { S1: [{ parametroId: 'P1', valor: '10.0' }] }, validation_notes: 'Inicial' });
    expect(upd.status).toBe(200);
    expect(upd.body.results.S1).toHaveLength(1);
  });

  test('3) Admin amplía y valida (status Reportada)', async () => {
    const upd = await request(app).put(`/api/work-orders/${orderId}`).set(auth(adminToken)).send({ status: 'Reportada', results: { S1: [{ parametroId: 'P1', valor: '10.0' }, { parametroId: 'P2', valor: '5.5' }] }, validation_notes: 'Validado' });
    expect(upd.status).toBe(200);
    expect(upd.body.status).toBe('Reportada');
    expect(upd.body.results.S1).toHaveLength(2);
  });

  test('4) Recepcionista entrega (send-report) y status pasa a Entregada', async () => {
    const send = await request(app).post(`/api/work-orders/${orderId}/send-report`).set(auth(recepToken)).send();
    expect(send.status).toBe(200);
    expect(send.body.status).toBe('Entregada');
    // results deben mantenerse
    expect(send.body.results.S1).toHaveLength(2);
  });

  test('5) Idempotencia: segundo send-report no altera resultados', async () => {
    const again = await request(app).post(`/api/work-orders/${orderId}/send-report`).set(auth(recepToken)).send();
    expect(again.status).toBe(200);
    expect(again.body.status).toBe('Entregada');
    expect(again.body.results.S1).toHaveLength(2);
  });

  test('6) Caso negativo: intento de send-report sin resultados', async () => {
    const folio = (await request(app).get('/api/work-orders/next-folio').set(auth(adminToken))).body.folio;
    const emptyOrder = await request(app).post('/api/work-orders').set(auth(adminToken)).send({ folio, status: 'Pendiente', selected_items: [] });
    const send = await request(app).post(`/api/work-orders/${emptyOrder.body.id}/send-report`).set(auth(recepToken)).send();
    expect(send.status).toBe(400);
  });
});
