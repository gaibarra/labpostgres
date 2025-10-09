#!/usr/bin/env node
/**
 * verify-new-tenant.js --slug=labdemo
 * Conecta a la DB del tenant y ejecuta checks de salud.
 */
const { Pool } = require('pg');
const path = require('path');
  try { require('dotenv').config({ path: path.resolve(__dirname, '../../.env') }); } catch(_){ /* no .env root */ }

function parseArgs(){
  const out={};
  for (const a of process.argv.slice(2)) { const m=a.match(/^--([^=]+)=(.*)$/); if(m) out[m[1]]=m[2]; }
  return out;
}
(async ()=>{
  const { slug } = parseArgs();
  if(!slug){ console.error('Falta --slug'); process.exit(1);}  
  const dbName = `lab_${slug.replace(/[^a-z0-9_]/gi,'').toLowerCase()}`;
  const pool = new Pool({
    host: process.env.TENANT_PGHOST || process.env.PGHOST,
    port: process.env.TENANT_PGPORT || process.env.PGPORT || 5432,
    user: process.env.TENANT_PGUSER || process.env.PGUSER,
    password: process.env.TENANT_PGPASSWORD || process.env.PGPASSWORD,
    database: dbName
  });
  const result = { db: dbName, ok: true, checks: [] };
  try {
    // 1. Columnas críticas
    const { rows: colRows } = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='work_orders'`);
    const cols = colRows.map(r=>r.column_name);
    const requiredCols = ['results','validation_notes','institution_reference','results_finalized','receipt_generated'];
    const missingCols = requiredCols.filter(c=>!cols.includes(c));
    result.checks.push({ area: 'work_orders.columns', missing: missingCols });
    if (missingCols.length) result.ok=false;
    // 2. Roles y permisos
    const expectedPerms = {
      Administrador: ['create','read_all','enter_results','update_status','validate_results','print_report','send_report'],
      Laboratorista: ['read_all','enter_results','update_status'],
      Recepcionista: ['create','read_all','update_status','print_report','send_report']
    };
    const { rows: rp } = await pool.query('SELECT role_name, permissions FROM roles_permissions');
    const permsMap = new Map(rp.map(r=>[r.role_name, r.permissions || {}]));
    const rolesReport = [];
    for (const [role, expected] of Object.entries(expectedPerms)) {
      if (!permsMap.has(role)) { rolesReport.push({ role, missing: expected, status: 'missing' }); result.ok=false; continue; }
      const cur = permsMap.get(role);
      const curOrders = Array.isArray(cur.orders) ? cur.orders : [];
      const missing = expected.filter(p=>!curOrders.includes(p));
      rolesReport.push({ role, missing, status: missing.length ? 'incomplete':'ok' });
      if (missing.length) result.ok = false;
    }
    result.checks.push({ area: 'roles.permissions', roles: rolesReport });
    // 3. Auditoría
    const auditRes = await pool.query(`SELECT to_regclass('public.system_audit_logs') IS NOT NULL AS exists`);
    result.checks.push({ area: 'audit.table', exists: auditRes.rows[0].exists });
    if (!auditRes.rows[0].exists) result.ok=false;
    // 4. Seed estudios canónicos (conteo mínimo)
    try {
      const { rows: anCount } = await pool.query('SELECT COUNT(*)::int AS c FROM analysis');
      result.checks.push({ area: 'analysis.seed', count: anCount[0].c });
    } catch(e){ result.checks.push({ area: 'analysis.seed', error: e.message }); }
  } catch(e){
    result.ok=false; result.error=e.message;
  } finally {
    await pool.end();
  }
  console.log(JSON.stringify(result,null,2));
})();
