const ApiError = require('../utils/ApiError');

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let error = err;

  // Convert known library errors into ApiError
  if (!(error instanceof ApiError)) {
    if (err.name === 'CastError') {
      error = ApiError.badRequest(`Invalid ${err.path}: ${err.value}`);
    } else if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
      error = ApiError.badRequest('Validation failed', errors);
    } else if (err.code === 11000) {
      const field = Object.keys(err.keyValue || {})[0] || 'field';
      error = ApiError.conflict(`${field} already exists`);
    } else if (err.name === 'JsonWebTokenError') {
      error = ApiError.unauthorized('Invalid token');
    } else if (err.name === 'TokenExpiredError') {
      error = ApiError.unauthorized('Token expired, please log in again');
    } else if (err.type === 'entity.parse.failed') {
      error = ApiError.badRequest('Invalid JSON in request body');
    } else {
      error = new ApiError(500, 'Something went wrong. Please try again later.');
      error.isOperational = false;
    }
  }

  // Log unexpected errors on the server (never send details to the client)
  if (!error.isOperational) console.error('UNEXPECTED ERROR:', err);

  const body = { success: false, message: error.message };
  if (error.errors) body.errors = error.errors;
  if (process.env.NODE_ENV === 'development' && !error.isOperational) body.stack = err.stack;

  res.status(error.statusCode || 500).json(body);
};

module.exports = errorHandler;