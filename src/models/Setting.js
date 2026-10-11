const mongoose = require('mongoose');

const probability = { type: Number, min: 0, max: 100 };

// Single document (key: 'crm') holding CRM-wide configuration
const settingSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'crm', unique: true, immutable: true },
    companyName: { type: String, trim: true, maxlength: 100, default: 'My Company' },
    currency: { type: String, trim: true, uppercase: true, default: 'INR' },
    // Default win probability per active stage (Won = 100 and Lost = 0 are fixed)
    stageProbabilities: {
      Qualification: { ...probability, default: 10 },
      Discovery: { ...probability, default: 25 },
      Proposal: { ...probability, default: 50 },
      Negotiation: { ...probability, default: 75 },
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    toJSON: { transform: (doc, ret) => { delete ret.__v; return ret; } },
  }
);

module.exports = mongoose.model('Setting', settingSchema);