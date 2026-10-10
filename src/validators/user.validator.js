const { z } = require('zod');
const { ROLES } = require('../config/constants');
const { phoneRegex } = require('./auth.validator');
const { objectId, booleanString, listQueryBase } = require('./common');

const roleEnum = z.enum(Object.values(ROLES));

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(64)
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');

const createUser = z.object({
  name: z.string().trim().min(2).max(50),
  email: z.string().trim().toLowerCase().email('Invalid email format'),
  phone: z.string().trim().regex(phoneRegex, 'Phone must be 10-15 digits, optional +'),
  password,
  role: roleEnum,
  manager: objectId.nullable().optional(),
});

const updateUser = z
  .object({
    name: z.string().trim().min(2).max(50).optional(),
    email: z.string().trim().toLowerCase().email('Invalid email format').optional(),
    phone: z.string().trim().regex(phoneRegex, 'Phone must be 10-15 digits, optional +').optional(),
    password: password.optional(),
    role: roleEnum.optional(),
    manager: objectId.nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Provide at least one field to update' });

const updateStatus = z.object({
  isActive: z.boolean({ message: 'isActive must be true or false' }),
});

const listUsers = z.object({
  ...listQueryBase,
  role: roleEnum.optional(),
  isActive: booleanString.optional(),
  manager: objectId.optional(),
});

module.exports = { createUser, updateUser, updateStatus, listUsers };