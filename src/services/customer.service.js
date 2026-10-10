const Customer = require('../models/Customer');
const Deal = require('../models/Deal');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const timeline = require('./timeline.service');
const { validateAssignee } = require('../utils/assignment');
const { ROLES, TIMELINE_ACTIONS: A } = require('../config/constants');
const { getAccessFilter } = require('../utils/access');
const { getPagination, getSort, getDateRange, escapeRegex, buildMeta } = require('../utils/queryHelper');

const SORTABLE_FIELDS = ['name', 'company', 'status', 'createdAt', 'updatedAt'];
const POPULATE = [
  { path: 'assignedTo', select: 'name email role' },
  { path: 'createdBy', select: 'name email' },
  { path: 'lead', select: 'name status source convertedAt' },
];

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const getAccessibleCustomer = async (id, user) => {
  const access = await getAccessFilter(user);
  const customer = await Customer.findOne({ $and: [{ _id: id }, access] });
  if (!customer) throw ApiError.notFound('Customer not found');
  return customer;
};

const ensureNoDuplicateEmail = async (email, excludeId) => {
  if (!email) return;
  const filter = { email };
  if (excludeId) filter._id = { $ne: excludeId };
  if (await Customer.exists(filter)) throw ApiError.conflict('A customer with this email already exists');
};

const createCustomer = async (data, user) => {
  await ensureNoDuplicateEmail(data.email);

  if (user.role === ROLES.SALES_EXECUTIVE) {
    data.assignedTo = user._id; // executives own the customers they create
  } else {
    if (!data.assignedTo) throw ApiError.badRequest('assignedTo is required (a sales executive)');
    await validateAssignee(data.assignedTo, user);
  }

  const customer = await Customer.create({ ...data, createdBy: user._id });

  await timeline.log({
    action: A.CUSTOMER_CREATED,
    entityType: 'Customer',
    entityId: customer._id,
    performedBy: user._id,
    newValue: { name: customer.name, assignedTo: customer.assignedTo },
  });

  return customer.populate(POPULATE);
};

const listCustomers = async (query, user) => {
  const { page, limit, skip } = getPagination(query);
  const access = await getAccessFilter(user);
  const filter = {};

  if (query.status) filter.status = { $in: query.status };
  if (query.assignedTo) filter.assignedTo = query.assignedTo;

  if (query.search) {
    const regex = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [{ name: regex }, { email: regex }, { company: regex }, { phone: regex }];
  }

  const createdAt = getDateRange(query.from, query.to);
  if (createdAt) filter.createdAt = createdAt;

  const finalFilter = { $and: [access, filter] };
  const sort = getSort(query.sort, SORTABLE_FIELDS);

  const [customers, total] = await Promise.all([
    Customer.find(finalFilter).sort(sort).skip(skip).limit(limit).populate(POPULATE),
    Customer.countDocuments(finalFilter),
  ]);

  return { customers, meta: buildMeta(page, limit, total) };
};

// Single customer with its original lead and all associated deals
const getCustomer = async (id, user) => {
  const customer = await getAccessibleCustomer(id, user);
  return customer.populate([
    ...POPULATE,
    {
      path: 'deals',
      select: 'name stage status value probability expectedRevenue expectedCloseDate assignedTo',
      options: { sort: { createdAt: -1 } },
    },
  ]);
};

const updateCustomer = async (id, data, user) => {
  const customer = await getAccessibleCustomer(id, user);

  if (data.assignedTo !== undefined) {
    if (user.role === ROLES.SALES_EXECUTIVE) {
      throw ApiError.forbidden('Only admins and managers can reassign customers');
    }
    await validateAssignee(data.assignedTo, user);
  }
  if (data.email && data.email !== customer.email) await ensureNoDuplicateEmail(data.email, customer._id);

  // Record only fields that really changed
  const previousValue = {};
  const newValue = {};
  for (const [key, value] of Object.entries(data)) {
    const current = customer[key]?.toObject ? customer[key].toObject() : customer[key];
    if (!same(current, value)) {
      previousValue[key] = current ?? null;
      newValue[key] = value;
    }
  }
  if (Object.keys(newValue).length === 0) return customer.populate(POPULATE);

  Object.assign(customer, data);
  await customer.save();

  await timeline.log({
    action: A.CUSTOMER_UPDATED,
    entityType: 'Customer',
    entityId: customer._id,
    performedBy: user._id,
    previousValue,
    newValue,
  });

  return customer.populate(POPULATE);
};

const deleteCustomer = async (id, user) => {
  const customer = await getAccessibleCustomer(id, user);

  const dealCount = await Deal.countDocuments({ customer: customer._id });
  if (dealCount > 0) {
    throw ApiError.conflict(
      `Customer has ${dealCount} deal(s) and cannot be deleted. Set status to Inactive instead.`
    );
  }
  if (customer.lead) {
    throw ApiError.conflict(
      'Customer was converted from a lead and is part of the sales history. Set status to Inactive instead.'
    );
  }

  await customer.deleteOne();

  await timeline.log({
    action: A.CUSTOMER_DELETED,
    entityType: 'Customer',
    entityId: customer._id,
    performedBy: user._id,
    previousValue: { name: customer.name },
  });
};

const getCustomerTimeline = async (id, user, query) => {
  await getAccessibleCustomer(id, user);
  return timeline.list('Customer', id, query);
};

module.exports = {
  createCustomer,
  listCustomers,
  getCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerTimeline,
  getAccessibleCustomer,
};