const { z } = require('zod');
const { CUSTOMER_STATUSES } = require('../config/constants');
const { phoneRegex } = require('./auth.validator');
const { objectId, listQueryBase } = require('./common');
const { csvEnum } = require('./lead.validator');
const { address } = require('./conversion.validator');

const fields = {
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().trim().toLowerCase().email('Invalid email format'),
  phone: z.string().trim().regex(phoneRegex, 'Phone must be 10-15 digits, optional +'),
  company: z.string().trim().max(100),
  address,
  status: z.enum(CUSTOMER_STATUSES),
  assignedTo: objectId,
};

const createCustomer = z
  .object({
    name: fields.name,
    email: fields.email.optional(),
    phone: fields.phone.optional(),
    company: fields.company.optional(),
    address: fields.address.optional(),
    status: fields.status.optional(),
    assignedTo: fields.assignedTo.optional(),
  })
  .refine((d) => d.email || d.phone, {
    message: 'Provide at least an email or a phone number',
    path: ['email'],
  });

const updateCustomer = z
  .object(fields)
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: 'Provide at least one field to update' });

const listCustomers = z.object({
  ...listQueryBase,
  status: csvEnum(CUSTOMER_STATUSES).optional(),
  assignedTo: objectId.optional(),
});

module.exports = { createCustomer, updateCustomer, listCustomers };