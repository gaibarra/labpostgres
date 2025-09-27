const { pool } = require('../db');
const { AppError } = require('../utils/errors');

// Simple async fire-and-forget insert with minimal impact; errors logged only.
let auditEnsured = false;
async function ensureAudit() {
  if (auditEnsured) return;
  try {
    // Create table if missing (using created_at canonical name)
    await pool.query(`CREATE TABLE IF NOT EXISTS system_audit_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      action text NOT NULL,
      entity text,
      entity_id text,
      details jsonb,
      performed_by uuid,
      created_at timestamptz DEFAULT now()
    );`);

    // If legacy column name 'timestamp' exists but 'created_at' does not, rename it.
    const colCheck = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='system_audit_logs'`);
    const cols = colCheck.rows.map(r=>r.column_name);
    if (!cols.includes('created_at') && cols.includes('timestamp')) {
      try { await pool.query('ALTER TABLE system_audit_logs RENAME COLUMN "timestamp" TO created_at'); } catch(_) {}
    }
    // Add missing columns (migration from older minimal schema without entity/entity_id)
    if (!cols.includes('entity')) {
      try { await pool.query('ALTER TABLE system_audit_logs ADD COLUMN entity text'); } catch(e){ if (process.env.AUDIT_DEBUG) console.error('Add entity column failed', e.message); }
    }
    if (!cols.includes('entity_id')) {
      try { await pool.query('ALTER TABLE system_audit_logs ADD COLUMN entity_id text'); } catch(e){ if (process.env.AUDIT_DEBUG) console.error('Add entity_id column failed', e.message); }
    }
    // Indices (idempotent)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_action ON system_audit_logs(action);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_created ON system_audit_logs(created_at DESC);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_entity ON system_audit_logs(entity);`);
    auditEnsured = true;
  } catch(e) {
    if (process.env.AUDIT_DEBUG) console.error('ensureAudit failed', e);
  }
}
async function writeAudit(entry) {
  try {
    await ensureAudit();
    try {
      await pool.query(
        'INSERT INTO system_audit_logs(action, entity, entity_id, details, performed_by) VALUES($1,$2,$3,$4,$5)',
        [entry.action, entry.entity, entry.entityId || null, entry.details || {}, entry.userId || null]
      );
    } catch (insertErr) {
      // Fallback para esquemas antiguos sin entity/entity_id
      if (/column .* does not exist/i.test(insertErr.message)) {
        if (process.env.AUDIT_DEBUG) console.warn('Falling back to minimal audit insert (legacy schema)');
        await pool.query(
          'INSERT INTO system_audit_logs(action, details, performed_by) VALUES($1,$2,$3)',
          [entry.action, entry.details || {}, entry.userId || null]
        );
      } else throw insertErr;
    }
  } catch (e) {
    if (process.env.AUDIT_DEBUG) console.error('Audit write failed', e);
  }
}

// Middleware factory: (action, entity, entityIdGetter?, detailsBuilder?)
function audit(action, entity, entityIdGetter, detailsBuilder) {
  return (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        const entityId = typeof entityIdGetter === 'function' ? entityIdGetter(req, res) : null;
        const details = typeof detailsBuilder === 'function' ? detailsBuilder(req, res) : { method: req.method, path: req.originalUrl, ms: Date.now() - start };
        writeAudit({ userId: req.user?.id, action, entity, entityId, details });
      }
    });
    next();
  };
}

module.exports = { audit };
