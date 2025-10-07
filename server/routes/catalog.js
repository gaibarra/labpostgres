const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { listParameters, findParameter, toResponse, normalizeKey, reloadCatalog, buildETag, catalog } = require('../catalog');

// Listado completo (paginar en futuro si crece mucho)
router.get('/catalog/parameters', requireAuth, requirePermission('studies','read'), (req,res)=>{
  const q = (req.query.q||'').toString().trim();
  const category = (req.query.category||'').toString().trim();
  const page = Math.max(1, parseInt(req.query.page,10) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize,10) || 50));
  let data = listParameters();
  if (q) {
    const nq = normalizeKey(q);
    data = data.filter(p=> normalizeKey(p.name).includes(nq) || normalizeKey(p.key).includes(nq));
  }
  if (category) {
    const nc = normalizeKey(category);
    data = data.filter(p=> (p.categories||[]).some(c=> normalizeKey(c) === nc));
  }
  const total = data.length;
  const start = (page-1)*pageSize;
  const slice = data.slice(start, start+pageSize);
  const etag = buildETag();
  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end();
  }
  res.set('ETag', etag).json({ count: slice.length, total, page, pageSize, items: slice });
});

// Obtener detalle normalizado (incluye rangos)
router.get('/catalog/parameters/:key', requireAuth, requirePermission('studies','read'), (req,res)=>{
  const { key } = req.params;
  const hit = findParameter(key);
  if (!hit) return res.status(404).json({ error:'not_found' });
  res.json({ parameter: toResponse(hit) });
});

// Categorías agregadas
router.get('/catalog/categories', requireAuth, requirePermission('studies','read'), (req,res)=>{
  const items = listParameters();
  const map = new Map();
  items.forEach(p => {
    (p.categories||['(Sin categoría)']).forEach(cat => {
      if (!map.has(cat)) map.set(cat,{ category: cat, count:0, parameters: [] });
      const entry = map.get(cat);
      entry.count++;
      if (entry.parameters.length < 25) entry.parameters.push({ key: p.key, name: p.name, unit: p.unit });
    });
  });
  const etag = buildETag();
  if (req.headers['if-none-match'] === etag) return res.status(304).end();
  res.set('ETag', etag).json({ categories: [...map.values()].sort((a,b)=> a.category.localeCompare(b.category,'es')) });
});

// Versión catálogo
router.get('/catalog/version', requireAuth, requirePermission('studies','read'), (req,res)=>{
  const etag = buildETag();
  if (req.headers['if-none-match'] === etag) return res.status(304).end();
  res.set('ETag', etag).json({ version: catalog.version, updatedAt: catalog.updatedAt, count: catalog.parameters.length, etag });
});

module.exports = router;
// Admin reload (requiere permiso de escritura sobre studies para simplificar)
router.post('/catalog/reload', requireAuth, requirePermission('studies','update'), (req,res)=>{
  const info = reloadCatalog();
  const etag = buildETag();
  res.set('ETag', etag).json({ reloaded:true, ...info, etag });
});