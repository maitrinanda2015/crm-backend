const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');

// Checks the access token and loads the logged-in user into req.user
const protect = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw ApiError.unauthorized('Not authenticated. Please log in.');

  const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  const user = await User.findById(payload.sub).select('+tokenVersion');

  if (!user) throw ApiError.unauthorized('User no longer exists');
  if (!user.isActive) throw ApiError.unauthorized('Your account is deactivated');
  if (user.tokenVersion !== payload.tv) throw ApiError.unauthorized('Session expired. Please log in again.');

  req.user = user;
  next();
};

// Usage: authorize('admin', 'sales_manager')
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) throw ApiError.forbidden();
  next();
};

module.exports = { protect, authorize };