const Activity = require('../models/Activity');
const Lead = require('../models/Lead');
const Customer = require('../models/Customer');
const Deal = require('../models/Deal');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const timeline = require('./timeline.service');
const { validateAssignee } = require('../utils/assignment');
const { ROLES, TIMELINE_ACTIONS: A } = require('../config/constants');
const { getAccessFilter } = require('../utils/access');
const { getPagination, getSort, getDateRange, escapeRegex, buildMeta } = require('../utils/queryHelper');

const SORTABLE_FIELDS = ['dueDate', 'createdAt', 'updatedAt', 'type', 'title', 'completedAt'];
const POPULATE = [
  { path: 'assignedTo', select: 'name email role' },
  { path: 'createdBy', select: 'name email' },
  { path: 'relatedId', select: 'name' },
];
const TIMELINE_ENTITIES = ['Lead', 'Customer', 'Deal'];
const RELATED_MODELS = { Lead, Customer, Deal };

// Related record must exist AND be accessible to the user (same role rules as everywhere else)
const checkRelated = async (relatedType, relatedId, user) => {
  if (!relatedType) return;
  if (relatedType === 'User') {
    if (!(await User.exists({ _id: relatedId }))) throw ApiError.notFound('Related user not found');
    return;
  }
  const access = await getAccessFilter(user);
  const found = await RELATED_MODELS[relatedType].exists({ $and: [{ _id: relatedId }, access] });
  if (!found) throw ApiError.notFound(`${relatedType} not found`);
};

// Executives work on their own activities; admins/managers may assign to executives
const resolveAssignee = async (assigneeId, user) => {
  if (!assigneeId || String(assigneeId) === String(user._id)) return user._id;
  if (user.role === ROLES.SALES_EXECUTIVE) {
    throw ApiError.forbidden('Sales executives can only create activities for themselves');
  }
  const assignee = await validateAssignee(assigneeId, user);
  return assignee._id;
};

// Writes an event on the related lead/customer/deal timeline
const logOnRelated = async (activity, action, user, extra = {}) => {
  if (!TIMELINE_ENTITIES.includes(activity.relatedType)) return;
  await timeline.log({
    action,
    entityType: activity.relatedType,
    entityId: activity.relatedId,
    performedBy: user._id,
    newValue: { activityId: activity._id, type: activity.type, title: activity.title, ...extra },
  });
};

const getAccessibleActivity = async (id, user) => {
  const access = await getAccessFilter(user);
  const activity = await Activity.findOne({ $and: [{ _id: id }, access] });
  if (!activity) throw ApiError.notFound('Activity not found');
  return activity;
};

const ensurePending = (activity) => {
  if (activity.status === 'Completed') throw ApiError.conflict('Completed activities cannot be modified');
};

const createActivity = async (data, user) => {
  await checkRelated(data.relatedType, data.relatedId, user);
  const assignedTo = await resolveAssignee(data.assignedTo, user);

  const isNote = data.type === 'Note';
  const activity = await Activity.create({
    ...data,
    assignedTo,
    createdBy: user._id,
    status: isNote ? 'Completed' : 'Pending', // a note is a record, not a task
    completedAt: isNote ? new Date() : undefined,
  });

  const action = isNote ? A.NOTE_ADDED : data.type === 'Follow-up' ? A.FOLLOW_UP_CREATED : A.ACTIVITY_CREATED;
  await logOnRelated(activity, action, user, activity.dueDate ? { dueDate: activity.dueDate } : {});

  return activity.populate(POPULATE);
};

// Translates Pending / Overdue / Completed into real MongoDB conditions
const statusConditions = (statuses) => {
  const now = new Date();
  return statuses.map((s) => {
    if (s === 'Completed') return { status: 'Completed' };
    if (s === 'Overdue') return { status: 'Pending', dueDate: { $lt: now } };
    return { status: 'Pending', $or: [{ dueDate: { $gte: now } }, { dueDate: null }] };
  });
};

const listActivities = async (query, user) => {
  const { page, limit, skip } = getPagination(query);
  const conditions = [await getAccessFilter(user)];

  if (query.type) conditions.push({ type: { $in: query.type } });
  if (query.status) conditions.push({ $or: statusConditions(query.status) });
  if (query.assignedTo) conditions.push({ assignedTo: query.assignedTo });
  if (query.relatedType) conditions.push({ relatedType: query.relatedType });
  if (query.relatedId) conditions.push({ relatedId: query.relatedId });

  const due = getDateRange(query.dueFrom, query.dueTo);
  if (due) conditions.push({ dueDate: due });
  const created = getDateRange(query.from, query.to);
  if (created) conditions.push({ createdAt: created });

  if (query.search) {
    const regex = new RegExp(escapeRegex(query.search), 'i');
    conditions.push({ $or: [{ title: regex }, { description: regex }] });
  }

  const filter = { $and: conditions };
  const sort = getSort(query.sort, SORTABLE_FIELDS, { dueDate: 1 }); // default: soonest due first

  const [activities, total] = await Promise.all([
    Activity.find(filter).sort(sort).skip(skip).limit(limit).populate(POPULATE),
    Activity.countDocuments(filter),
  ]);

  return { activities, meta: buildMeta(page, limit, total) };
};

const getActivity = async (id, user) => {
  const activity = await getAccessibleActivity(id, user);
  return activity.populate(POPULATE);
};

const updateActivity = async (id, data, user) => {
  const activity = await getAccessibleActivity(id, user);
  ensurePending(activity);

  if (data.assignedTo !== undefined) {
    data.assignedTo = await resolveAssignee(data.assignedTo, user);
  }

  Object.assign(activity, data);
  await activity.save();
  return activity.populate(POPULATE);
};

const completeActivity = async (id, { outcome } = {}, user) => {
  const activity = await getAccessibleActivity(id, user);
  if (activity.status === 'Completed') throw ApiError.conflict('Activity is already completed');

  const wasOverdue = activity.isOverdue;
  activity.status = 'Completed';
  activity.completedAt = new Date();
  if (outcome) activity.outcome = outcome;
  await activity.save();

  const action = activity.type === 'Follow-up' ? A.FOLLOW_UP_COMPLETED : A.ACTIVITY_COMPLETED;
  await logOnRelated(activity, action, user, { completedAt: activity.completedAt, wasOverdue, outcome });

  return activity.populate(POPULATE);
};

const deleteActivity = async (id, user) => {
  const activity = await getAccessibleActivity(id, user);

  if (user.role === ROLES.SALES_EXECUTIVE) {
    if (!activity.createdBy.equals(user._id)) {
      throw ApiError.forbidden('You can only delete activities you created');
    }
    ensurePending(activity);
  }

  await activity.deleteOne();
};

module.exports = {
  createActivity,
  listActivities,
  getActivity,
  updateActivity,
  completeActivity,
  deleteActivity,
  statusConditions,
};