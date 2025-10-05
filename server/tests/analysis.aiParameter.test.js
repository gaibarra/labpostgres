import request from 'supertest';
import app from '../index.js';
import { randomUUID } from 'node:crypto';
import { createAdminAndGetToken } from './test-helpers.js';

// Este test valida el endpoint IA de parámetro y un flujo mínimo de inserción simulado.
// No persiste realmente el parámetro (el endpoint sólo genera mock), pero asegura el contrato.

describe('AI Parameter Generation Endpoint', () => {
  let token;
  beforeAll(async () => {
    token = await createAdminAndGetToken();
  });

  test('POST /api/analysis/ai/generate-parameter devuelve estructura esperada', async () => {
    const res = await request(app)
      .post('/api/analysis/ai/generate-parameter')
      .set('Authorization', `Bearer ${token}`)
      .send({ studyId: randomUUID(), studyName: 'Perfil Lipídico', prompt: 'colesterol fracción avanzada' })
      .expect(200);

    expect(res.body).toBeDefined();
    expect(res.body.parameter).toBeDefined();
    const p = res.body.parameter;
    expect(p).toHaveProperty('name');
    expect(p.reference_ranges).toBeInstanceOf(Array);
    expect(p.reference_ranges.length).toBeGreaterThan(0);
    p.reference_ranges.forEach(r => {
      expect(r).toHaveProperty('sex');
      expect(['Ambos','Masculino','Femenino']).toContain(r.sex);
    });
  });

  test('Valida 400 cuando faltan campos', async () => {
    const res = await request(app)
      .post('/api/analysis/ai/generate-parameter')
      .set('Authorization', `Bearer ${token}`)
      .send({ studyName: 'SoloNombre' })
      .expect(400);
    expect(res.text).toMatch(/studyId/i);
  });
});
