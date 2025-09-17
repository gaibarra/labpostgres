const pino = require('pino');
const pinoHttp = require('pino-http');
const crypto = require('node:crypto');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// Note: pino redaction does not support 'res.headers.set-cookie'; use wildcard.
const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => req.id || crypto.randomUUID(),
  redact: {
    paths: ['req.headers.authorization', 'res.headers["set-cookie"]', 'req.headers.cookie'],
    remove: true
  }
});

module.exports = { logger, httpLogger };
