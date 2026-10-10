const mongoose = require('mongoose');
const { CUSTOMER_STATUSES } = require('../config/constants');

const addressSchema = new mongoose.Schema(
  {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true },
    postalCode: { type: String, trim: true },
  },
  { _id: false }
);

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    company: { type: String, trim: true, maxlength: 100 },
    address: { type: addressSchema, default: undefined },
    // Original lead (unique -> a lead can only ever produce one customer)
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', unique: true, sparse: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: CUSTOMER_STATUSES, default: 'Active' },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, transform: (doc, ret) => { delete ret.__v; delete ret.id; return ret; } },
  }
);

customerSchema.index({ assignedTo: 1, createdAt: -1 });
customerSchema.index({ email: 1 });
customerSchema.index({ status: 1 });
customerSchema.index({ createdBy: 1 });
customerSchema.index({ createdAt: -1 });

// Virtual: customer.deals (used when fetching a single customer)
customerSchema.virtual('deals', {
  ref: 'Deal',
  localField: '_id',
  foreignField: 'customer',
});

module.exports = mongoose.model('Customer', customerSchema);