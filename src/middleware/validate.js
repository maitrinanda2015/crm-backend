const ApiError = require('../utils/ApiError');

// schemas = { body?: zodSchema, query?: zodSchema, params?: zodSchema }
const validate = (schemas) => (req, res, next) => {
  const errors = [];
  req.validated = {};

  for (const key of ['params', 'query', 'body']) {
    if (!schemas[key]) continue;
    const result = schemas[key].safeParse(req[key] ?? {});
    if (!result.success) {
      result.error.issues.forEach((issue) =>
        errors.push({ field: issue.path.join('.') || key, message: issue.message })
      );
    } else {
      req.validated[key] = result.data;
    }
  }

  if (errors.length) return next(ApiError.badRequest('Validation failed', errors));

  // Express 5 doesn't allow overwriting req.query, so cleaned data lives in req.validated
  if (req.validated.body) req.body = req.validated.body;
  next();
};

module.exports = validate;