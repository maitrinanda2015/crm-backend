const authService = require('../services/auth.service');
const sendResponse = require('../utils/apiResponse');
const { refreshCookieOptions, refreshCookieBase } = require('../utils/token');

const register = async (req, res) => {
  const user = await authService.register(req.body);
  sendResponse(res, 201, 'User registered successfully', { user });
};

const login = async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.login(req.body);
  res.cookie('refreshToken', refreshToken, refreshCookieOptions());
  sendResponse(res, 200, 'Login successful', { user, accessToken });
};

const refresh = async (req, res) => {
  const accessToken = await authService.refresh(req.cookies?.refreshToken);
  sendResponse(res, 200, 'Access token refreshed', { accessToken });
};

const logout = async (req, res) => {
  await authService.logout(req.user._id);
  res.clearCookie('refreshToken', refreshCookieBase());
  sendResponse(res, 200, 'Logged out successfully');
};

const me = async (req, res) => {
  sendResponse(res, 200, 'Profile fetched successfully', { user: req.user });
};

module.exports = { register, login, refresh, logout, me };