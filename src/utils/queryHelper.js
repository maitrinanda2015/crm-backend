// Reads ?page=1&limit=10&sort=-createdAt from the query string
const getPagination = (query) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 10, 1), 100); // max 100 per page
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

// "sort=-createdAt,name" -> { createdAt: -1, name: 1 }
// allowedFields protects against sorting by random/sensitive fields
const getSort = (sortQuery, allowedFields, defaultSort = { createdAt: -1 }) => {
  if (!sortQuery) return defaultSort;
  const sort = {};
  String(sortQuery).split(',').forEach((field) => {
    const trimmed = field.trim();
    const desc = trimmed.startsWith('-');
    const name = desc ? trimmed.slice(1) : trimmed;
    if (allowedFields.includes(name)) sort[name] = desc ? -1 : 1;
  });
  return Object.keys(sort).length ? sort : defaultSort;
};

// Builds a createdAt (or any date field) range filter from ?from=2026-01-01&to=2026-01-31
const getDateRange = (from, to) => {
  if (!from && !to) return undefined;
  const range = {};
  if (from) range.$gte = new Date(from);
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999); // include the whole "to" day
    range.$lte = end;
  }
  return range;
};

// Escapes special regex characters so user search text is treated literally
const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildMeta = (page, limit, total) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit) || 1,
});

module.exports = { getPagination, getSort, getDateRange, escapeRegex, buildMeta };