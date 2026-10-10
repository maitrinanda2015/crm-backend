const mongoose = require('mongoose');
const { ACTIVITY_TYPES } = require('../config/constants');

const RELATED_TYPES = ['Lead', 'Customer', 'Deal', 'User'];

const activitySchema = new mongoose.Schema(
  {
    type: { type: String, enum: ACTIVITY_TYPES, required: true },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, trim: true, maxlength: 2000 },
    // Stored status is only Pending/Completed. "Overdue" is derived from dueDate (see toJSON below).
    status: { type: String, enum: ['Pending', 'Completed'], default: 'Pending' },
    dueDate: { type: Date },
    completedAt: { type: Date },
    outcome: { type: String, trim: true, maxlength: 1000 },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Polymorphic link to the related record
    relatedType: { type: String, enum: RELATED_TYPES },
    relatedId: { type: mongoose.Schema.Types.ObjectId, refPath: 'relatedType' },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        // Backend decides "Overdue": pending + due date already passed
        if (ret.status === 'Pending' && ret.dueDate && new Date(ret.dueDate) < new Date()) {
          ret.status = 'Overdue';
        }
        delete ret.__v;
        delete ret.id;
        return ret;
      },
    },
  }
);

activitySchema.virtual('isOverdue').get(function () {
  return this.status === 'Pending' && !!this.dueDate && this.dueDate < new Date();
});

activitySchema.index({ assignedTo: 1, status: 1, dueDate: 1 });
activitySchema.index({ relatedType: 1, relatedId: 1, createdAt: -1 });
activitySchema.index({ status: 1, dueDate: 1 });
activitySchema.index({ createdBy: 1 });
activitySchema.index({ createdAt: -1 });

activitySchema.statics.RELATED_TYPES = RELATED_TYPES;

module.exports = mongoose.model('Activity', activitySchema);