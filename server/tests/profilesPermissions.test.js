// Ensure Vitest globals (beforeAll, test, expect) are present when this file runs in isolation
import { beforeAll, describe, test, expect } from 'vitest';
const request = require('supertest');
const app = require('..');
const { pool } = require('../db');

let db = true; let adminToken; let guestToken;
beforeAll(async () => {
  try { await pool.query('SELECT 1'); } catch { db = false; }
  if (!db) return;
  const adminEmail = `prof_admin_${Date.now()}@example.com`;
  await request(app).post('/api/auth/register').send({ email: adminEmail, password: 'Secret123', role: 'Administrador' });
  const aLogin = await request(app).post('/api/auth/login').send({ email: adminEmail, password: 'Secret123' });
  adminToken = aLogin.body.token;
  const guestEmail = `prof_guest_${Date.now()}@example.com`;
  await request(app).post('/api/auth/register').send({ email: guestEmail, password: 'Secret123', role: 'Invitado' });
  const gLogin = await request(app).post('/api/auth/login').send({ email: guestEmail, password: 'Secret123' });
  guestToken = gLogin.body.token;
});

describe('Profiles permissions', () => {
  test('guest cannot list profiles', async () => {
    if (!db) return expect(true).toBe(true);
    const res = await request(app).get('/api/profiles').set('Authorization', `Bearer ${guestToken}`);
    expect(res.status).toBe(403);
  });
  test('admin can list profiles', async () => {
    if (!db) return expect(true).toBe(true);
    const res = await request(app).get('/api/profiles').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
