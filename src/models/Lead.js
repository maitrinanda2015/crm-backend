const mongoose = require('mongoose');
const { LEAD_SOURCES, LEAD_STATUSES, PRIORITIES } = require('../config/constants');

const leadSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    company: { type: String, trim: true, maxlength: 100 },
    source: { type: String, enum: LEAD_SOURCES, default: 'Other' },
    status: { type: String, enum: LEAD_STATUSES, default: 'New' },
    priority: { type: String, enum: PRIORITIES, default: 'Medium' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    description: { type: String, trim: true, maxlength: 2000 },
    lostReason: { type: String, trim: true },
    // Filled in by the conversion process (next step)
    convertedAt: { type: Date },
    convertedCustomer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    convertedDeal: { type: mongoose.Schema.Types.ObjectId, ref: 'Deal' },
  },
  {
    timestamps: true,
    toJSON: { transform: (doc, ret) => { delete ret.__v; return ret; } },
  }
);

// Indexes for the most common filters / sorts
leadSchema.index({ assignedTo: 1, status: 1, createdAt: -1 });
leadSchema.index({ status: 1, createdAt: -1 });
leadSchema.index({ source: 1 });
leadSchema.index({ priority: 1 });
leadSchema.index({ createdBy: 1 });
leadSchema.index({ email: 1 });
leadSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Lead', leadSchema);