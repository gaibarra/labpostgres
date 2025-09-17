const crypto = require('node:crypto');

function requestId() {
  return (req, _res, next) => {
    req.id = req.headers['x-request-id'] || crypto.randomUUID();
    next();
  };
}
module.exports = requestId;
