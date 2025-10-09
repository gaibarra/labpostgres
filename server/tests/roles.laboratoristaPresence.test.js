const { pool } = require('../db');

describe('Laboratorista role presence', () => {
  test('roles_permissions contains Laboratorista with required orders actions', async () => {
    const { rows } = await pool.query("SELECT permissions FROM roles_permissions WHERE role_name='Laboratorista'");
    expect(rows.length).toBe(1);
    const perms = rows[0].permissions || {};
    expect(Array.isArray(perms.orders)).toBe(true);
    const needed = ['read_all','enter_results','update_status'];
    needed.forEach(n => expect(perms.orders).toContain(n));
  });
});
