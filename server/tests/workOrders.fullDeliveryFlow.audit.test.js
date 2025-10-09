const request = require('supertest');
const app = require('..');
const { pool } = require('../db');

function auth(t){ return { Authorization: `Bearer ${t}` }; }

async function countAudit(action){
  const { rows } = await pool.query('SELECT COUNT(*)::int AS c FROM system_audit_logs WHERE action=$1',[action]);
  return rows[0].c;
}

describe('Flujo entrega + auditoría + results_finalized', () => {
  let adminToken, labToken, recepToken, orderId;
  const unique = Date.now();

  async function reg(email, role){
    await request(app).post('/api/auth/register').send({ email, password: 'Secret123', role });
    const login = await request(app).post('/api/auth/login').send({ email, password: 'Secret123' });
    return login.body.token;
  }

  beforeAll(async () => {
    adminToken = await reg(`admin_audit_${unique}@ex.com`, 'Administrador');
    labToken = await reg(`lab_audit_${unique}@ex.com`, 'Laboratorista');
    recepToken = await reg(`recep_audit_${unique}@ex.com`, 'Recepcionista');
  });

  test('Pipeline completo con auditoría', async () => {
    const auditBeforeCreate = await countAudit('create');
    const folio = (await request(app).get('/api/work-orders/next-folio').set(auth(adminToken))).body.folio;
    const create = await request(app).post('/api/work-orders').set(auth(adminToken)).send({ folio, status: 'Pendiente', selected_items: [] });
    expect(create.status).toBe(201);
    orderId = create.body.id;
    const auditAfterCreate = await countAudit('create');
    expect(auditAfterCreate).toBe(auditBeforeCreate + 1);

    // Lab ingresa resultados
    const upd1 = await request(app).put(`/api/work-orders/${orderId}`).set(auth(labToken)).send({ status: 'Procesando', results: { A: [{ parametroId: 'X', valor: '1.1'}] } });
    expect(upd1.status).toBe(200);

    // Admin finaliza resultados (results_finalized true) y valida
    const upd2 = await request(app).put(`/api/work-orders/${orderId}`).set(auth(adminToken)).send({ status: 'Reportada', results_finalized: true, validation_notes: 'OK' });
    expect(upd2.status).toBe(200);
    expect(upd2.body.results_finalized).toBe(true);

    // Recepcionista entrega
    const send = await request(app).post(`/api/work-orders/${orderId}/send-report`).set(auth(recepToken)).send();
    expect(send.status).toBe(200);
    expect(send.body.status).toBe('Entregada');
    if (Object.prototype.hasOwnProperty.call(send.body,'results_finalized')) {
      expect(send.body.results_finalized).toBe(true);
    }
    expect(send.body._delivery).toBeTruthy();
    expect(send.body._delivery.finalized).toBe(true);

    // Auditoría debe tener registro de update y update (dos) y envío (update)
    const auditUpdates = await countAudit('update');
    // Debemos tener al menos 2 (PUT y send-report). No hacemos aserción exacta porque otras pruebas podrían interferir.
    expect(auditUpdates).toBeGreaterThanOrEqual(2);
  });
});
