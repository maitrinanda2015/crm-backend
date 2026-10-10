const { z } = require('zod');
const { ACTIVITY_TYPES, ACTIVITY_STATUSES } = require('../config/constants');
const { objectId, listQueryBase } = require('./common');
const { csvEnum } = require('./lead.validator');

const RELATED_TYPES = ['Lead', 'Customer', 'Deal', 'User'];

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const title = z.string().trim().min(2, 'Title must be at least 2 characters').max(150);
const description = z.string().trim().max(2000);
const dueDate = z.coerce
  .date({ message: 'Invalid due date' })
  .refine((d) => d >= startOfToday(), 'Due date cannot be in the past');

const createActivity = z
  .object({
    type: z.enum(ACTIVITY_TYPES),
    title,
    description: description.optional(),
    dueDate: dueDate.optional(),
    assignedTo: objectId.optional(),
    relatedType: z.enum(RELATED_TYPES).optional(),
    relatedId: objectId.optional(),
  })
  .refine((d) => d.type === 'Note' || d.dueDate, {
    message: 'dueDate is required for this activity type',
    path: ['dueDate'],
  })
  .refine((d) => Boolean(d.relatedType) === Boolean(d.relatedId), {
    message: 'relatedType and relatedId must be provided together',
    path: ['relatedId'],
  });

const updateActivity = z
  .object({
    title: title.optional(),
    description: description.optional(),
    dueDate: dueDate.optional(),
    assignedTo: objectId.optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Provide at least one field to update' });

const completeActivity = z.object({
  outcome: z.string().trim().max(1000).optional(),
});

const listActivities = z.object({
  ...listQueryBase,
  type: csvEnum(ACTIVITY_TYPES).optional(),
  status: csvEnum(ACTIVITY_STATUSES).optional(),
  assignedTo: objectId.optional(),
  relatedType: z.enum(RELATED_TYPES).optional(),
  relatedId: objectId.optional(),
  dueFrom: z.coerce.date({ message: 'Invalid "dueFrom" date' }).optional(),
  dueTo: z.coerce.date({ message: 'Invalid "dueTo" date' }).optional(),
});

module.exports = { createActivity, updateActivity, completeActivity, listActivities };