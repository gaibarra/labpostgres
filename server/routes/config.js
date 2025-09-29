const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const router = express.Router();
const { configLimiter } = require('../middleware/rateLimit');

// Centralizado en utils/secrets
const { redactSecrets, SECRET_FIELDS, LEGACY_SECRET_FIELDS } = require('../utils/secrets');
const crypto = require('crypto');

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

// Campos de labInfo protegidos: no se pueden modificar sin forceUnlock explícito
// Puedes ampliar esta lista si en futuro se agregan más datos críticos.
const PROTECTED_LABINFO_FIELDS = [
  'name','razonSocial','taxId','logoUrl','calle','numeroExterior','numeroInterior','colonia','codigoPostal','ciudad','estado','pais','phone','secondaryPhone','email','website','responsableSanitarioNombre','responsableSanitarioCedula'
];

// Helper audit (no throw): registra evento de cambio en OpenAI key sin exponer secreto completo
async function auditOpenAI(req, action, details){
  try {
    await pool.query('INSERT INTO system_audit_logs(action, details, performed_by) VALUES($1,$2,$3)', [action, details, req.user?.id || null]);
  } catch(e){
    console.error('[CONFIG AUDIT openaiApiKey]', e.message);
  }
}

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
  // Adjuntar metadata cruda sólo para uso interno; se filtrará en capa GET según rol
  if (row.integrations_meta) {
    out._integrationsMeta = row.integrations_meta;
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

// Helper: determina si el usuario es admin (rol Administrador) para exponer secretos completos
function isAdmin(req){
  return req.user && (req.user.role === 'Administrador' || req.user.role_name === 'Administrador');
}

// Construir versión segura de integraciones para respuesta según rol
function buildSafeIntegrations(integrations, admin){
  if (!integrations || typeof integrations !== 'object') return {};
  const safe = { ...integrations };
  // Incluir lista defensiva (SECRET_FIELDS + legacy)
  const allSecretCandidates = [...SECRET_FIELDS, ...LEGACY_SECRET_FIELDS];
  for (const f of allSecretCandidates) {
    const val = integrations[f];
    if (typeof val === 'string' && val) {
      if (admin) {
        // Admin ve valor completo pero añadimos preview útil
        safe[`${f}Preview`] = val.length > 12 ? val.slice(0,4)+'***'+val.slice(-4) : '***';
      } else {
        // Usuarios no admin: ocultar valor completo
        safe[`${f}Preview`] = val.length > 8 ? val.slice(0,4)+'***'+val.slice(-4) : '***';
        delete safe[f];
      }
    } else if (!val) {
      delete safe[f];
    }
  }
  // Eliminar alias legacy siempre
  delete safe.openAIKey;
  return safe;
}

// GET current configuration (auto-create empty row if none) con masking de secretos para no-admin
router.get('/', requireAuth, async (req,res,next)=>{
  try {
    const row = await getOrCreateConfigRow(req);
    if (process.env.DEBUG_CONFIG) console.log('[CONFIG GET] returning row', row.id);
    const base = rowToFrontend(row);
    const admin = isAdmin(req);
    base.integrations = buildSafeIntegrations(base.integrations || {}, admin);
    if (admin && base._integrationsMeta) {
      base.integrations._meta = base._integrationsMeta; // embed
    }
    delete base._integrationsMeta;
    return res.json(base);
  } catch(err){
    next(err);
  }
});

// PATCH partial update (top-level deep merge per section using jsonb ||)
router.patch('/', requireAuth, requirePermission('settings','update'), configLimiter, async (req,res,next)=>{
  try {
    const current = await getOrCreateConfigRow(req);
    const payload = req.body || {};
    const forceUnlock = Boolean(payload.forceUnlock) || req.query.forceUnlock === '1';
  const admin = isAdmin(req);

    // Protección labInfo: permitir set inicial de campos protegidos pero bloquear cambios posteriores sin forceUnlock
    if (payload.labInfo && typeof payload.labInfo === 'object') {
      const attemptedKeys = Object.keys(payload.labInfo);
      // Si viene un objeto vacío ({}) ignorar para no sobreescribir con vacío
      if (attemptedKeys.length === 0) {
        delete payload.labInfo;
      } else {
        const currentLabInfo = (current.lab_info || {});
        const protectedTouched = attemptedKeys.filter(k => PROTECTED_LABINFO_FIELDS.includes(k));
        if (protectedTouched.length > 0 && !forceUnlock) {
          // Separar cuáles son modificaciones (ya existen) vs inicializaciones (no existen aún)
            const modifying = protectedTouched.filter(k => Object.prototype.hasOwnProperty.call(currentLabInfo, k));
          if (modifying.length > 0) {
            return res.status(409).json({
              error: 'LABINFO_PROTECTED',
              message: 'Los campos de información del laboratorio están protegidos y no pueden modificarse sin confirmación explícita.',
              details: { intentados: modifying, permiteInicial: protectedTouched.filter(k=>!modifying.includes(k)), requiere: 'forceUnlock=true' }
            });
          }
        }
      }
    }

    const updateFragments = [];
    const values = [];
    let idx = 1;
    if (process.env.DEBUG_CONFIG) {
  console.log('[CONFIG PATCH] raw incoming payload redacted=', JSON.stringify(redactSecrets(payload)));
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
    // Preparar metadata de integraciones si cambian secretos
  let metaNeedsUpdate = false;
  let newMeta = current.integrations_meta || {};
  // Usar sólo SECRET_FIELDS (sin alias)
  const secretFields = SECRET_FIELDS;

    for (const [feKey, valRaw] of Object.entries(payload)) {
      let val = valRaw;
      if (!(feKey in frontendToDb)) continue; // ignore unknown top-level section
      if (feKey === 'integrations' && val && typeof val === 'object') {
        // Normalizar alias legacy si llega (openAIKey -> openaiApiKey) antes de procesar
        if (val.openAIKey && !val.openaiApiKey) {
          val = { ...val, openaiApiKey: val.openAIKey };
          delete val.openAIKey;
        }
        // Seguridad: sólo admin puede crear, actualizar o eliminar la openaiApiKey
        if ((Object.prototype.hasOwnProperty.call(val,'openaiApiKey')) && !admin) {
          return res.status(403).json({ error:'OPENAI_KEY_ADMIN_ONLY', message:'Solo un administrador puede crear, actualizar o eliminar la clave OpenAI.' });
        }
        // Detectar cambios en secretos
        for (const f of secretFields) {
          if (Object.prototype.hasOwnProperty.call(val, f)) {
            const incoming = val[f];
            const prevMeta = current.integrations_meta?.[f];
            // null => borrado explícito
            if (incoming === null) {
              if (!prevMeta || !prevMeta.removedAt) {
                newMeta[f] = { removedAt: new Date().toISOString(), removedBy: req.user?.id || null };
                metaNeedsUpdate = true;
              }
              continue;
            }
            if (typeof incoming === 'string' && incoming !== '') {
              const hash = crypto.createHash('sha256').update(incoming).digest('hex');
              const prevHash = prevMeta && prevMeta.hash;
              if (prevHash === hash) {
                // Misma clave: no actualizar metadata; remover del payload para no forzar write innecesaria
                delete val[f];
              } else {
                const last4 = incoming.slice(-4);
                newMeta[f] = { updatedAt: new Date().toISOString(), updatedBy: req.user?.id || null, last4, hash };
                metaNeedsUpdate = true;
              }
            } else if (incoming === '') {
              // Cadena vacía se ignora: no rota, no borra
              delete val[f];
            }
          }
        }
      }
      updateFragments.push(`${frontendToDb[feKey]} = COALESCE(${frontendToDb[feKey]}, '{}'::jsonb) || $${idx++}::jsonb`);
      values.push(val);
    }
  if (metaNeedsUpdate) {
      updateFragments.push(`integrations_meta = COALESCE(integrations_meta, '{}'::jsonb) || $${idx++}::jsonb`);
      values.push(newMeta);
    }
    if (updateFragments.length === 0) {
      if (process.env.DEBUG_CONFIG) console.log('[CONFIG PATCH] no valid sections, skipping update');
      return res.json(rowToFrontend(current));
    }
    values.push(current.id);
    const sql = `UPDATE lab_configuration SET ${updateFragments.join(', ')} WHERE id = $${idx} RETURNING *`;
  if (process.env.DEBUG_CONFIG) console.log('[CONFIG PATCH] payload keys', Object.keys(payload), 'sql', sql);
    let updated;
    try {
      updated = await pool.query(sql, values);
    } catch(dbErr) {
      if (/integrations_meta/.test(dbErr.message)) {
        // Intentar crear columna on-the-fly (backfill) para entornos donde migración aún no corrió.
        try {
          await pool.query("ALTER TABLE lab_configuration ADD COLUMN IF NOT EXISTS integrations_meta jsonb DEFAULT '{}'::jsonb");
          updated = await pool.query(sql, values); // retry
        } catch(alterErr) {
          return next(alterErr);
        }
      } else {
        return next(dbErr);
      }
    }
  if (process.env.DEBUG_CONFIG) console.log('[CONFIG PATCH] updated row', updated.rows[0].id);
    // Audit OpenAI key change events (create / rotate / remove)
    try {
      if (metaNeedsUpdate && newMeta.openaiApiKey) {
        const prevMeta = current.integrations_meta?.openaiApiKey;
        const meta = newMeta.openaiApiKey;
        let action, info = { last4: meta.last4, updatedAt: meta.updatedAt, removedAt: meta.removedAt };
        if (meta.removedAt) {
          if (!prevMeta || !prevMeta.removedAt) action = 'Config.Integrations.OpenAIKeyRemoved';
        } else if (meta.updatedAt) {
          if (prevMeta && prevMeta.hash && prevMeta.hash !== meta.hash) action = 'Config.Integrations.OpenAIKeyRotated';
          else if (!prevMeta || !prevMeta.hash) action = 'Config.Integrations.OpenAIKeyCreated';
        }
        if (action) await auditOpenAI(req, action, info);
      }
    } catch(ae){ console.error('[CONFIG AUDIT PATCH] error', ae); }
    return res.json(rowToFrontend(updated.rows[0]));
  } catch(err){
    next(err);
  }
});

// PATCH only integrations (convenience endpoint). Accepts partial keys inside body root.
router.patch('/integrations', requireAuth, requirePermission('settings','update'), configLimiter, async (req,res,next)=>{
  try {
    const partialRaw = req.body || {};
    // Clonar para no mutar referencia externa
    const partial = { ...partialRaw };
  const admin = isAdmin(req);
    if (partial.openAIKey && !partial.openaiApiKey) {
      partial.openaiApiKey = partial.openAIKey;
      delete partial.openAIKey;
    }
    if (process.env.DEBUG_CONFIG) {
  console.log('[CONFIG PATCH /integrations] raw partial redacted=', JSON.stringify(redactSecrets(partial)));
      if (typeof partial.openaiApiKey !== 'undefined' || typeof partial.openAIKey !== 'undefined') {
        const raw = partial.openaiApiKey || partial.openAIKey;
        console.log('[CONFIG PATCH /integrations] received openai key length=', raw ? raw.length : 0);
      } else {
        console.log('[CONFIG PATCH /integrations] NO openai key field in request body');
      }
    }
    const current = await getOrCreateConfigRow(req);
    if (Object.prototype.hasOwnProperty.call(partial,'openaiApiKey') && !admin) {
      return res.status(403).json({ error:'OPENAI_KEY_ADMIN_ONLY', message:'Solo un administrador puede crear, actualizar o eliminar la clave OpenAI.' });
    }
    // Construir metadata
  const secretFields = SECRET_FIELDS;
    let metaNeedsUpdate = false;
    let newMeta = current.integrations_meta || {};
    for (const f of secretFields) {
      if (Object.prototype.hasOwnProperty.call(partial, f)) {
        const incoming = partial[f];
        const prevMeta = current.integrations_meta?.[f];
        if (incoming === null) {
          if (!prevMeta || !prevMeta.removedAt) {
            newMeta[f] = { removedAt: new Date().toISOString(), removedBy: req.user?.id || null };
            metaNeedsUpdate = true;
          }
          continue;
        }
        if (typeof incoming === 'string' && incoming !== '') {
          const hash = crypto.createHash('sha256').update(incoming).digest('hex');
            const prevHash = prevMeta && prevMeta.hash;
            if (prevHash === hash) {
              // Misma clave -> no actualizar metadata ni valor
              delete partial[f];
            } else {
              newMeta[f] = { updatedAt: new Date().toISOString(), updatedBy: req.user?.id || null, last4: incoming.slice(-4), hash };
              metaNeedsUpdate = true;
            }
        } else if (incoming === '') {
          delete partial[f];
        }
      }
    }
    let sql;
    let params;
  if (metaNeedsUpdate) {
      sql = "UPDATE lab_configuration SET integrations_settings = COALESCE(integrations_settings, '{}'::jsonb) || $1::jsonb, integrations_meta = COALESCE(integrations_meta, '{}'::jsonb) || $2::jsonb WHERE id = $3 RETURNING *";
      params = [partial, newMeta, current.id];
    } else {
      sql = "UPDATE lab_configuration SET integrations_settings = COALESCE(integrations_settings, '{}'::jsonb) || $1::jsonb WHERE id = $2 RETURNING *";
      params = [partial, current.id];
    }
    let updated;
    try {
      updated = await pool.query(sql, params);
    } catch(dbErr) {
      if (/integrations_meta/.test(dbErr.message)) {
        try {
          await pool.query("ALTER TABLE lab_configuration ADD COLUMN IF NOT EXISTS integrations_meta jsonb DEFAULT '{}'::jsonb");
          updated = await pool.query(sql, params);
        } catch(alterErr) {
          return next(alterErr);
        }
      } else {
        return next(dbErr);
      }
    }
  if (process.env.DEBUG_CONFIG) console.log('[CONFIG PATCH /integrations] keys', Object.keys(partial), 'row', current.id);
    // Audit single-endpoint modifications
    try {
      if (metaNeedsUpdate && newMeta.openaiApiKey) {
        const prevMeta = current.integrations_meta?.openaiApiKey;
        const meta = newMeta.openaiApiKey;
        let action, info = { last4: meta.last4, updatedAt: meta.updatedAt, removedAt: meta.removedAt };
        if (meta.removedAt) {
          if (!prevMeta || !prevMeta.removedAt) action = 'Config.Integrations.OpenAIKeyRemoved';
        } else if (meta.updatedAt) {
          if (prevMeta && prevMeta.hash && prevMeta.hash !== meta.hash) action = 'Config.Integrations.OpenAIKeyRotated';
          else if (!prevMeta || !prevMeta.hash) action = 'Config.Integrations.OpenAIKeyCreated';
        }
        if (action) await auditOpenAI(req, action, info);
      }
    } catch(ae){ console.error('[CONFIG AUDIT PATCH /integrations] error', ae); }
    return res.json(rowToFrontend(updated.rows[0]));
  } catch(err){
    next(err);
  }
});

// PUT full replace (expects full object keys; missing keys left untouched unless null explicitly provided)
router.put('/', requireAuth, requirePermission('settings','update'), configLimiter, async (req,res,next)=>{
  try {
    const current = await getOrCreateConfigRow(req);
    const payload = req.body || {};
    const forceUnlock = Boolean(payload.forceUnlock) || req.query.forceUnlock === '1';
  const admin = isAdmin(req);

    if (Object.prototype.hasOwnProperty.call(payload,'labInfo')) {
      const labInfoIncoming = payload.labInfo || {};
      if (labInfoIncoming && typeof labInfoIncoming === 'object') {
        const attemptedKeys = Object.keys(labInfoIncoming);
        const protectedTouched = attemptedKeys.filter(k => PROTECTED_LABINFO_FIELDS.includes(k));
        // Diferencia intencional con PATCH: para PUT (reemplazo declarativo) exigimos forceUnlock
        // incluso para la asignación inicial de campos protegidos, porque semánticamente el
        // cliente está "re-declarando" toda la sección y los tests esperan 409 en ese caso.
        if (protectedTouched.length > 0 && !forceUnlock) {
          return res.status(409).json({
            error: 'LABINFO_PROTECTED',
            message: 'Los campos de información del laboratorio están protegidos y requieren confirmación explícita (forceUnlock) al usar PUT.',
            details: { intentados: protectedTouched, requiere: 'forceUnlock=true' }
          });
        }
      }
    }
    const updateFragments = [];
    const values = [];
    let idx = 1;
    // Preparar metadatos de rotación para PUT (similar a PATCH) si integra openaiApiKey
    let putMetaNeedsUpdate = false; let putNewMeta = current.integrations_meta || {};
    const secretFieldsPut = SECRET_FIELDS;
    if (payload.integrations && typeof payload.integrations === 'object') {
      const integ = payload.integrations;
      if (integ.openAIKey && !integ.openaiApiKey) { integ.openaiApiKey = integ.openAIKey; delete integ.openAIKey; }
      for (const f of secretFieldsPut) {
        if (Object.prototype.hasOwnProperty.call(integ, f)) {
          const incoming = integ[f];
          const prevMeta = current.integrations_meta?.[f];
          if (incoming === null) {
            if (!prevMeta || !prevMeta.removedAt) { putNewMeta[f] = { removedAt: new Date().toISOString(), removedBy: req.user?.id || null }; putMetaNeedsUpdate = true; }
            continue;
          }
          if (typeof incoming === 'string' && incoming !== '') {
            const hash = crypto.createHash('sha256').update(incoming).digest('hex');
            const prevHash = prevMeta && prevMeta.hash;
            if (prevHash === hash) {
              // misma -> no metadata nuevo
            } else {
              putNewMeta[f] = { updatedAt: new Date().toISOString(), updatedBy: req.user?.id || null, last4: incoming.slice(-4), hash };
              putMetaNeedsUpdate = true;
            }
          }
        }
      }
    }
    for (const [feKey, dbKey] of Object.entries(frontendToDb)) {
      if (Object.prototype.hasOwnProperty.call(payload, feKey)) {
        if (feKey === 'integrations' && payload.integrations && typeof payload.integrations === 'object') {
          const integ = payload.integrations;
          if ((Object.prototype.hasOwnProperty.call(integ,'openaiApiKey') || Object.prototype.hasOwnProperty.call(integ,'openAIKey')) && !admin) {
            return res.status(403).json({ error:'OPENAI_KEY_ADMIN_ONLY', message:'Solo un administrador puede crear, actualizar o eliminar la clave OpenAI.' });
          }
        }
        updateFragments.push(`${dbKey} = $${idx++}`);
        values.push(payload[feKey]);
      }
    }
    if (putMetaNeedsUpdate) { updateFragments.push(`integrations_meta = COALESCE(integrations_meta, '{}'::jsonb) || $${idx++}::jsonb`); values.push(putNewMeta); }
    if (updateFragments.length === 0) {
      return res.json(rowToFrontend(current));
    }
    values.push(current.id);
    const sql = `UPDATE lab_configuration SET ${updateFragments.join(', ')} WHERE id = $${idx} RETURNING *`;
  if (process.env.DEBUG_CONFIG) console.log('[CONFIG PUT] replace keys', Object.keys(payload));
    const updated = await pool.query(sql, values);
    // Audit events for PUT
    try {
      if (putMetaNeedsUpdate && putNewMeta.openaiApiKey) {
        const prevMeta = current.integrations_meta?.openaiApiKey;
        const meta = putNewMeta.openaiApiKey;
        let action, info = { last4: meta.last4, updatedAt: meta.updatedAt, removedAt: meta.removedAt };
        if (meta.removedAt) {
          if (!prevMeta || !prevMeta.removedAt) action = 'Config.Integrations.OpenAIKeyRemoved';
        } else if (meta.updatedAt) {
          if (prevMeta && prevMeta.hash && prevMeta.hash !== meta.hash) action = 'Config.Integrations.OpenAIKeyRotated';
          else if (!prevMeta || !prevMeta.hash) action = 'Config.Integrations.OpenAIKeyCreated';
        }
        if (action) await auditOpenAI(req, action, info);
      }
    } catch(ae){ console.error('[CONFIG AUDIT PUT] error', ae); }
    return res.json(rowToFrontend(updated.rows[0]));
  } catch(err){
    next(err);
  }
});

module.exports = router;

// NUEVO: GET /api/config/integrations (endpoint admin-only para valores completos + metadata)
router.get('/integrations', requireAuth, async (req,res,next)=>{
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    const row = await getOrCreateConfigRow(req);
    const integrations = (row.integrations_settings || {});
    // Limpiar alias legacy si aún existe
    if (integrations.openAIKey && !integrations.openaiApiKey) {
      // Migrar silenciosamente a la clave nueva
      integrations.openaiApiKey = integrations.openAIKey;
      delete integrations.openAIKey;
    } else {
      delete integrations.openAIKey;
    }
    return res.json({ integrations, integrationsMeta: row.integrations_meta || {} });
  } catch(err){
    next(err);
  }
});
