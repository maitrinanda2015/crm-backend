const settingsService = require('../services/settings.service');
const sendResponse = require('../utils/apiResponse');

const getSettings = async (req, res) => {
  const settings = await settingsService.getSettings();
  sendResponse(res, 200, 'Settings fetched successfully', { settings });
};

const updateSettings = async (req, res) => {
  const settings = await settingsService.updateSettings(req.body, req.user);
  sendResponse(res, 200, 'Settings updated successfully', { settings });
};

module.exports = { getSettings, updateSettings };