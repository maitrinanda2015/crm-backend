const mongoose = require('mongoose');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { ROLES } = require('../config/constants');
const { getPagination, getSort, getDateRange, escapeRegex, buildMeta } = require('../utils/queryHelper');

const SORTABLE_FIELDS = ['name', 'email', 'role', 'isActive', 'createdAt', 'updatedAt', 'lastLoginAt'];

// The manager being assigned must exist, be active and be a sales manager
const validateManager = async (managerId) => {
  const manager = await User.findById(managerId).select('role isActive');
  if (!manager) throw ApiError.badRequest('Manager not found');
  if (manager.role !== ROLES.SALES_MANAGER) {
    throw ApiError.badRequest('Assigned manager must have the sales_manager role');
  }
  if (!manager.isActive) throw ApiError.badRequest('Cannot assign an inactive manager');
};

// Counts CRM records still assigned to a user (models are checked only once they exist)
const countLinkedRecords = async (userId) => {
  let total = 0;
  for (const name of ['Lead', 'Customer', 'Deal', 'Activity']) {
    const Model = mongoose.models[name];
    if (Model) total += await Model.countDocuments({ assignedTo: userId });
  }
  return total;
};

const createUser = async (data) => {
  if (await User.exists({ email: data.email })) throw ApiError.conflict('Email is already registered');

  if (data.manager) {
    if (data.role !== ROLES.SALES_EXECUTIVE) {
      throw ApiError.badRequest('Only sales executives can have a manager');
    }
    await validateManager(data.manager);
  }

  const user = await User.create(data);
  return user.populate('manager', 'name email');
};

const listUsers = async (query) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};

  if (query.search) {
    const regex = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [{ name: regex }, { email: regex }];
  }
  if (query.role) filter.role = query.role;
  if (query.isActive !== undefined) filter.isActive = query.isActive;
  if (query.manager) filter.manager = query.manager;

  const createdAt = getDateRange(query.from, query.to);
  if (createdAt) filter.createdAt = createdAt;

  const sort = getSort(query.sort, SORTABLE_FIELDS);

  // Run data + count queries in parallel
  const [users, total] = await Promise.all([
    User.find(filter).sort(sort).skip(skip).limit(limit).populate('manager', 'name email'),
    User.countDocuments(filter),
  ]);

  return { users, meta: buildMeta(page, limit, total) };
};

const getUserById = async (id) => {
  const user = await User.findById(id).populate('manager', 'name email');
  if (!user) throw ApiError.notFound('User not found');
  return user;
};

const updateUser = async (id, data, currentUser) => {
  const user = await User.findById(id).select('+tokenVersion');
  if (!user) throw ApiError.notFound('User not found');

  const isSelf = user._id.equals(currentUser._id);
  if (isSelf && data.role && data.role !== user.role) {
    throw ApiError.forbidden('You cannot change your own role');
  }

  if (data.email && data.email !== user.email) {
    if (await User.exists({ email: data.email, _id: { $ne: user._id } })) {
      throw ApiError.conflict('Email is already registered');
    }
  }

  const newRole = data.role ?? user.role;

  // A manager with team members cannot be demoted
  if (user.role === ROLES.SALES_MANAGER && newRole !== ROLES.SALES_MANAGER) {
    const teamCount = await User.countDocuments({ manager: user._id });
    if (teamCount) {
      throw ApiError.conflict(
        `This manager has ${teamCount} team member(s). Reassign them before changing the role.`
      );
    }
  }

  // Only sales executives can have a manager
  if (newRole !== ROLES.SALES_EXECUTIVE) {
    if (data.manager) throw ApiError.badRequest('Only sales executives can have a manager');
    data.manager = null;
  } else if (data.manager) {
    await validateManager(data.manager);
  }

  Object.assign(user, data);
  if (data.password) user.tokenVersion += 1; // password reset -> force re-login

  await user.save(); // pre-save hook hashes the new password
  return user.populate('manager', 'name email');
};

const updateStatus = async (id, isActive, currentUser) => {
  if (currentUser._id.equals(id)) throw ApiError.forbidden('You cannot change your own status');

  const user = await User.findById(id).select('+tokenVersion');
  if (!user) throw ApiError.notFound('User not found');

  user.isActive = isActive;
  if (!isActive) user.tokenVersion += 1; // deactivated -> logged out immediately
  await user.save();
  return user;
};

const deleteUser = async (id, currentUser) => {
  if (currentUser._id.equals(id)) throw ApiError.forbidden('You cannot delete your own account');

  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('User not found');

  if (user.role === ROLES.SALES_MANAGER && (await User.exists({ manager: user._id }))) {
    throw ApiError.conflict('This manager still has team members. Reassign them first.');
  }

  const linked = await countLinkedRecords(user._id);
  if (linked > 0) {
    throw ApiError.conflict(
      `User has ${linked} assigned CRM record(s). Reassign them or deactivate the user instead.`
    );
  }

  await user.deleteOne();
};

// Manager -> own team; Admin -> all sales executives
const getTeam = async (currentUser, query) => {
  const teamQuery = { ...query, role: ROLES.SALES_EXECUTIVE };
  if (currentUser.role === ROLES.SALES_MANAGER) teamQuery.manager = currentUser._id;
  return listUsers(teamQuery);
};

module.exports = { createUser, listUsers, getUserById, updateUser, updateStatus, deleteUser, getTeam };