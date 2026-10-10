const { z } = require('zod');

const phoneRegex = /^\+?[0-9]{10,15}$/;

const register = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(50),
  email: z.string().trim().toLowerCase().email('Invalid email format'),
  phone: z.string().trim().regex(phoneRegex, 'Phone must be 10-15 digits, optional +'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(64)
    .regex(/[A-Za-z]/, 'Password must contain a letter')
    .regex(/[0-9]/, 'Password must contain a number'),
});
// Note: unknown fields like "role" are stripped by Zod -> users can't make themselves admin

const login = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

module.exports = { register, login, phoneRegex };