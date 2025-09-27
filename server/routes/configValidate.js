const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { SECRET_FIELDS } = require('../utils/secrets');
const router = express.Router();

// Validaciones simples por tipo de campo (sin llamadas externas)
function validateFormat(field, value){
  if (typeof value !== 'string' || !value.trim()) return 'Valor vacío';
  switch(field){
    case 'openaiApiKey':
      // Ejemplos: sk-xxxxx (OpenAI), opcionalmente mas largo; Deepseek, etc. Aceptar prefijos sk- o ds- pero exigir longitud mínima.
      if (!/^(sk|ds)-[A-Za-z0-9-_]{20,}$/.test(value)) return 'Formato inválido para openaiApiKey';
      return null;
    case 'whatsappApiKey':
      if (value.length < 10) return 'Demasiado corta';
      return null;
    default:
      if (value.length < 8) return 'Longitud mínima 8';
      return null;
  }
}

router.post('/integrations/validate', requireAuth, requirePermission('settings','update'), (req,res)=>{
  const field = req.query.field;
  if (!field || !SECRET_FIELDS.includes(field)) {
    return res.status(400).json({ error: 'Campo no soportado' });
  }
  const { value } = req.body || {};
  const err = validateFormat(field, value);
  if (err) return res.status(400).json({ ok: false, field, error: err });
  return res.json({ ok: true, field });
});

module.exports = router;
