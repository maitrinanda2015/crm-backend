const { z } = require('zod');

const probability = z
  .number({ message: 'Probability must be a number' })
  .min(0, 'Probability must be between 0 and 100')
  .max(100, 'Probability must be between 0 and 100');

const updateSettings = z
  .object({
    companyName: z.string().trim().min(2, 'Company name must be at least 2 characters').max(100).optional(),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, 'Currency must be a 3-letter ISO code, e.g. INR or USD')
      .optional(),
    stageProbabilities: z
      .object({
        Qualification: probability,
        Discovery: probability,
        Proposal: probability,
        Negotiation: probability,
      })
      .partial()
      .optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Provide at least one setting to update' });

module.exports = { updateSettings };