const mongoose = require('mongoose');
const { DEAL_STAGES } = require('../config/constants');

// Default win probability per stage (used when the client doesn't send one)
const STAGE_PROBABILITY = {
  Qualification: 10,
  Discovery: 25,
  Proposal: 50,
  Negotiation: 75,
  Won: 100,
  Lost: 0,
};

const dealSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', default: null },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    value: {
      type: Number,
      required: [true, 'Deal value is required'],
      min: [0.01, 'Deal value must be greater than zero'],
    },
    probability: {
      type: Number,
      min: [0, 'Probability must be between 0 and 100'],
      max: [100, 'Probability must be between 0 and 100'],
    },
    expectedRevenue: { type: Number, default: 0 }, // always calculated by the server
    expectedCloseDate: { type: Date, required: [true, 'Expected closing date is required'] },
    stage: { type: String, enum: DEAL_STAGES, default: 'Qualification' },
    status: { type: String, enum: ['Open', 'Won', 'Lost'], default: 'Open' }, // derived from stage
    description: { type: String, trim: true, maxlength: 2000 },
    lostReason: { type: String, trim: true },
    closedAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: { transform: (doc, ret) => { delete ret.__v; return ret; } },
  }
);

// Server-side business logic: never trust probability/revenue/status from the client
dealSchema.pre('validate', function () {
  if (this.stage === 'Won') this.probability = 100;
  else if (this.stage === 'Lost') this.probability = 0;
  else if (this.probability === undefined || this.probability === null) {
    this.probability = STAGE_PROBABILITY[this.stage];
  }

  if (typeof this.value === 'number') {
    this.expectedRevenue = Math.round(this.value * this.probability) / 100;
  }

  this.status = this.stage === 'Won' ? 'Won' : this.stage === 'Lost' ? 'Lost' : 'Open';
});

dealSchema.index({ assignedTo: 1, stage: 1 });
dealSchema.index({ stage: 1, value: 1 });
dealSchema.index({ status: 1 });
dealSchema.index({ customer: 1 });
dealSchema.index({ lead: 1 });
dealSchema.index({ expectedCloseDate: 1 });
dealSchema.index({ createdBy: 1 });
dealSchema.index({ createdAt: -1 });

dealSchema.statics.STAGE_PROBABILITY = STAGE_PROBABILITY;

module.exports = mongoose.model('Deal', dealSchema);