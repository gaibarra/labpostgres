const express = require('express');
const { pool } = require('../db');
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { AppError } = require('../utils/errors');
const { audit } = require('../middleware/audit');

const router = express.Router();

// Ensure table shape has needed columns (idempotent safety adds)
async function ensureTemplateColumns(){
  const needed = ['type','content','header','footer','is_default','is_system','updated_at'];
  try {
    const { rows } = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='templates'`);
    const cols = rows.map(r=>r.column_name);
    const alter = [];
    if (!cols.includes('type')) alter.push('ADD COLUMN type text');
    if (!cols.includes('content')) alter.push('ADD COLUMN content text');
    if (!cols.includes('header')) alter.push('ADD COLUMN header text');
    if (!cols.includes('footer')) alter.push('ADD COLUMN footer text');
    if (!cols.includes('is_default')) alter.push('ADD COLUMN is_default boolean DEFAULT false');
    if (!cols.includes('is_system')) alter.push('ADD COLUMN is_system boolean DEFAULT false');
    if (!cols.includes('updated_at')) alter.push('ADD COLUMN updated_at timestamptz DEFAULT now()');
    if (alter.length) await pool.query('ALTER TABLE templates ' + alter.join(', '));
    // simple trigger for updated_at
    await pool.query(`CREATE OR REPLACE FUNCTION templates_set_updated_at() RETURNS trigger AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;`);
    await pool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_templates_updated_at') THEN CREATE TRIGGER trg_templates_updated_at BEFORE UPDATE ON templates FOR EACH ROW EXECUTE FUNCTION templates_set_updated_at(); END IF; END $$;`);
  } catch(e){ console.error('Error ensuring templates columns', e); }
}
ensureTemplateColumns();

router.get('/', auth, requirePermission('administration','manage_templates'), async (_req,res,next)=>{
  try { const { rows } = await pool.query('SELECT * FROM templates ORDER BY type, name'); res.json(rows); } catch(e){ console.error(e); next(new AppError(500,'Error listando plantillas','TEMPLATES_LIST_FAIL')); }
});

router.post('/seed-defaults', auth, requirePermission('administration','manage_templates'), async (req,res,next)=>{
  const templates = Array.isArray(req.body?.templates) ? req.body.templates : [];
  if (!templates.length) return res.json({ inserted: 0 });
  try {
    const inserted = [];
    for (const t of templates) {
      const { rows } = await pool.query(
        `INSERT INTO templates(name,type,content,header,footer,is_default,is_system) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [t.name, t.type || null, t.content || '', t.header || null, t.footer || null, !!t.is_default, !!t.is_system]
      );
      inserted.push(rows[0]);
    }
    res.status(201).json({ inserted: inserted.length });
  } catch(e){ console.error(e); next(new AppError(500,'Error sembrando plantillas','TEMPLATES_SEED_FAIL')); }
});

router.post('/', auth, requirePermission('administration','manage_templates'), audit('create','template', (req,r)=>r.locals?.createdId, (req)=>({ body: req.body })), async (req,res,next)=>{
  const { name, type, content, header, footer, is_default, is_system } = req.body || {};
  if (!name || !type || !content) return next(new AppError(400,'name, type y content requeridos','TEMPLATE_REQUIRED_FIELDS'));
  try {
    const { rows } = await pool.query(`INSERT INTO templates(name,type,content,header,footer,is_default,is_system) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [name, type, content, header||null, footer||null, !!is_default, !!is_system]);
    const created = rows[0];
    res.locals.createdId = created.id;
    res.status(201).json(created);
  } catch(e){ console.error(e); next(new AppError(500,'Error creando plantilla','TEMPLATE_CREATE_FAIL')); }
});

router.put('/:id', auth, requirePermission('administration','manage_templates'), audit('update','template', req=>req.params.id, (req)=>({ body: req.body })), async (req,res,next)=>{
  const fields = ['name','type','content','header','footer','is_default','is_system'];
  const sets = []; const vals = [];
  fields.forEach(f=>{ if(Object.prototype.hasOwnProperty.call(req.body,f)){ sets.push(`${f}=$${sets.length+1}`); vals.push(req.body[f]); } });
  if(!sets.length) return next(new AppError(400,'Nada para actualizar','NO_UPDATE_FIELDS'));
  vals.push(req.params.id);
  try {
    const { rows } = await pool.query(`UPDATE templates SET ${sets.join(', ')} WHERE id=$${vals.length} RETURNING *`, vals);
    if(!rows[0]) return next(new AppError(404,'Plantilla no encontrada','TEMPLATE_NOT_FOUND'));
    res.json(rows[0]);
  } catch(e){ console.error(e); next(new AppError(500,'Error actualizando plantilla','TEMPLATE_UPDATE_FAIL')); }
});

router.post('/:id/set-default', auth, requirePermission('administration','manage_templates'), async (req,res,next)=>{
  const id = req.params.id;
  try {
    const { rows } = await pool.query('SELECT * FROM templates WHERE id=$1', [id]);
    if (!rows[0]) return next(new AppError(404,'Plantilla no encontrada','TEMPLATE_NOT_FOUND'));
    const tpl = rows[0];
    await pool.query('UPDATE templates SET is_default=false WHERE type=$1 AND id<>$2', [tpl.type, id]);
    await pool.query('UPDATE templates SET is_default=true WHERE id=$1', [id]);
    const { rows: refreshed } = await pool.query('SELECT * FROM templates WHERE id=$1', [id]);
    res.json(refreshed[0]);
  } catch(e){ console.error(e); next(new AppError(500,'Error estableciendo predeterminada','TEMPLATE_SET_DEFAULT_FAIL')); }
});

router.delete('/:id', auth, requirePermission('administration','manage_templates'), audit('delete','template', req=>req.params.id), async (req,res,next)=>{
  try { const { rowCount } = await pool.query('DELETE FROM templates WHERE id=$1',[req.params.id]); if(!rowCount) return next(new AppError(404,'Plantilla no encontrada','TEMPLATE_NOT_FOUND')); res.status(204).send(); } catch(e){ console.error(e); next(new AppError(500,'Error eliminando plantilla','TEMPLATE_DELETE_FAIL')); }
});

module.exports = router;
