const dashboardService = require('../services/dashboard.service');
const sendResponse = require('../utils/apiResponse');

const getStats = async (req, res) => {
  const stats = await dashboardService.getStats(req.user, req.validated.query);
  sendResponse(res, 200, 'Dashboard stats fetched successfully', stats);
};

const getPipeline = async (req, res) => {
  const pipeline = await dashboardService.getPipeline(req.user, req.validated.query);
  sendResponse(res, 200, 'Sales pipeline fetched successfully', pipeline);
};

const getTeamPerformance = async (req, res) => {
  const performance = await dashboardService.getTeamPerformance(req.user, req.validated.query);
  sendResponse(res, 200, 'Team performance fetched successfully', performance);
};

module.exports = { getStats, getPipeline, getTeamPerformance };