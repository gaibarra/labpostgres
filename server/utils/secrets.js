// Utilidades de manejo/redacción de secretos
// Campos de secreto canónicos
const SECRET_FIELDS = ['openaiApiKey','whatsappApiKey','emailApiKey','telegramBotToken','deepseekKey','perplexityKey'];
const LEGACY_SECRET_FIELDS = ['openAIKey'];

// Redacta cualquier valor de campos secretos, anidado, devolviendo clon seguro
function redactSecrets(obj){
  if(!obj || typeof obj !== 'object') return obj;
  const all = [...SECRET_FIELDS, ...LEGACY_SECRET_FIELDS];
  if(Array.isArray(obj)) return obj.map(redactSecrets);
  const out = {};
  for(const [k,v] of Object.entries(obj)){
    if (v && typeof v === 'object') {
      out[k] = redactSecrets(v);
    } else if (all.includes(k)) {
      if (typeof v === 'string' && v) {
        out[k] = '[REDACTED]';
      } else if (v === null) {
        out[k] = null; // preservar null explícito
      } else {
        out[k] = '[REDACTED]';
      }
    } else {
      out[k] = v;
    }
  }
  return out;
}

module.exports = { redactSecrets, SECRET_FIELDS, LEGACY_SECRET_FIELDS };