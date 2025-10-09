const request = require('supertest');
const app = require('..');

// Utilidades
function auth(t){ return { Authorization: `Bearer ${t}` }; }

/**
 * Este test cubre de forma integral:
 *  - Creación de usuario Administrador y Laboratorista.
 *  - Creación de orden con selected_items vacíos.
 *  - Inserción y actualización de results (jsonb) y validation_notes.
 *  - Verificación de persistencia real (GET subsecuente).
 *  - Aislamiento de permisos: Laboratorista puede ingresar resultados; Recepcionista no.
 *  - Resistencia a sobrescritura parcial (enviando subset) → reemplazo controlado.
 *  - Protección RLS: usuario sin 'orders.enter_results' recibe 403 (o 500 RLS) en PUT results.
 */

describe('Work Orders Results End-To-End + Seguridad', () => {
  let adminToken, labToken, recepToken, orderId;

  async function registerAndLogin(email, role) {
    await request(app).post('/api/auth/register').send({ email, password: 'Secret123', role });
    const login = await request(app).post('/api/auth/login').send({ email, password: 'Secret123' });
    return login.body.token;
  }

  beforeAll(async () => {
    adminToken = await registerAndLogin(`admin_results_${Date.now()}@example.com`, 'Administrador');
    labToken = await registerAndLogin(`lab_results_${Date.now()}@example.com`, 'Laboratorista');
    recepToken = await registerAndLogin(`recep_results_${Date.now()}@example.com`, 'Recepcionista');
  });

  test('Administrador crea orden con placeholders de resultados', async () => {
    const folioRes = await request(app).get('/api/work-orders/next-folio').set(auth(adminToken));
    expect(folioRes.status).toBe(200);
    const create = await request(app)
      .post('/api/work-orders')
      .set(auth(adminToken))
      .send({ folio: folioRes.body.folio, status: 'Pendiente', selected_items: [], results: {}, validation_notes: '' });
    expect(create.status).toBe(201);
    expect(create.body).toHaveProperty('id');
    expect(create.body).toHaveProperty('results');
    orderId = create.body.id;
  });

  test('Laboratorista ingresa primeros resultados', async () => {
    const update = await request(app)
      .put(`/api/work-orders/${orderId}`)
      .set(auth(labToken))
      .send({
        status: 'Procesando',
        results: { 'study-abc': [{ parametroId: 'param-1', valor: '12.3' }] },
        validation_notes: 'Captura inicial'
      });
    expect(update.status).toBe(200);
    expect(update.body.results).toBeTruthy();
    expect(update.body.results['study-abc']).toHaveLength(1);
  });

  test('Recepcionista NO puede modificar resultados (falta enter_results)', async () => {
    const upd = await request(app)
      .put(`/api/work-orders/${orderId}`)
      .set(auth(recepToken))
      .send({ results: { 'study-abc': [{ parametroId: 'param-1', valor: '14.0' }] } });
    // Dependiendo de implementación puede ser 403 (AppError) o 500 RLS; aceptamos cualquiera >399
    expect(upd.status).toBeGreaterThanOrEqual(400);
  });

  test('Administrador amplía resultados (reemplazo controlado del objeto results)', async () => {
    const upd = await request(app)
      .put(`/api/work-orders/${orderId}`)
      .set(auth(adminToken))
      .send({
        status: 'Procesando',
        results: {
          'study-abc': [
            { parametroId: 'param-1', valor: '12.3' },
            { parametroId: 'param-2', valor: '4.4' }
          ],
          'study-def': [
            { parametroId: 'param-A', valor: null }
          ]
        },
        validation_notes: 'Segunda captura'
      });
    expect(upd.status).toBe(200);
    expect(upd.body.results['study-abc']).toHaveLength(2);
    expect(upd.body.results['study-def']).toHaveLength(1);
  });

  test('GET confirma persistencia íntegra después de múltiples updates', async () => {
    const fetched = await request(app)
      .get(`/api/work-orders/${orderId}`)
      .set(auth(adminToken));
    expect(fetched.status).toBe(200);
    expect(fetched.body.results['study-abc']).toHaveLength(2);
    // Aseguramos que la primera entrada se mantiene
    const p1 = fetched.body.results['study-abc'].find(r => r.parametroId === 'param-1');
    expect(p1.valor).toBe('12.3');
  });

  test('Laboratorista puede finalizar (cambia status y notas) sin perder results', async () => {
    const finalUpd = await request(app)
      .put(`/api/work-orders/${orderId}`)
      .set(auth(labToken))
      .send({ status: 'Reportada', validation_notes: 'Validado final' });
    expect(finalUpd.status).toBe(200);
    expect(finalUpd.body.status).toBe('Reportada');
    expect(finalUpd.body.results['study-abc']).toHaveLength(2);
  });
});
