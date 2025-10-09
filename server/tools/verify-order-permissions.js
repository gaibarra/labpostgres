#!/usr/bin/env node
/*
 * Verifica que roles base tengan permisos críticos de órdenes.
 * Uso: node server/tools/verify-order-permissions.js
 */
const { pool } = require('../db');

(async () => {
  try {
    const { rows } = await pool.query("SELECT role_name, permissions->'orders' AS orders FROM roles_permissions WHERE role_name IN ('Administrador','Laboratorista','Recepcionista') ORDER BY role_name");
    const required = {
      Administrador: ['create','read_all','enter_results','update_status','validate_results','print_report','send_report'],
      Laboratorista: ['read_all','enter_results','update_status'],
      Recepcionista: ['create','read_all','update_status','print_report','send_report']
    };
    const report = rows.map(r => {
      const current = Array.isArray(r.orders) ? r.orders : (r.orders ? r.orders.filter ? r.orders : [] : []);
      const missing = required[r.role_name].filter(p => !current.includes(p));
      return { role: r.role_name, current, missing };
    });
    console.log(JSON.stringify({ ok: report.every(r=>r.missing.length===0), report }, null, 2));
    process.exit(report.every(r=>r.missing.length===0) ? 0 : 1);
  } catch (e) {
    console.error('Error verificando permisos', e.message);
    process.exit(2);
  } finally {
    pool.end().catch(()=>{});
  }
})();
