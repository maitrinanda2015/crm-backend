const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { ROLES } = require('../config/constants');
const { signAccessToken, signRefreshToken } = require('../utils/token');

const register = async ({ name, email, phone, password }) => {
  if (await User.exists({ email })) throw ApiError.conflict('Email is already registered');

  // Bootstrap: the very first user becomes admin; everyone else is a sales executive
  const isFirstUser = (await User.estimatedDocumentCount()) === 0;
  const role = isFirstUser ? ROLES.ADMIN : ROLES.SALES_EXECUTIVE;

  return User.create({ name, email, phone, password, role });
};

const login = async ({ email, password }) => {
  const user = await User.findOne({ email }).select('+password +tokenVersion');

  // Same message for both cases so attackers can't discover which emails exist
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Invalid email or password');
  }
  if (!user.isActive) throw ApiError.forbidden('Your account is deactivated. Contact admin.');

  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });

  return {
    user,
    accessToken: signAccessToken(user),
    refreshToken: signRefreshToken(user),
  };
};

const refresh = async (refreshToken) => {
  if (!refreshToken) throw ApiError.unauthorized('Refresh token missing. Please log in.');

  const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  const user = await User.findById(payload.sub).select('+tokenVersion');

  if (!user || !user.isActive || user.tokenVersion !== payload.tv) {
    throw ApiError.unauthorized('Session expired. Please log in again.');
  }
  return signAccessToken(user);
};

const logout = async (userId) => {
  // Invalidates every access + refresh token issued to this user
  await User.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } });
};

module.exports = { register, login, refresh, logout };