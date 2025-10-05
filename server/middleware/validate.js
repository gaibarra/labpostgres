const { ZodError } = require('zod');
const { AppError } = require('../utils/errors');

function validate(schema) {
  return (req, res, next) => {
    try {
      // Coerción ligera: convertir strings numéricas en body a números para campos esperados
      if (req.body && typeof req.body === 'object') {
        const numericFields = ['subtotal','descuento','anticipo','total_price','price','processing_time_hours'];
        numericFields.forEach(f=>{
          if (Object.prototype.hasOwnProperty.call(req.body,f) && typeof req.body[f] === 'string' && req.body[f].trim() !== '') {
            const n = Number(req.body[f]);
            if (!Number.isNaN(n)) req.body[f] = n; // deja valor original si NaN
          }
        });
      }
      const data = { body: req.body, query: req.query, params: req.params };
      const parsed = schema.parse(data);
      // Overwrite only provided sections
      if (parsed.body) req.body = parsed.body;
      if (parsed.query) req.query = parsed.query;
      if (parsed.params) req.params = parsed.params;
      next();
    } catch (e) {
      if (e instanceof ZodError) {
        return next(new AppError(400, 'Validación fallida', 'VALIDATION_ERROR', e.issues));
      }
      next(new AppError(500,'Error validando','VALIDATION_INTERNAL'));
    }
  };
}

module.exports = { validate };
