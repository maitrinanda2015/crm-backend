const { z } = require('zod');
const { objectId } = require('./common');

const dashboardQuery = z
  .object({
    from: z.coerce.date({ message: 'Invalid "from" date' }).optional(),
    to: z.coerce.date({ message: 'Invalid "to" date' }).optional(),
    manager: objectId.optional(), // admin only: filter team performance by manager
  })
  .refine((d) => !d.from || !d.to || d.from <= d.to, {
    message: '"from" must be before "to"',
    path: ['from'],
  });

module.exports = { dashboardQuery };