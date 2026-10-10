const userService = require('../services/user.service');
const sendResponse = require('../utils/apiResponse');

const createUser = async (req, res) => {
  const user = await userService.createUser(req.body);
  sendResponse(res, 201, 'User created successfully', { user });
};

const listUsers = async (req, res) => {
  const { users, meta } = await userService.listUsers(req.validated.query);
  sendResponse(res, 200, 'Users fetched successfully', { users }, meta);
};

const getUser = async (req, res) => {
  const user = await userService.getUserById(req.validated.params.id);
  sendResponse(res, 200, 'User fetched successfully', { user });
};

const updateUser = async (req, res) => {
  const user = await userService.updateUser(req.validated.params.id, req.body, req.user);
  sendResponse(res, 200, 'User updated successfully', { user });
};

const updateStatus = async (req, res) => {
  const user = await userService.updateStatus(req.validated.params.id, req.body.isActive, req.user);
  sendResponse(res, 200, `User ${user.isActive ? 'activated' : 'deactivated'} successfully`, { user });
};

const deleteUser = async (req, res) => {
  await userService.deleteUser(req.validated.params.id, req.user);
  sendResponse(res, 200, 'User deleted successfully');
};

const getTeam = async (req, res) => {
  const { users, meta } = await userService.getTeam(req.user, req.validated.query);
  sendResponse(res, 200, 'Team fetched successfully', { users }, meta);
};

module.exports = { createUser, listUsers, getUser, updateUser, updateStatus, deleteUser, getTeam };