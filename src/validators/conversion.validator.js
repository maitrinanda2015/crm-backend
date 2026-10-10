const { z } = require('zod');
const { conversionDeal } = require('./deal.validator');

const address = z
  .object({
    street: z.string().trim().max(200),
    city: z.string().trim().max(100),
    state: z.string().trim().max(100),
    country: z.string().trim().max(100),
    postalCode: z.string().trim().max(20),
  })
  .partial();

const convertLead = z.object({
  // Optional extra customer details (name/email/phone are copied from the lead)
  customer: z
    .object({
      company: z.string().trim().max(100).optional(),
      address: address.optional(),
    })
    .optional(),
  // Optional: create a deal in the same transaction
  deal: conversionDeal.optional(),
});

module.exports = { convertLead, address };