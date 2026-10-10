const ROLES = Object.freeze({
  ADMIN: 'admin',
  SALES_MANAGER: 'sales_manager',
  SALES_EXECUTIVE: 'sales_executive',
});

const LEAD_SOURCES = ['Website', 'Referral', 'Social Media', 'Email', 'Phone', 'Other'];
const LEAD_STATUSES = ['New', 'Contacted', 'Qualified', 'Unqualified', 'Converted', 'Lost'];
const PRIORITIES = ['Low', 'Medium', 'High'];
const CUSTOMER_STATUSES = ['Active', 'Inactive'];
const DEAL_STAGES = ['Qualification', 'Discovery', 'Proposal', 'Negotiation', 'Won', 'Lost'];
const ACTIVITY_TYPES = ['Call', 'Email', 'Meeting', 'Demo', 'Follow-up', 'Reminder', 'Note'];
const ACTIVITY_STATUSES = ['Pending', 'Completed', 'Overdue'];

const ENTITY_TYPES = ['Lead', 'Customer', 'Deal', 'Activity'];

const TIMELINE_ACTIONS = Object.freeze({
  LEAD_CREATED: 'lead_created',
  LEAD_UPDATED: 'lead_updated',
  LEAD_ASSIGNED: 'lead_assigned',
  LEAD_REASSIGNED: 'lead_reassigned',
  LEAD_STATUS_CHANGED: 'lead_status_changed',
  LEAD_PRIORITY_CHANGED: 'lead_priority_changed',
  LEAD_CONVERTED: 'lead_converted',
  LEAD_DELETED: 'lead_deleted',
  NOTE_ADDED: 'note_added',
  FOLLOW_UP_CREATED: 'follow_up_created',
  FOLLOW_UP_COMPLETED: 'follow_up_completed',
  ACTIVITY_CREATED: 'activity_created',
  ACTIVITY_COMPLETED: 'activity_completed',
  CUSTOMER_CREATED: 'customer_created',
  CUSTOMER_UPDATED: 'customer_updated',
  CUSTOMER_DELETED: 'customer_deleted',
  DEAL_CREATED: 'deal_created',
  DEAL_UPDATED: 'deal_updated',
  DEAL_STAGE_CHANGED: 'deal_stage_changed',
  DEAL_ASSIGNED: 'deal_assigned',
  DEAL_WON: 'deal_won',
  DEAL_LOST: 'deal_lost',
});

module.exports = {
  ROLES,
  LEAD_SOURCES,
  LEAD_STATUSES,
  PRIORITIES,
  CUSTOMER_STATUSES,
  DEAL_STAGES,
  ACTIVITY_TYPES,
  ACTIVITY_STATUSES,
  ENTITY_TYPES,
  TIMELINE_ACTIONS,
};