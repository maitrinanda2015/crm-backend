const { z } = require('zod');

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format');

const idParam = z.object({ id: objectId });

// "true"/"false" in query string -> boolean
const booleanString = z.enum(['true', 'false']).transform((v) => v === 'true');

// Common list-query fields: pagination, sorting, search, date range
const listQueryBase = {
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.string().trim().max(100).optional(),
  search: z.string().trim().max(100).optional(),
  from: z.coerce.date({ message: 'Invalid "from" date' }).optional(),
  to: z.coerce.date({ message: 'Invalid "to" date' }).optional(),
};

module.exports = { objectId, idParam, booleanString, listQueryBase };