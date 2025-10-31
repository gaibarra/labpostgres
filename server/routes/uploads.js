const express = require('express');
const fs = require('fs');
const path = require('path');
const auth = require('../middleware/auth');

// Lazy require multer only if available, fallback to 415 if missing
let multer;
try { multer = require('multer'); } catch (_) { multer = null; }

const router = express.Router();

// Resolve uploads directory from env or fallback to server/uploads (best to set UPLOADS_DIR in production)
function resolveUploadsDir() {
  const fromEnv = process.env.UPLOADS_DIR && process.env.UPLOADS_DIR.trim();
  return fromEnv || path.join(__dirname, '..', 'uploads');
}
function ensureUploadsDir() {
  const dir = resolveUploadsDir();
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (e) {
      // Bubble up so multer can surface a clean error instead of crashing the process
      throw new Error(`No se pudo crear el directorio de uploads: ${dir} (${e.code || e.message})`);
    }
  }
  return dir;
}

if (multer) {
  const storage = multer.diskStorage({
    destination: function (_req, _file, cb) {
      try {
        const dir = ensureUploadsDir();
        cb(null, dir);
      } catch (e) {
        cb(e);
      }
    },
    filename: function (req, file, cb) {
      const ext = path.extname(file.originalname || '.png');
      // Use tenant identifier if available to avoid collisions
      let tenantPart = 'default';
      try {
        tenantPart = (req.auth && req.auth.tenant_id) ? String(req.auth.tenant_id) : tenantPart;
      } catch (_) { /* ignore */ }
      const safeTenant = String(tenantPart).replace(/[^a-zA-Z0-9_-]/g,'_');
      const base = `lab_logo_${safeTenant}` + ext.toLowerCase();
      cb(null, base);
    }
  });
  const upload = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 } // 2MB
  });

  // Requiere autenticación (para identificar tenant si aplica)
  router.post('/logo', auth, upload.any(), (req, res) => {
    const file = Array.isArray(req.files) && req.files.length ? req.files[0] : null;
    if (!file) return res.status(400).json({ error: 'Archivo no recibido', code: 'NO_FILE' });
    // Validar mimetype permitido
    const mt = (file.mimetype || '').toLowerCase();
    const allowed = ['image/png', 'image/x-png', 'image/jpeg', 'image/svg+xml'];
    if (!allowed.includes(mt)) {
      try { fs.unlinkSync(file.path); } catch (_) { /* ignore */ }
      return res.status(415).json({ error: 'Formato no soportado', code: 'UNSUPPORTED_TYPE' });
    }
    // Asegurar extensión acorde
    const ext = (mt.includes('svg')) ? '.svg' : (mt.includes('jpeg') ? '.jpg' : '.png');
    let destDir;
    try { destDir = ensureUploadsDir(); } catch (e) {
      // El middleware de multer ya subió el archivo temporal, eliminarlo y responder 500 clara
      try { if (file && file.path) fs.unlinkSync(file.path); } catch (_) {}
      return res.status(500).json({ error: e.message, code: 'UPLOADS_DIR_UNAVAILABLE' });
    }
    let tenantPart = 'default';
  try { tenantPart = (req.auth && (req.auth.tenant_id || req.auth.tenantId)) ? String(req.auth.tenant_id || req.auth.tenantId) : tenantPart; } catch (_) {}
    const safeTenant = String(tenantPart).replace(/[^a-zA-Z0-9_-]/g,'_');
    const finalName = `lab_logo_${safeTenant}${ext}`;
    const finalPath = path.join(destDir, finalName);
    try { fs.renameSync(file.path, finalPath); } catch (e) {
      return res.status(500).json({ error: 'No se pudo guardar el archivo', code: 'SAVE_FAILED' });
    }
    const publicUrl = `/uploads/${finalName}`;
    return res.json({ url: publicUrl });
  });
} else {
  router.post('/logo', (_req, res) => {
    return res.status(415).json({ error: 'Subida no disponible: falta dependencia multer', code: 'UPLOADS_UNAVAILABLE' });
  });
}

module.exports = router;
