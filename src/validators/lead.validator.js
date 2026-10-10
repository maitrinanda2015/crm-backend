const { z } = require('zod');
const { LEAD_SOURCES, LEAD_STATUSES, PRIORITIES } = require('../config/constants');
const { phoneRegex } = require('./auth.validator');
const { objectId, listQueryBase } = require('./common');

// "New,Contacted" -> ['New', 'Contacted'] (each value validated)
const csvEnum = (values) =>
  z
    .string()
    .transform((s) => s.split(',').map((v) => v.trim()).filter(Boolean))
    .pipe(z.array(z.enum(values)).min(1));

const leadFields = {
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().trim().toLowerCase().email('Invalid email format'),
  phone: z.string().trim().regex(phoneRegex, 'Phone must be 10-15 digits, optional +'),
  company: z.string().trim().max(100),
  source: z.enum(LEAD_SOURCES),
  priority: z.enum(PRIORITIES),
  description: z.string().trim().max(2000),
};

const createLead = z
  .object({
    ...leadFields,
    email: leadFields.email.optional(),
    phone: leadFields.phone.optional(),
    company: leadFields.company.optional(),
    source: leadFields.source.optional(),
    priority: leadFields.priority.optional(),
    description: leadFields.description.optional(),
    status: z.enum(['New', 'Contacted']).optional(),
    assignedTo: objectId.optional(),
  })
  .refine((d) => d.email || d.phone, {
    message: 'Provide at least an email or a phone number',
    path: ['email'],
  });

const updateLead = z
  .object(leadFields)
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: 'Provide at least one field to update' });

const updateStatus = z
  .object({
    status: z.enum(LEAD_STATUSES.filter((s) => s !== 'Converted')),
    reason: z.string().trim().min(3, 'Reason must be at least 3 characters').max(500).optional(),
  })
  .refine((d) => d.status !== 'Lost' || d.reason, {
    message: 'A reason is required when marking a lead as Lost',
    path: ['reason'],
  });

const assignLead = z.object({ assignedTo: objectId });

const listLeads = z.object({
  ...listQueryBase,
  status: csvEnum(LEAD_STATUSES).optional(),
  priority: csvEnum(PRIORITIES).optional(),
  source: csvEnum(LEAD_SOURCES).optional(),
  assignedTo: z.union([objectId, z.literal('unassigned')]).optional(),
});

module.exports = { createLead, updateLead, updateStatus, assignLead, listLeads, csvEnum };