const dealService = require('../services/deal.service');
const sendResponse = require('../utils/apiResponse');

const createDeal = async (req, res) => {
  const deal = await dealService.createDeal(req.body, req.user);
  sendResponse(res, 201, 'Deal created successfully', { deal });
};

const listDeals = async (req, res) => {
  const { deals, meta } = await dealService.listDeals(req.validated.query, req.user);
  sendResponse(res, 200, 'Deals fetched successfully', { deals }, meta);
};

const getDeal = async (req, res) => {
  const deal = await dealService.getDeal(req.validated.params.id, req.user);
  sendResponse(res, 200, 'Deal fetched successfully', { deal });
};

const updateDeal = async (req, res) => {
  const deal = await dealService.updateDeal(req.validated.params.id, req.body, req.user);
  sendResponse(res, 200, 'Deal updated successfully', { deal });
};

const changeStage = async (req, res) => {
  const deal = await dealService.changeStage(req.validated.params.id, req.body, req.user);
  sendResponse(res, 200, `Deal moved to ${deal.stage}`, { deal });
};

const assignDeal = async (req, res) => {
  const deal = await dealService.assignDeal(req.validated.params.id, req.body.assignedTo, req.user);
  sendResponse(res, 200, 'Deal assigned successfully', { deal });
};

const deleteDeal = async (req, res) => {
  await dealService.deleteDeal(req.validated.params.id, req.user);
  sendResponse(res, 200, 'Deal deleted successfully');
};

const getTimeline = async (req, res) => {
  const { events, meta } = await dealService.getDealTimeline(req.validated.params.id, req.user, req.query);
  sendResponse(res, 200, 'Deal timeline fetched successfully', { events }, meta);
};

module.exports = { createDeal, listDeals, getDeal, updateDeal, changeStage, assignDeal, deleteDeal, getTimeline };