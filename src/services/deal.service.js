const Deal = require('../models/Deal');
const Lead = require('../models/Lead');
const Customer = require('../models/Customer');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const timeline = require('./timeline.service');
const { validateAssignee } = require('../utils/assignment');
const { getAccessibleCustomer } = require('./customer.service');
const settingsService = require('./settings.service');
const { ROLES, TIMELINE_ACTIONS: A } = require('../config/constants');
const { CLOSED_STAGES } = require('../validators/deal.validator');
const { getAccessFilter } = require('../utils/access');
const { getPagination, getSort, getDateRange, escapeRegex, buildMeta } = require('../utils/queryHelper');

const SORTABLE_FIELDS = [
  'name', 'value', 'probability', 'expectedRevenue', 'expectedCloseDate', 'stage', 'createdAt', 'updatedAt',
];
const POPULATE = [
  { path: 'customer', select: 'name email company status' },
  { path: 'lead', select: 'name status' },
  { path: 'assignedTo', select: 'name email role' },
  { path: 'createdBy', select: 'name email' },
];

const userRef = (u) => (u ? { id: u._id, name: u.name } : null);
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const getAccessibleDeal = async (id, user) => {
  const access = await getAccessFilter(user);
  const deal = await Deal.findOne({ $and: [{ _id: id }, access] });
  if (!deal) throw ApiError.notFound('Deal not found');
  return deal;
};

const ensureOpen = (deal) => {
  if (CLOSED_STAGES.includes(deal.stage)) {
    throw ApiError.conflict(`This deal is ${deal.stage} (closed) and cannot be modified`);
  }
};

const createDeal = async (data, user) => {
  // Customer must exist AND be accessible to this user
  const customer = await getAccessibleCustomer(data.customer, user);
  if (customer.status !== 'Active') throw ApiError.badRequest('Cannot create a deal for an inactive customer');

  let assignedTo;
  if (user.role === ROLES.SALES_EXECUTIVE) {
    assignedTo = user._id;
  } else {
    assignedTo = data.assignedTo || customer.assignedTo; // default: customer's owner
    await validateAssignee(assignedTo, user);
  }

  // Default probability comes from the CRM configuration (admin-managed settings)
  const probability = data.probability ?? (await settingsService.getStageProbability(data.stage || 'Qualification'));

  const deal = await Deal.create({
    ...data,
    probability,
    lead: customer.lead || null, // keep the Lead -> Customer -> Deal chain
    assignedTo,
    createdBy: user._id,
  });

  await timeline.log({
    action: A.DEAL_CREATED,
    entityType: 'Deal',
    entityId: deal._id,
    performedBy: user._id,
    newValue: {
      name: deal.name,
      value: deal.value,
      stage: deal.stage,
      probability: deal.probability,
      expectedRevenue: deal.expectedRevenue,
    },
  });

  return deal.populate(POPULATE);
};

const listDeals = async (query, user) => {
  const { page, limit, skip } = getPagination(query);
  const access = await getAccessFilter(user);
  const filter = {};

  if (query.stage) filter.stage = { $in: query.stage };
  if (query.status) filter.status = { $in: query.status };
  if (query.assignedTo) filter.assignedTo = query.assignedTo;
  if (query.customer) filter.customer = query.customer;

  if (query.minValue !== undefined || query.maxValue !== undefined) {
    filter.value = {};
    if (query.minValue !== undefined) filter.value.$gte = query.minValue;
    if (query.maxValue !== undefined) filter.value.$lte = query.maxValue;
  }

  const closeRange = getDateRange(query.closeFrom, query.closeTo);
  if (closeRange) filter.expectedCloseDate = closeRange;

  const createdAt = getDateRange(query.from, query.to);
  if (createdAt) filter.createdAt = createdAt;

  if (query.search) filter.name = new RegExp(escapeRegex(query.search), 'i');

  const finalFilter = { $and: [access, filter] };
  const sort = getSort(query.sort, SORTABLE_FIELDS);

  const [deals, total] = await Promise.all([
    Deal.find(finalFilter).sort(sort).skip(skip).limit(limit).populate(POPULATE),
    Deal.countDocuments(finalFilter),
  ]);

  return { deals, meta: buildMeta(page, limit, total) };
};

const getDeal = async (id, user) => {
  const deal = await getAccessibleDeal(id, user);
  return deal.populate(POPULATE);
};

const updateDeal = async (id, data, user) => {
  const deal = await getAccessibleDeal(id, user);
  ensureOpen(deal);

  const previousValue = {};
  const newValue = {};
  for (const [key, value] of Object.entries(data)) {
    if (!same(deal[key], value)) {
      previousValue[key] = deal[key] ?? null;
      newValue[key] = value;
    }
  }
  if (Object.keys(newValue).length === 0) return deal.populate(POPULATE);

  const oldRevenue = deal.expectedRevenue;
  Object.assign(deal, data);
  await deal.save(); // pre-validate hook recalculates expectedRevenue

  if (deal.expectedRevenue !== oldRevenue) {
    previousValue.expectedRevenue = oldRevenue;
    newValue.expectedRevenue = deal.expectedRevenue;
  }

  await timeline.log({
    action: A.DEAL_UPDATED,
    entityType: 'Deal',
    entityId: deal._id,
    performedBy: user._id,
    previousValue,
    newValue,
  });

  return deal.populate(POPULATE);
};

const changeStage = async (id, { stage, probability, lostReason, reason }, user) => {
  const deal = await getAccessibleDeal(id, user);
  if (deal.stage === stage) throw ApiError.badRequest(`Deal is already in ${stage}`);

  // Closed deals cannot freely move back to an active stage
  if (CLOSED_STAGES.includes(deal.stage)) {
    if (user.role !== ROLES.ADMIN) {
      throw ApiError.conflict(`This deal is already ${deal.stage}. Closed deals cannot be moved to another stage.`);
    }
    if (CLOSED_STAGES.includes(stage)) {
      throw ApiError.badRequest('A closed deal can only be reopened to an active stage');
    }
    if (!reason) throw ApiError.badRequest('A reason is required to reopen a closed deal');
  }

  // A Won deal must have valid information
  if (stage === 'Won') {
    const customer = await Customer.findById(deal.customer).select('status');
    if (!customer) throw ApiError.badRequest('Deal does not have a valid customer');
    if (customer.status !== 'Active') throw ApiError.badRequest('Cannot win a deal for an inactive customer');
    if (!(deal.value > 0)) throw ApiError.badRequest('Deal value must be greater than zero to mark it Won');
  }

  const previous = { stage: deal.stage, probability: deal.probability, expectedRevenue: deal.expectedRevenue };

  deal.stage = stage;
  if (CLOSED_STAGES.includes(stage)) {
    deal.closedAt = new Date();
    deal.lostReason = stage === 'Lost' ? lostReason : undefined;
  } else {
    deal.closedAt = undefined;
    deal.lostReason = undefined;
    deal.probability = probability ?? (await settingsService.getStageProbability(stage)); // from CRM settings
  }
  await deal.save(); // pre-validate hook sets probability for Won/Lost + recalculates revenue

  await timeline.log({
    action: A.DEAL_STAGE_CHANGED,
    entityType: 'Deal',
    entityId: deal._id,
    performedBy: user._id,
    previousValue: previous,
    newValue: {
      stage: deal.stage,
      probability: deal.probability,
      expectedRevenue: deal.expectedRevenue,
      ...(reason && { reopenReason: reason }),
    },
  });

  if (stage === 'Won' || stage === 'Lost') {
    await timeline.log({
      action: stage === 'Won' ? A.DEAL_WON : A.DEAL_LOST,
      entityType: 'Deal',
      entityId: deal._id,
      performedBy: user._id,
      newValue: stage === 'Won' ? { value: deal.value, closedAt: deal.closedAt } : { lostReason },
    });
  }

  return deal.populate(POPULATE);
};

const assignDeal = async (id, assigneeId, user) => {
  const deal = await getAccessibleDeal(id, user);
  ensureOpen(deal);

  const assignee = await validateAssignee(assigneeId, user);
  if (deal.assignedTo?.equals(assignee._id)) throw ApiError.badRequest('Deal is already assigned to this user');

  const previousUser = await User.findById(deal.assignedTo).select('name');
  deal.assignedTo = assignee._id;
  await deal.save();

  await timeline.log({
    action: A.DEAL_ASSIGNED,
    entityType: 'Deal',
    entityId: deal._id,
    performedBy: user._id,
    previousValue: { assignedTo: userRef(previousUser) },
    newValue: { assignedTo: userRef(assignee) },
  });

  return deal.populate(POPULATE);
};

const deleteDeal = async (id, user) => {
  const deal = await getAccessibleDeal(id, user);
  if (deal.stage === 'Won') throw ApiError.conflict('Won deals are part of revenue history and cannot be deleted');

  await deal.deleteOne();
  // Keep the lead consistent if this deal came from a conversion
  await Lead.updateOne({ convertedDeal: deal._id }, { $unset: { convertedDeal: 1 } });
};

const getDealTimeline = async (id, user, query) => {
  await getAccessibleDeal(id, user);
  return timeline.list('Deal', id, query);
};

module.exports = {
  createDeal,
  listDeals,
  getDeal,
  updateDeal,
  changeStage,
  assignDeal,
  deleteDeal,
  getDealTimeline,
  getAccessibleDeal,
};