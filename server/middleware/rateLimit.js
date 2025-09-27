const rateLimit = require('express-rate-limit');

// Límite específico para endpoints de configuración (baja frecuencia esperada)
const configLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  limit: 30, // 30 operaciones cada 5 min por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many configuration updates, please slow down' }
});

module.exports = { configLimiter };
