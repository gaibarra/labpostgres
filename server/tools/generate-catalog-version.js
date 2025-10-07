#!/usr/bin/env node
/**
 * Genera una nueva versión del catálogo (analysis + parameters + reference_ranges)
 * si el hash actual difiere del último almacenado en catalog_versions.
 *
 * Estrategia:
 * 1. Construir snapshot canónico: lista ordenada de análisis, cada uno con parámetros y rangos.
 * 2. Calcular hash sha256 usando util hashCatalog (stable stringify + canonical sort).
 * 3. Leer última versión. Si hash igual => salir informando (no-op).
 * 4. Calcular version_number = (último + 1) o 1 si no hay.
 * 5. Calcular diff_from_previous (simple):
 *    - addedAnalyses / removedAnalyses (por key)
 *    - modifiedAnalyses: parámetros añadidos/removidos o cambios en rangos
 * 6. Insertar fila.
 */
const { pool } = require('../db');
const { hashCatalog } = require('../utils/catalogHash');

(async ()=>{
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Verificar existencia de tabla; si no existe abortar con mensaje amigable.
    const { rows: tbl } = await client.query("SELECT to_regclass('public.catalog_versions') AS t");
    if (!tbl[0].t) {
      console.error('[catalog-version] Tabla catalog_versions no existe. Ejecuta migraciones primero.');
      process.exitCode = 1; await client.query('ROLLBACK'); return;
    }
    // Descubrir columnas clave (code/clave) para key estable
    let hasCode=false, hasClave=false;
    try {
      const { rows: cols } = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='analysis' AND column_name IN ('code','clave')");
      cols.forEach(r=>{ if(r.column_name==='code') hasCode=true; if(r.column_name==='clave') hasClave=true; });
  } catch(_) { /* ignore introspection errors */ }
    const keyExpr = hasCode && hasClave ? 'COALESCE(code, clave)' : (hasCode ? 'code' : (hasClave ? 'clave' : 'name'));
    const orderExpr = hasCode || hasClave ? keyExpr : 'name';
    const { rows: analyses } = await client.query(`SELECT id, name, ${keyExpr} AS key FROM analysis ORDER BY ${orderExpr}`);
    const { rows: params } = await client.query('SELECT id, analysis_id, name, unit, decimal_places FROM analysis_parameters ORDER BY analysis_id, position NULLS LAST, created_at');
    let rangeCols = 'id, parameter_id, sex, age_min, age_max, age_min_unit, lower, upper, notes';
    try { await client.query('SELECT lower FROM reference_ranges LIMIT 0'); } catch(_) { rangeCols = 'id, parameter_id, sex, age_min, age_max, age_min_unit, min_value AS lower, max_value AS upper, notes'; }
    const { rows: ranges } = await client.query(`SELECT ${rangeCols} FROM reference_ranges ORDER BY parameter_id, created_at`);
    const rangesByParam = ranges.reduce((acc,r)=>{ (acc[r.parameter_id]=acc[r.parameter_id]||[]).push({ sex:r.sex, age_min:r.age_min, age_max:r.age_max, age_min_unit:r.age_min_unit, lower:r.lower, upper:r.upper, notes:r.notes }); return acc; },{});
    const paramsByAnalysis = params.reduce((acc,p)=>{ (acc[p.analysis_id]=acc[p.analysis_id]||[]).push({ name:p.name, unit:p.unit, decimal_places:p.decimal_places, ranges: rangesByParam[p.id]||[] }); return acc; },{});
    const items = analyses.map(a=>({ key:a.key, name:a.name, parameters: paramsByAnalysis[a.id]||[] }));
    const snapshot = { items };
    const hash = hashCatalog(snapshot);

    const { rows: last } = await client.query('SELECT version_number, hash_sha256, snapshot FROM catalog_versions ORDER BY version_number DESC LIMIT 1');
    if (last[0] && last[0].hash_sha256 === hash) {
      console.log('[catalog-version] Hash sin cambios. No se crea nueva versión. version_number actual =', last[0].version_number);
      await client.query('ROLLBACK');
      return;
    }
    const newVersion = (last[0]?.version_number || 0) + 1;

    // Diff básico si existe anterior
    let diff = null; const prev = last[0]?.snapshot || null;
    if (prev) {
      const prevMap = (prev.items||[]).reduce((m,a)=>{ m[a.key]=a; return m; },{});
      const currMap = items.reduce((m,a)=>{ m[a.key]=a; return m; },{});
      const addedAnalyses = items.filter(a=> !prevMap[a.key]).map(a=>a.key);
      const removedAnalyses = (prev.items||[]).filter(a=> !currMap[a.key]).map(a=>a.key);
      const modifiedAnalyses = [];
      for (const a of items) {
        const oldA = prevMap[a.key]; if (!oldA) continue;
        // Params diff
        const oldParamMap = (oldA.parameters||[]).reduce((m,p)=>{ m[p.name]=p; return m; },{});
        const newParamMap = (a.parameters||[]).reduce((m,p)=>{ m[p.name]=p; return m; },{});
        const addedParams = a.parameters.filter(p=> !oldParamMap[p.name]).map(p=>p.name);
        const removedParams = (oldA.parameters||[]).filter(p=> !newParamMap[p.name]).map(p=>p.name);
        const changedParams = [];
        for (const p of a.parameters) {
          const op = oldParamMap[p.name]; if (!op) continue;
          // Compare ranges (count + each simplified)
          const simplifyRanges = (rs)=> rs.map(r=> `${r.sex}:${r.age_min||''}-${r.age_max||''}:${r.lower||''}-${r.upper||''}:${r.notes||''}` ).sort();
          const prevRanges = simplifyRanges(op.ranges||[]);
            const currRanges = simplifyRanges(p.ranges||[]);
          if (prevRanges.length !== currRanges.length || prevRanges.some((v,i)=> v!==currRanges[i])) {
            changedParams.push(p.name);
          }
        }
        if (addedParams.length || removedParams.length || changedParams.length) {
          modifiedAnalyses.push({ key:a.key, addedParams, removedParams, changedParams });
        }
      }
      diff = { addedAnalyses, removedAnalyses, modifiedAnalyses };
    }

    const itemCount = items.length;
    const rangeCount = ranges.length;

    const insertSql = `INSERT INTO catalog_versions(version_number, hash_sha256, item_count, range_count, snapshot, diff_from_previous, previous_version)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, version_number`;
    const paramsInsert = [newVersion, hash, itemCount, rangeCount, snapshot, diff, last[0]?.version_number || null];
    const { rows: ins } = await client.query(insertSql, paramsInsert);
    await client.query('COMMIT');
    console.log(`[catalog-version] Nueva versión creada #${ins[0].version_number} (id ${ins[0].id}) hash=${hash}`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[catalog-version] Error:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
