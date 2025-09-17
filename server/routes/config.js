const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const router = express.Router();

// Utility: mask secret-like fields before logging
function maskSecrets(obj){
  if (!obj || typeof obj !== 'object') return obj;
  const secretFields = ['openaiApiKey','openAIKey','whatsappApiKey','emailApiKey','telegramBotToken','deepseekKey','perplexityKey'];
  if (Array.isArray(obj)) return obj.map(v=>maskSecrets(v));
  const out = {};
  for (const [k,v] of Object.entries(obj)) {
    if (v && typeof v === 'object') {
      out[k] = maskSecrets(v);
    } else if (secretFields.includes(k) && typeof v === 'string') {
      out[k] = v.length > 9 ? v.slice(0,4)+'***'+v.slice(-4) : '***MASKED***';
    } else {
      out[k] = v;
    }
  }
  return out;
}

// Map DB columns to frontend keys (mirror of frontend mapping)
const dbToFrontend = {
  lab_info: 'labInfo',
  report_settings: 'reportSettings',
  ui_settings: 'uiSettings',
  regional_settings: 'regionalSettings',
  integrations_settings: 'integrations',
  tax_settings: 'taxSettings'
};
const frontendToDb = Object.fromEntries(Object.entries(dbToFrontend).map(([k,v])=>[v,k]));

function rowToFrontend(row){
  const out = { id: row.id, created_at: row.created_at, updated_at: row.updated_at };
  for (const [dbKey, feKey] of Object.entries(dbToFrontend)) {
    out[feKey] = row[dbKey] || {};
  }
  // En modo test ocultamos la marca interna si existe
  if (process.env.TEST_MODE === '1' && out.labInfo && typeof out.labInfo === 'object') {
    const { _testOwner, ...rest } = out.labInfo;
    out.labInfo = rest;
  }
  return out;
}

// Helper: obtener (o crear) la fila de configuración actual.
// En TEST_MODE, se usa una fila por usuario (marcada en lab_info._testOwner) para evitar interferencias entre suites.
async function getOrCreateConfigRow(req) {
  if (process.env.TEST_MODE === '1' && req.user && req.user.id) {
    // Buscar una fila que pertenezca al usuario actual
    const sel = await pool.query(
      "SELECT * FROM lab_configuration WHERE COALESCE(lab_info->>'_testOwner','') = $1 ORDER BY created_at ASC LIMIT 1",
      [String(req.user.id)]
    );
    if (sel.rows.length > 0) return sel.rows[0];
    // Crear una nueva fila con la marca _testOwner
    const baseLabInfo = { _testOwner: String(req.user.id) };
    const ins = await pool.query(
      'INSERT INTO lab_configuration (lab_info) VALUES ($1) RETURNING *',
      [baseLabInfo]
    );
    if (process.env.DEBUG_CONFIG) console.log('[CONFIG getOrCreate] created test row for user', req.user.id, ins.rows[0].id);
    return ins.rows[0];
  }
  // Modo normal: fila única determinística
  const { rows } = await pool.query('SELECT * FROM lab_configuration ORDER BY created_at ASC LIMIT 1');
  if (rows.length === 0) {
    const insert = await pool.query('INSERT INTO lab_configuration DEFAULT VALUES RETURNING *');
    return insert.rows[0];
  }
  return rows[0];
}

// GET current configuration (auto-create empty row if none)
router.get('/', requireAuth, async (req,res,next)=>{
  try {
    const row = await getOrCreateConfigRow(req);
    if (process.env.DEBUG_CONFIG) console.log('[CONFIG GET] returning row', row.id);
    return res.json(rowToFrontend(row));
  } catch(err){
    next(err);
  }
});

// PATCH partial update (top-level deep merge per section using jsonb ||)
router.patch('/', requireAuth, requirePermission('settings','update'), async (req,res,next)=>{
  try {
    const current = await getOrCreateConfigRow(req);
    const payload = req.body || {};
    const updateFragments = [];
    const values = [];
    let idx = 1;
    if (process.env.DEBUG_CONFIG) {
      console.log('[CONFIG PATCH] raw incoming payload masked=', JSON.stringify(maskSecrets(payload)));
      if (payload.integrations) {
        if (typeof payload.integrations.openaiApiKey !== 'undefined' || typeof payload.integrations.openAIKey !== 'undefined') {
          const raw = payload.integrations.openaiApiKey || payload.integrations.openAIKey;
          console.log('[CONFIG PATCH] integrations contains openai key length=', raw ? raw.length : 0);
        } else {
          console.log('[CONFIG PATCH] integrations present but NO openai key field');
        }
      } else {
        console.log('[CONFIG PATCH] NO integrations section in payload');
      }
    }
    for (const [feKey, val] of Object.entries(payload)) {
      if (!(feKey in frontendToDb)) continue; // ignore unknown top-level section
      updateFragments.push(`${frontendToDb[feKey]} = COALESCE(${frontendToDb[feKey]}, '{}'::jsonb) || $${idx++}::jsonb`);
      values.push(val);
    }
    if (updateFragments.length === 0) {
      if (process.env.DEBUG_CONFIG) console.log('[CONFIG PATCH] no valid sections, skipping update');
      return res.json(rowToFrontend(current));
    }
    values.push(current.id);
    const sql = `UPDATE lab_configuration SET ${updateFragments.join(', ')} WHERE id = $${idx} RETURNING *`;
  if (process.env.DEBUG_CONFIG) console.log('[CONFIG PATCH] payload keys', Object.keys(payload), 'sql', sql);
    const updated = await pool.query(sql, values);
  if (process.env.DEBUG_CONFIG) console.log('[CONFIG PATCH] updated row', updated.rows[0].id);
    return res.json(rowToFrontend(updated.rows[0]));
  } catch(err){
    next(err);
  }
});

// PATCH only integrations (convenience endpoint). Accepts partial keys inside body root.
router.patch('/integrations', requireAuth, requirePermission('settings','update'), async (req,res,next)=>{
  try {
    const partial = req.body || {};
    if (process.env.DEBUG_CONFIG) {
      console.log('[CONFIG PATCH /integrations] raw partial masked=', JSON.stringify(maskSecrets(partial)));
      if (typeof partial.openaiApiKey !== 'undefined' || typeof partial.openAIKey !== 'undefined') {
        const raw = partial.openaiApiKey || partial.openAIKey;
        console.log('[CONFIG PATCH /integrations] received openai key length=', raw ? raw.length : 0);
      } else {
        console.log('[CONFIG PATCH /integrations] NO openai key field in request body');
      }
    }
    const current = await getOrCreateConfigRow(req);
    const sql = "UPDATE lab_configuration SET integrations_settings = COALESCE(integrations_settings, '{}'::jsonb) || $1::jsonb WHERE id = $2 RETURNING *";
    const updated = await pool.query(sql, [partial, current.id]);
  if (process.env.DEBUG_CONFIG) console.log('[CONFIG PATCH /integrations] keys', Object.keys(partial), 'row', current.id);
    return res.json(rowToFrontend(updated.rows[0]));
  } catch(err){
    next(err);
  }
});

// PUT full replace (expects full object keys; missing keys left untouched unless null explicitly provided)
router.put('/', requireAuth, requirePermission('settings','update'), async (req,res,next)=>{
  try {
    const current = await getOrCreateConfigRow(req);
    const payload = req.body || {};
    const updateFragments = [];
    const values = [];
    let idx = 1;
    for (const [feKey, dbKey] of Object.entries(frontendToDb)) {
      if (Object.prototype.hasOwnProperty.call(payload, feKey)) {
        updateFragments.push(`${dbKey} = $${idx++}`);
        values.push(payload[feKey]);
      }
    }
    if (updateFragments.length === 0) {
      return res.json(rowToFrontend(current));
    }
    values.push(current.id);
    const sql = `UPDATE lab_configuration SET ${updateFragments.join(', ')} WHERE id = $${idx} RETURNING *`;
  if (process.env.DEBUG_CONFIG) console.log('[CONFIG PUT] replace keys', Object.keys(payload));
    const updated = await pool.query(sql, values);
    return res.json(rowToFrontend(updated.rows[0]));
  } catch(err){
    next(err);
  }
});

module.exports = router;
