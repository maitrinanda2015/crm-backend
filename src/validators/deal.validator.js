const { z } = require('zod');
const { DEAL_STAGES } = require('../config/constants');
const { objectId, listQueryBase } = require('./common');
const { csvEnum } = require('./lead.validator');

const CLOSED_STAGES = ['Won', 'Lost'];
const ACTIVE_STAGES = DEAL_STAGES.filter((s) => !CLOSED_STAGES.includes(s));

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
const fiveYearsFromNow = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 5);
  return d;
};

const dealValue = z
  .number({ message: 'Deal value must be a number' })
  .positive('Deal value must be greater than zero')
  .max(1e12, 'Deal value is too large');

const probability = z
  .number({ message: 'Probability must be a number' })
  .min(0, 'Probability must be between 0 and 100')
  .max(100, 'Probability must be between 0 and 100');

const expectedCloseDate = z.coerce
  .date({ message: 'Invalid expected closing date' })
  .refine((d) => d >= startOfToday(), 'Expected closing date cannot be in the past')
  .refine((d) => d <= fiveYearsFromNow(), 'Expected closing date must be within 5 years');

const name = z.string().trim().min(2, 'Deal name must be at least 2 characters').max(150);
const description = z.string().trim().max(2000);

// Deal details accepted during lead conversion
const conversionDeal = z.object({
  name,
  value: dealValue,
  probability: probability.optional(),
  expectedCloseDate,
  stage: z.enum(ACTIVE_STAGES).optional(),
  description: description.optional(),
});

const createDeal = conversionDeal.extend({
  customer: objectId,
  assignedTo: objectId.optional(),
});

const updateDeal = z
  .object({
    name: name.optional(),
    value: dealValue.optional(),
    probability: probability.optional(),
    expectedCloseDate: expectedCloseDate.optional(),
    description: description.optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Provide at least one field to update' });

const changeStage = z
  .object({
    stage: z.enum(DEAL_STAGES),
    probability: probability.optional(),
    lostReason: z.string().trim().min(3, 'Lost reason must be at least 3 characters').max(500).optional(),
    reason: z.string().trim().min(3, 'Reason must be at least 3 characters').max(500).optional(),
  })
  .refine((d) => d.stage !== 'Lost' || d.lostReason, {
    message: 'lostReason is required when marking a deal as Lost',
    path: ['lostReason'],
  })
  .refine((d) => !(CLOSED_STAGES.includes(d.stage) && d.probability !== undefined), {
    message: 'Probability is fixed for Won (100) and Lost (0)',
    path: ['probability'],
  });

const assignDeal = z.object({ assignedTo: objectId });

const listDeals = z
  .object({
    ...listQueryBase,
    stage: csvEnum(DEAL_STAGES).optional(),
    status: csvEnum(['Open', 'Won', 'Lost']).optional(),
    assignedTo: objectId.optional(),
    customer: objectId.optional(),
    minValue: z.coerce.number().min(0).optional(),
    maxValue: z.coerce.number().min(0).optional(),
    closeFrom: z.coerce.date({ message: 'Invalid "closeFrom" date' }).optional(),
    closeTo: z.coerce.date({ message: 'Invalid "closeTo" date' }).optional(),
  })
  .refine((d) => d.minValue === undefined || d.maxValue === undefined || d.minValue <= d.maxValue, {
    message: 'minValue cannot be greater than maxValue',
    path: ['minValue'],
  });

module.exports = {
  CLOSED_STAGES,
  ACTIVE_STAGES,
  dealValue,
  probability,
  expectedCloseDate,
  conversionDeal,
  createDeal,
  updateDeal,
  changeStage,
  assignDeal,
  listDeals,
};