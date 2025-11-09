#!/usr/bin/env node
/**
 * auditPackageItemsTriggers.js
 * Lista triggers y funciones asociadas a la tabla analysis_package_items para cada tenant.
 * Modo multi-tenant: usa tenantResolver para descubrir pools; si no está habilitado MULTI_TENANT=1
 * se ejecuta sólo sobre la DB principal.
 *
 * Uso:
 *   node server/scripts/auditPackageItemsTriggers.js [--json] [--schema=tenant_schema]
 *
 * Salida (texto):
 *   Por cada schema: triggers (nombre, def, eventos) y funciones detectadas referenciadas.
 * Salida (JSON):
 *   Array con objetos { schema, triggers: [...], functions: [...] }
 */
const path = require('path');
const { pool } = require('../db');
let getTenantPool = null, listTenants = null;
let multiTenant = process.env.MULTI_TENANT === '1';
try {
  if (multiTenant) {
    ({ getTenantPool, listTenants } = require('../services/tenantResolver'));
  }
} catch (e) {
  console.warn('[auditPackageItemsTriggers] No se pudo cargar tenantResolver, modo single-tenant.', e.message);
  multiTenant = false;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { json: false, schema: null };
  for (let i=0;i<args.length;i++) {
    const a = args[i];
    if (a === '--json') out.json = true;
    else if (a.startsWith('--schema=')) out.schema = a.split('=')[1];
  }
  return out;
}

async function listTargetSchemas() {
  if (multiTenant && listTenants) {
    try {
      const tenants = await listTenants();
      // listTenants puede devolver objetos; intentar normalizar a schema (tenant_id o slug)
      return tenants.map(t => t.schema || t.tenant_schema || t.tenantId || t.id || t.slug).filter(Boolean);
    } catch (e) {
      console.warn('[auditPackageItemsTriggers] listTenants falló, usando single pool:', e.message);
    }
  }
  // Single tenant: introspeccionar search_path actual para obtener el schema principal.
  const { rows } = await pool.query("SELECT current_schema() AS schema");
  return [rows[0].schema];
}

async function auditSchema(schema, tenantPool) {
  const p = tenantPool || pool;
  const result = { schema, triggers: [], functions: [] };
  // Verificar que la tabla exista
  const tableExistsQ = `SELECT 1 FROM information_schema.tables WHERE table_schema=$1 AND table_name='analysis_package_items' LIMIT 1`;
  const tExists = await p.query(tableExistsQ, [schema]);
  if (!tExists.rows.length) {
    result.missingTable = true;
    return result;
  }
  // Triggers
  const triggerSql = `SELECT t.tgname AS trigger_name, pg_get_triggerdef(t.oid, true) AS definition, c.relname AS table_name,
    t.tgenabled AS enabled, n.nspname AS schema, t.tgtype
  FROM pg_trigger t
  JOIN pg_class c ON t.tgrelid = c.oid
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = $1 AND c.relname='analysis_package_items' AND NOT t.tgisinternal`;
  const trgRes = await p.query(triggerSql, [schema]);
  result.triggers = trgRes.rows.map(r => ({
    name: r.trigger_name,
    definition: r.definition,
    enabled: r.enabled,
    rawType: r.tgtype
  }));
  // Extraer posibles nombres de funciones de las definiciones
  const fnNames = new Set();
  for (const trg of result.triggers) {
    // Definición típica: "CREATE TRIGGER name BEFORE INSERT ON table FOR EACH ROW EXECUTE FUNCTION schema.func_name()"
    const m = trg.definition.match(/EXECUTE FUNCTION ([a-zA-Z0-9_\.]+)\s*\(/);
    if (m) fnNames.add(m[1].includes('.') ? m[1].split('.').pop() : m[1]);
  }
  if (fnNames.size) {
    const fnArray = Array.from(fnNames);
    const paramPlaceholders = fnArray.map((_,i) => `$${i+2}`).join(',');
    const fnSql = `SELECT p.proname, l.lanname AS language, pg_get_functiondef(p.oid) AS source
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      JOIN pg_language l ON p.prolang = l.oid
      WHERE n.nspname=$1 AND p.proname IN (${paramPlaceholders})`;
    const fnRes = await p.query(fnSql, [schema, ...fnArray]);
    result.functions = fnRes.rows.map(r => ({ name: r.proname, language: r.language, source: r.source }));
  }
  return result;
}

(async () => {
  const args = parseArgs();
  let schemas = args.schema ? [args.schema] : await listTargetSchemas();
  const out = [];
  for (const schema of schemas) {
    let tPool = null;
    if (multiTenant && getTenantPool) {
      try { tPool = await getTenantPool(schema); } catch (e) { console.warn(`[auditPackageItemsTriggers] getTenantPool fallo para ${schema}:`, e.message); }
    }
    try {
      const audited = await auditSchema(schema, tPool);
      out.push(audited);
      if (!args.json) {
        console.log(`\n=== Schema: ${schema} ===`);
        if (audited.missingTable) {
          console.log('Tabla analysis_package_items: (NO EXISTE)');
          continue;
        }
        console.log(`Triggers (${audited.triggers.length}):`);
        audited.triggers.forEach(t => {
          console.log(` - ${t.name}: ${t.definition}`);
        });
        console.log(`Funciones (${audited.functions.length} referenciadas):`);
        audited.functions.forEach(f => {
          console.log(` - ${f.name} [${f.language}]`);
        });
      }
    } catch (e) {
      console.error(`[auditPackageItemsTriggers] Error auditando schema ${schema}:`, e.message);
      out.push({ schema, error: e.message });
    }
  }
  if (args.json) {
    process.stdout.write(JSON.stringify(out, null, 2));
  }
  process.exit(0);
})().catch(e => {
  console.error('[auditPackageItemsTriggers] FATAL', e);
  process.exit(1);
});
