const validator = require('validator');

function sanitizeBody(fields) {
  return (req, _res, next) => {
    if (!req.body) return next();
    fields.forEach(f => {
      if (typeof req.body[f] === 'string') {
        let value = req.body[f].trim();
        if (f.includes('email')) value = validator.normalizeEmail(value) || value;
        if (f.includes('phone')) value = value.replace(/[^0-9+]/g, '');
        req.body[f] = validator.escape(value);
      }
    });
    next();
  };
}

module.exports = { sanitizeBody };
