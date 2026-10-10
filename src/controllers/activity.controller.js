const activityService = require('../services/activity.service');
const sendResponse = require('../utils/apiResponse');

const createActivity = async (req, res) => {
  const activity = await activityService.createActivity(req.body, req.user);
  sendResponse(res, 201, 'Activity created successfully', { activity });
};

const listActivities = async (req, res) => {
  const { activities, meta } = await activityService.listActivities(req.validated.query, req.user);
  sendResponse(res, 200, 'Activities fetched successfully', { activities }, meta);
};

const getActivity = async (req, res) => {
  const activity = await activityService.getActivity(req.validated.params.id, req.user);
  sendResponse(res, 200, 'Activity fetched successfully', { activity });
};

const updateActivity = async (req, res) => {
  const activity = await activityService.updateActivity(req.validated.params.id, req.body, req.user);
  sendResponse(res, 200, 'Activity updated successfully', { activity });
};

const completeActivity = async (req, res) => {
  const activity = await activityService.completeActivity(req.validated.params.id, req.body || {}, req.user);
  sendResponse(res, 200, 'Activity marked as completed', { activity });
};

const deleteActivity = async (req, res) => {
  await activityService.deleteActivity(req.validated.params.id, req.user);
  sendResponse(res, 200, 'Activity deleted successfully');
};

module.exports = { createActivity, listActivities, getActivity, updateActivity, completeActivity, deleteActivity };