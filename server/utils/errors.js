class AppError extends Error {
  constructor(status, message, code = 'ERR_GENERIC', details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function errorResponse(err) {
  return {
    error: err.message,
    code: err.code || 'ERR_GENERIC',
    details: err.details || undefined
  };
}

module.exports = { AppError, errorResponse };

