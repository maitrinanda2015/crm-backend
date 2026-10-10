const customerService = require('../services/customer.service');
const sendResponse = require('../utils/apiResponse');

const createCustomer = async (req, res) => {
  const customer = await customerService.createCustomer(req.body, req.user);
  sendResponse(res, 201, 'Customer created successfully', { customer });
};

const listCustomers = async (req, res) => {
  const { customers, meta } = await customerService.listCustomers(req.validated.query, req.user);
  sendResponse(res, 200, 'Customers fetched successfully', { customers }, meta);
};

const getCustomer = async (req, res) => {
  const customer = await customerService.getCustomer(req.validated.params.id, req.user);
  sendResponse(res, 200, 'Customer fetched successfully', { customer });
};

const updateCustomer = async (req, res) => {
  const customer = await customerService.updateCustomer(req.validated.params.id, req.body, req.user);
  sendResponse(res, 200, 'Customer updated successfully', { customer });
};

const deleteCustomer = async (req, res) => {
  await customerService.deleteCustomer(req.validated.params.id, req.user);
  sendResponse(res, 200, 'Customer deleted successfully');
};

const getTimeline = async (req, res) => {
  const { events, meta } = await customerService.getCustomerTimeline(
    req.validated.params.id,
    req.user,
    req.query
  );
  sendResponse(res, 200, 'Customer timeline fetched successfully', { events }, meta);
};

module.exports = { createCustomer, listCustomers, getCustomer, updateCustomer, deleteCustomer, getTimeline };