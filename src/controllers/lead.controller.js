const leadService = require('../services/lead.service');
const conversionService = require('../services/conversion.service');
const sendResponse = require('../utils/apiResponse');

const createLead = async (req, res) => {
  const lead = await leadService.createLead(req.body, req.user);
  sendResponse(res, 201, 'Lead created successfully', { lead });
};

const listLeads = async (req, res) => {
  const { leads, meta } = await leadService.listLeads(req.validated.query, req.user);
  sendResponse(res, 200, 'Leads fetched successfully', { leads }, meta);
};

const getLead = async (req, res) => {
  const lead = await leadService.getLead(req.validated.params.id, req.user);
  sendResponse(res, 200, 'Lead fetched successfully', { lead });
};

const updateLead = async (req, res) => {
  const lead = await leadService.updateLead(req.validated.params.id, req.body, req.user);
  sendResponse(res, 200, 'Lead updated successfully', { lead });
};

const updateStatus = async (req, res) => {
  const lead = await leadService.updateStatus(req.validated.params.id, req.body, req.user);
  sendResponse(res, 200, 'Lead status updated successfully', { lead });
};

const assignLead = async (req, res) => {
  const lead = await leadService.assignLead(req.validated.params.id, req.body.assignedTo, req.user);
  sendResponse(res, 200, 'Lead assigned successfully', { lead });
};

const deleteLead = async (req, res) => {
  await leadService.deleteLead(req.validated.params.id, req.user);
  sendResponse(res, 200, 'Lead deleted successfully');
};

const getTimeline = async (req, res) => {
  const { events, meta } = await leadService.getLeadTimeline(req.validated.params.id, req.user, req.query);
  sendResponse(res, 200, 'Lead timeline fetched successfully', { events }, meta);
};

const convertLead = async (req, res) => {
  const result = await conversionService.convertLead(req.validated.params.id, req.body, req.user);
  sendResponse(res, 201, 'Lead converted successfully', result);
};

module.exports = {
  createLead,
  listLeads,
  getLead,
  updateLead,
  updateStatus,
  assignLead,
  deleteLead,
  getTimeline,
  convertLead,
};