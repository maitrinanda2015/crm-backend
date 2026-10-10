const jwt = require('jsonwebtoken');

const signAccessToken = (user) =>
  jwt.sign(
    { sub: user._id.toString(), role: user.role, tv: user.tokenVersion },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' }
  );

const signRefreshToken = (user) =>
  jwt.sign(
    { sub: user._id.toString(), tv: user.tokenVersion },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );

const isProd = () => process.env.NODE_ENV === 'production';

// Base cookie options (also used when clearing the cookie)
const refreshCookieBase = () => ({
  httpOnly: true, // JS in the browser cannot read it
  secure: isProd(), // HTTPS only in production
  sameSite: isProd() ? 'none' : 'lax',
  path: '/api/auth', // only sent to auth routes
});

const refreshCookieOptions = () => ({
  ...refreshCookieBase(),
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
});

module.exports = { signAccessToken, signRefreshToken, refreshCookieBase, refreshCookieOptions };