const crypto = require('crypto');

/**
 * Serializa de forma determinista un objeto/array JSON:
 * - Ordena claves de objetos alfabéticamente de manera recursiva.
 * - Normaliza números (sin ceros sobrantes) y strings tal cual.
 * - Convierte null/boolean igual.
 */
function canonicalize(value){
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const out = {};
  Object.keys(value).sort().forEach(k=>{ out[k] = canonicalize(value[k]); });
  return out;
}

function stableStringify(value){
  const canon = canonicalize(value);
  return JSON.stringify(canon);
}

function hashCatalog(payload){
  const str = stableStringify(payload);
  return crypto.createHash('sha256').update(str,'utf8').digest('hex');
}

module.exports = { hashCatalog, stableStringify, canonicalize };
