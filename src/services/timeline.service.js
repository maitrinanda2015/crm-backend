const Timeline = require('../models/Timeline');
const { getPagination, buildMeta } = require('../utils/queryHelper');

// session is optional: pass it when logging inside a MongoDB transaction
const log = async (entry, session) => {
  const [doc] = await Timeline.create([entry], { session });
  return doc;
};

const list = async (entityType, entityId, query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const filter = { entityType, entityId };

  const [events, total] = await Promise.all([
    Timeline.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('performedBy', 'name email role'),
    Timeline.countDocuments(filter),
  ]);

  return { events, meta: buildMeta(page, limit, total) };
};

module.exports = { log, list };