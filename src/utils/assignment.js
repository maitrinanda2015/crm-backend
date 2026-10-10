const User = require('../models/User');
const ApiError = require('./ApiError');
const { ROLES } = require('../config/constants');

// Checks that `user` may assign work to `assigneeId`
const validateAssignee = async (assigneeId, user) => {
  const assignee = await User.findById(assigneeId).select('name email role isActive manager');
  if (!assignee) throw ApiError.badRequest('Assignee not found');
  if (!assignee.isActive) throw ApiError.badRequest('Cannot assign to an inactive user');
  if (assignee.role !== ROLES.SALES_EXECUTIVE) {
    throw ApiError.badRequest('Records can only be assigned to sales executives');
  }
  if (user.role === ROLES.SALES_MANAGER && !assignee.manager?.equals(user._id)) {
    throw ApiError.forbidden('You can only assign to members of your own team');
  }
  return assignee;
};

module.exports = { validateAssignee };