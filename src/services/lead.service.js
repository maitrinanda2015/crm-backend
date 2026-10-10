const Lead = require('../models/Lead');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const timeline = require('./timeline.service');
const { validateAssignee } = require('../utils/assignment');
const { ROLES, TIMELINE_ACTIONS: A } = require('../config/constants');
const { getAccessFilter } = require('../utils/access');
const { getPagination, getSort, getDateRange, escapeRegex, buildMeta } = require('../utils/queryHelper');

const SORTABLE_FIELDS = ['name', 'company', 'status', 'priority', 'source', 'createdAt', 'updatedAt'];
const POPULATE = [
  { path: 'assignedTo', select: 'name email role' },
  { path: 'createdBy', select: 'name email' },
];

// Allowed manual status changes ("Converted" only happens via the convert endpoint)
const STATUS_TRANSITIONS = {
  New: ['Contacted', 'Qualified', 'Unqualified', 'Lost'],
  Contacted: ['Qualified', 'Unqualified', 'Lost'],
  Qualified: ['Contacted', 'Unqualified', 'Lost'],
  Unqualified: ['Contacted', 'Lost'],
  Lost: ['Contacted'],
  Converted: [],
};

const userRef = (u) => (u ? { id: u._id, name: u.name } : null);

// Returns a lead only if the user may access it. 404 (not 403) so other teams' IDs aren't revealed.
const getAccessibleLead = async (id, user) => {
  const access = await getAccessFilter(user);
  const lead = await Lead.findOne({ $and: [{ _id: id }, access] });
  if (!lead) throw ApiError.notFound('Lead not found');
  return lead;
};

const ensureNotConverted = (lead) => {
  if (lead.status === 'Converted') {
    throw ApiError.conflict('Converted leads are read-only');
  }
};

const ensureNoDuplicateEmail = async (email, excludeId) => {
  if (!email) return;
  const filter = { email, status: { $nin: ['Lost', 'Unqualified'] } };
  if (excludeId) filter._id = { $ne: excludeId };
  if (await Lead.exists(filter)) throw ApiError.conflict('An active lead with this email already exists');
};

const createLead = async (data, user) => {
  await ensureNoDuplicateEmail(data.email);

  let assignee = null;
  if (user.role === ROLES.SALES_EXECUTIVE) {
    data.assignedTo = user._id; // executives always own the leads they create
    assignee = user;
  } else if (data.assignedTo) {
    assignee = await validateAssignee(data.assignedTo, user);
  }

  const lead = await Lead.create({ ...data, createdBy: user._id });

  await timeline.log({
    action: A.LEAD_CREATED,
    entityType: 'Lead',
    entityId: lead._id,
    performedBy: user._id,
    newValue: { name: lead.name, status: lead.status, source: lead.source, priority: lead.priority },
  });
  if (assignee) {
    await timeline.log({
      action: A.LEAD_ASSIGNED,
      entityType: 'Lead',
      entityId: lead._id,
      performedBy: user._id,
      newValue: { assignedTo: userRef(assignee) },
    });
  }

  return lead.populate(POPULATE);
};

const listLeads = async (query, user) => {
  const { page, limit, skip } = getPagination(query);
  const access = await getAccessFilter(user);
  const filter = {};

  if (query.status) filter.status = { $in: query.status };
  if (query.priority) filter.priority = { $in: query.priority };
  if (query.source) filter.source = { $in: query.source };
  if (query.assignedTo) filter.assignedTo = query.assignedTo === 'unassigned' ? null : query.assignedTo;

  if (query.search) {
    const regex = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [{ name: regex }, { email: regex }, { company: regex }, { phone: regex }];
  }

  const createdAt = getDateRange(query.from, query.to);
  if (createdAt) filter.createdAt = createdAt;

  const finalFilter = { $and: [access, filter] };
  const sort = getSort(query.sort, SORTABLE_FIELDS);

  const [leads, total] = await Promise.all([
    Lead.find(finalFilter).sort(sort).skip(skip).limit(limit).populate(POPULATE),
    Lead.countDocuments(finalFilter),
  ]);

  return { leads, meta: buildMeta(page, limit, total) };
};

const getLead = async (id, user) => {
  const lead = await getAccessibleLead(id, user);
  return lead.populate([
    ...POPULATE,
    { path: 'convertedCustomer', select: 'name email' },
    { path: 'convertedDeal', select: 'name stage value' },
  ]);
};

const updateLead = async (id, data, user) => {
  const lead = await getAccessibleLead(id, user);
  ensureNotConverted(lead);

  if (data.email && data.email !== lead.email) await ensureNoDuplicateEmail(data.email, lead._id);

  // Work out what actually changed (for the timeline)
  const changes = {};
  for (const [key, value] of Object.entries(data)) {
    if (String(lead[key] ?? '') !== String(value ?? '')) {
      changes[key] = { from: lead[key] ?? null, to: value };
    }
  }
  if (Object.keys(changes).length === 0) return lead.populate(POPULATE); // nothing changed

  Object.assign(lead, data);
  await lead.save();

  if (changes.priority) {
    await timeline.log({
      action: A.LEAD_PRIORITY_CHANGED,
      entityType: 'Lead',
      entityId: lead._id,
      performedBy: user._id,
      previousValue: { priority: changes.priority.from },
      newValue: { priority: changes.priority.to },
    });
    delete changes.priority;
  }
  if (Object.keys(changes).length) {
    await timeline.log({
      action: A.LEAD_UPDATED,
      entityType: 'Lead',
      entityId: lead._id,
      performedBy: user._id,
      previousValue: Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.from])),
      newValue: Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.to])),
    });
  }

  return lead.populate(POPULATE);
};

const updateStatus = async (id, { status, reason }, user) => {
  const lead = await getAccessibleLead(id, user);
  ensureNotConverted(lead);

  if (lead.status === status) throw ApiError.badRequest(`Lead is already ${status}`);

  const allowed = STATUS_TRANSITIONS[lead.status] || [];
  if (!allowed.includes(status)) {
    throw ApiError.badRequest(
      `Cannot change status from ${lead.status} to ${status}. Allowed: ${allowed.join(', ') || 'none'}`
    );
  }

  const previous = lead.status;
  lead.status = status;
  lead.lostReason = status === 'Lost' ? reason : undefined;
  await lead.save();

  await timeline.log({
    action: A.LEAD_STATUS_CHANGED,
    entityType: 'Lead',
    entityId: lead._id,
    performedBy: user._id,
    previousValue: { status: previous },
    newValue: { status, ...(reason && { reason }) },
  });

  return lead.populate(POPULATE);
};

const assignLead = async (id, assigneeId, user) => {
  const lead = await getAccessibleLead(id, user);
  ensureNotConverted(lead);

  const assignee = await validateAssignee(assigneeId, user);
  if (lead.assignedTo?.equals(assignee._id)) {
    throw ApiError.badRequest('Lead is already assigned to this user');
  }

  const previousUser = lead.assignedTo ? await User.findById(lead.assignedTo).select('name') : null;

  lead.assignedTo = assignee._id;
  await lead.save();

  await timeline.log({
    action: previousUser ? A.LEAD_REASSIGNED : A.LEAD_ASSIGNED,
    entityType: 'Lead',
    entityId: lead._id,
    performedBy: user._id,
    previousValue: previousUser ? { assignedTo: userRef(previousUser) } : null,
    newValue: { assignedTo: userRef(assignee) },
  });

  return lead.populate(POPULATE);
};

const deleteLead = async (id, user) => {
  const lead = await getAccessibleLead(id, user);
  ensureNotConverted(lead); // converted leads are linked to customers & deals

  await lead.deleteOne();

  // Timeline entries are kept as an audit trail
  await timeline.log({
    action: A.LEAD_DELETED,
    entityType: 'Lead',
    entityId: lead._id,
    performedBy: user._id,
    previousValue: { name: lead.name, status: lead.status },
  });
};

const getLeadTimeline = async (id, user, query) => {
  await getAccessibleLead(id, user); // access check
  return timeline.list('Lead', id, query);
};

module.exports = {
  createLead,
  listLeads,
  getLead,
  updateLead,
  updateStatus,
  assignLead,
  deleteLead,
  getLeadTimeline,
  getAccessibleLead,
  validateAssignee, // re-exported for convenience
};