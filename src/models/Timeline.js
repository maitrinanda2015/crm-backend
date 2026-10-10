const mongoose = require('mongoose');
const { ENTITY_TYPES, TIMELINE_ACTIONS } = require('../config/constants');

const timelineSchema = new mongoose.Schema(
  {
    action: { type: String, enum: Object.values(TIMELINE_ACTIONS), required: true },
    entityType: { type: String, enum: ENTITY_TYPES, required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    previousValue: { type: mongoose.Schema.Types.Mixed, default: null },
    newValue: { type: mongoose.Schema.Types.Mixed, default: null },
    description: { type: String, trim: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // audit entries are never edited
    toJSON: { transform: (doc, ret) => { delete ret.__v; return ret; } },
  }
);

// Main query: "timeline of entity X, newest first"
timelineSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
timelineSchema.index({ performedBy: 1, createdAt: -1 });

module.exports = mongoose.model('Timeline', timelineSchema);