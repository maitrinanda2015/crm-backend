/**
 * Seed script: fills the database with realistic demo data.
 *
 *   npm run seed            -> only runs if the database has no users
 *   npm run seed -- --fresh -> DELETES all CRM data first, then seeds
 *
 * All seeded users share the passwords listed at the bottom of the output.
 */
require('dotenv').config();
const mongoose = require('mongoose');

const User = require('./models/User');
const Lead = require('./models/Lead');
const Customer = require('./models/Customer');
const Deal = require('./models/Deal');
const Activity = require('./models/Activity');
const Timeline = require('./models/Timeline');
const { ROLES, TIMELINE_ACTIONS: A } = require('./config/constants');

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n) => new Date(Date.now() - n * DAY);
const daysFromNow = (n) => new Date(Date.now() + n * DAY);

const PASSWORDS = {
  admin: 'Admin1234',
  manager: 'Manager1234',
  executive: 'Exec1234',
};

const run = async () => {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set in .env');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const fresh = process.argv.includes('--fresh');
  if (fresh) {
    await Promise.all([
      User.deleteMany({}),
      Lead.deleteMany({}),
      Customer.deleteMany({}),
      Deal.deleteMany({}),
      Activity.deleteMany({}),
      Timeline.deleteMany({}),
    ]);
    console.log('Cleared existing CRM data (--fresh)');
  } else if (await User.exists({})) {
    console.log('Database already has users. Run "npm run seed -- --fresh" to reset and reseed.');
    return;
  }

  // Make sure indexes (incl. unique ones) exist before inserting
  await Promise.all([User, Lead, Customer, Deal, Activity, Timeline].map((m) => m.syncIndexes()));

  // ---------- Users (created one by one so the password hashing hook runs) ----------
  const admin = await User.create({
    name: 'Admin User', email: 'admin@crm.com', phone: '9876543210',
    password: PASSWORDS.admin, role: ROLES.ADMIN,
  });
  const manager1 = await User.create({
    name: 'Manager One', email: 'manager1@crm.com', phone: '9876543212',
    password: PASSWORDS.manager, role: ROLES.SALES_MANAGER,
  });
  const manager2 = await User.create({
    name: 'Manager Two', email: 'manager2@crm.com', phone: '9876543214',
    password: PASSWORDS.manager, role: ROLES.SALES_MANAGER,
  });
  const exec1 = await User.create({
    name: 'Sales Exec One', email: 'exec1@crm.com', phone: '9876543211',
    password: PASSWORDS.executive, role: ROLES.SALES_EXECUTIVE, manager: manager1._id,
  });
  const exec2 = await User.create({
    name: 'Sales Exec Two', email: 'exec2@crm.com', phone: '9876543213',
    password: PASSWORDS.executive, role: ROLES.SALES_EXECUTIVE, manager: manager1._id,
  });
  const exec3 = await User.create({
    name: 'Sales Exec Three', email: 'exec3@crm.com', phone: '9876543215',
    password: PASSWORDS.executive, role: ROLES.SALES_EXECUTIVE, manager: manager2._id,
  });
  const exec4 = await User.create({
    name: 'Sales Exec Four', email: 'exec4@crm.com', phone: '9876543216',
    password: PASSWORDS.executive, role: ROLES.SALES_EXECUTIVE, manager: manager2._id, isActive: false,
  });
  console.log('Created 7 users (1 admin, 2 managers, 4 executives - one inactive)');

  const timeline = [];
  const log = (action, entityType, entityId, performedBy, newValue = null, previousValue = null, createdAt) =>
    timeline.push({ action, entityType, entityId, performedBy, newValue, previousValue, createdAt });

  // ---------- Leads ----------
  const leadSeed = [
    { name: 'Rahul Sharma', email: 'rahul@acme.example', company: 'Acme Pvt Ltd', source: 'Website', status: 'Converted', priority: 'High', assignedTo: exec2, age: 45 },
    { name: 'Anita Desai', email: 'anita@globex.example', company: 'Globex Ltd', source: 'Referral', status: 'Converted', priority: 'High', assignedTo: exec1, age: 40 },
    { name: 'Vikram Rao', email: 'vikram@initech.example', company: 'Initech', source: 'Email', status: 'Converted', priority: 'Medium', assignedTo: exec3, age: 35 },
    { name: 'Meera Iyer', email: 'meera@umbrella.example', company: 'Umbrella Corp', source: 'Social Media', status: 'Converted', priority: 'Medium', assignedTo: exec2, age: 30 },
    { name: 'Karan Mehta', email: 'karan@hooli.example', company: 'Hooli', source: 'Website', status: 'Converted', priority: 'Low', assignedTo: exec1, age: 28 },
    { name: 'Sneha Kulkarni', email: 'sneha@stark.example', company: 'Stark Traders', source: 'Phone', status: 'Qualified', priority: 'High', assignedTo: exec1, age: 12 },
    { name: 'Arjun Nair', email: 'arjun@wayne.example', company: 'Wayne Logistics', source: 'Referral', status: 'Qualified', priority: 'Medium', assignedTo: exec3, age: 10 },
    { name: 'Pooja Shah', email: 'pooja@oscorp.example', company: 'Oscorp Labs', source: 'Website', status: 'Contacted', priority: 'Medium', assignedTo: exec2, age: 8 },
    { name: 'Rohit Verma', email: 'rohit@cyberdyne.example', company: 'Cyberdyne', source: 'Email', status: 'Contacted', priority: 'Low', assignedTo: exec3, age: 6 },
    { name: 'Divya Menon', email: 'divya@soylent.example', company: 'Soylent Foods', source: 'Social Media', status: 'New', priority: 'High', assignedTo: exec1, age: 3 },
    { name: 'Sameer Khan', email: 'sameer@tyrell.example', company: 'Tyrell Systems', source: 'Website', status: 'New', priority: 'Medium', assignedTo: null, age: 2 },
    { name: 'Neha Gupta', email: 'neha@vandelay.example', company: 'Vandelay Imports', source: 'Other', status: 'Unqualified', priority: 'Low', assignedTo: exec2, age: 20 },
    { name: 'Aditya Joshi', email: 'aditya@massive.example', company: 'Massive Dynamic', source: 'Phone', status: 'Lost', priority: 'Medium', assignedTo: exec3, age: 25, lostReason: 'Chose a competitor' },
  ];

  const leads = [];
  for (const [i, l] of leadSeed.entries()) {
    const lead = await Lead.create({
      name: l.name,
      email: l.email,
      phone: `91234567${String(i).padStart(2, '0')}`,
      company: l.company,
      source: l.source,
      status: l.status,
      priority: l.priority,
      assignedTo: l.assignedTo?._id ?? null,
      createdBy: admin._id,
      description: `Interested in a CRM subscription for ${l.company}`,
      lostReason: l.lostReason,
    });
    // Spread creation dates over the last weeks (bypasses the automatic timestamp)
    const createdAt = daysAgo(l.age);
    await Lead.collection.updateOne({ _id: lead._id }, { $set: { createdAt, updatedAt: createdAt } });
    lead.createdAt = createdAt;
    leads.push(lead);

    log(A.LEAD_CREATED, 'Lead', lead._id, admin._id, { name: lead.name, status: 'New', source: lead.source }, null, createdAt);
    if (l.assignedTo) {
      log(A.LEAD_ASSIGNED, 'Lead', lead._id, admin._id, { assignedTo: { id: l.assignedTo._id, name: l.assignedTo.name } }, null, createdAt);
    }
    if (l.status !== 'New' && l.status !== 'Converted') {
      log(A.LEAD_STATUS_CHANGED, 'Lead', lead._id, l.assignedTo?._id ?? admin._id, { status: l.status }, { status: 'New' }, daysAgo(l.age - 1));
    }
  }
  console.log(`Created ${leads.length} leads`);

  // ---------- Conversions: Lead -> Customer -> Deal ----------
  const dealPlan = [
    { stage: 'Won', value: 250000, closeIn: -5 },
    { stage: 'Won', value: 180000, closeIn: -2 },
    { stage: 'Negotiation', value: 320000, closeIn: 20 },
    { stage: 'Proposal', value: 150000, closeIn: 35 },
    { stage: 'Lost', value: 90000, closeIn: -1, lostReason: 'Budget was cut for this year' },
  ];

  const convertedLeads = leads.filter((l) => l.status === 'Converted');
  const customers = [];
  const deals = [];

  for (const [i, lead] of convertedLeads.entries()) {
    const plan = dealPlan[i];
    const convertedAt = daysAgo(Math.max(1, leadSeed.find((s) => s.email === lead.email).age - 7));

    const customer = await Customer.create({
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      address: { city: 'Bengaluru', state: 'Karnataka', country: 'India' },
      lead: lead._id,
      assignedTo: lead.assignedTo,
      createdBy: admin._id,
    });

    const closed = ['Won', 'Lost'].includes(plan.stage);
    const deal = await Deal.create({
      name: `${lead.company} - Annual Plan`,
      lead: lead._id,
      customer: customer._id,
      assignedTo: lead.assignedTo,
      createdBy: admin._id,
      value: plan.value,
      expectedCloseDate: closed ? daysAgo(-plan.closeIn) : daysFromNow(plan.closeIn),
      stage: plan.stage,
      description: 'Annual subscription',
      lostReason: plan.lostReason,
      closedAt: closed ? daysAgo(Math.abs(plan.closeIn)) : undefined,
    });

    await Lead.updateOne(
      { _id: lead._id },
      { $set: { convertedAt, convertedCustomer: customer._id, convertedDeal: deal._id } }
    );

    customers.push(customer);
    deals.push(deal);

    log(A.LEAD_STATUS_CHANGED, 'Lead', lead._id, lead.assignedTo, { status: 'Qualified' }, { status: 'Contacted' }, daysAgo(10));
    log(A.LEAD_CONVERTED, 'Lead', lead._id, admin._id, { status: 'Converted', customerId: customer._id, dealId: deal._id }, { status: 'Qualified' }, convertedAt);
    log(A.CUSTOMER_CREATED, 'Customer', customer._id, admin._id, { name: customer.name, fromLead: lead._id }, null, convertedAt);
    log(A.DEAL_CREATED, 'Deal', deal._id, admin._id, { name: deal.name, value: deal.value, stage: 'Qualification' }, null, convertedAt);
    if (plan.stage !== 'Qualification') {
      log(A.DEAL_STAGE_CHANGED, 'Deal', deal._id, lead.assignedTo, { stage: deal.stage, probability: deal.probability, expectedRevenue: deal.expectedRevenue }, { stage: 'Qualification' }, daysAgo(3));
    }
    if (plan.stage === 'Won') log(A.DEAL_WON, 'Deal', deal._id, lead.assignedTo, { value: deal.value }, null, deal.closedAt);
    if (plan.stage === 'Lost') log(A.DEAL_LOST, 'Deal', deal._id, lead.assignedTo, { lostReason: plan.lostReason }, null, deal.closedAt);
  }

  // A customer created directly (not from a lead) with an early-stage deal
  const directCustomer = await Customer.create({
    name: 'Priya Patel',
    email: 'priya@globex-retail.example',
    phone: '9988776655',
    company: 'Globex Retail',
    address: { city: 'Pune', country: 'India' },
    assignedTo: exec3._id,
    createdBy: manager2._id,
  });
  const directDeal = await Deal.create({
    name: 'Globex Retail - Pilot',
    customer: directCustomer._id,
    assignedTo: exec3._id,
    createdBy: manager2._id,
    value: 60000,
    expectedCloseDate: daysFromNow(45),
    stage: 'Discovery',
  });
  customers.push(directCustomer);
  deals.push(directDeal);
  log(A.CUSTOMER_CREATED, 'Customer', directCustomer._id, manager2._id, { name: directCustomer.name });
  log(A.DEAL_CREATED, 'Deal', directDeal._id, manager2._id, { name: directDeal.name, value: directDeal.value, stage: 'Discovery' });

  console.log(`Created ${customers.length} customers and ${deals.length} deals`);

  // ---------- Activities ----------
  const [rahulCustomer, anitaCustomer, vikramCustomer] = customers;
  const negotiationDeal = deals.find((d) => d.stage === 'Negotiation');
  const qualifiedLead = leads.find((l) => l.name === 'Sneha Kulkarni');
  const contactedLead = leads.find((l) => l.name === 'Pooja Shah');

  const activities = await Activity.create([
    {
      type: 'Follow-up', title: 'Call Rahul about onboarding', description: 'Confirm start date for 50 users',
      dueDate: daysFromNow(3), assignedTo: exec2._id, createdBy: manager1._id,
      relatedType: 'Customer', relatedId: rahulCustomer._id,
    },
    {
      type: 'Meeting', title: 'Contract review with Vikram', dueDate: daysFromNow(5),
      assignedTo: exec3._id, createdBy: manager2._id, relatedType: 'Customer', relatedId: vikramCustomer._id,
    },
    {
      type: 'Demo', title: 'Product demo for Stark Traders', dueDate: daysFromNow(2),
      assignedTo: exec1._id, createdBy: exec1._id, relatedType: 'Lead', relatedId: qualifiedLead._id,
    },
    {
      type: 'Follow-up', title: 'Send revised pricing', description: 'Overdue on purpose for the demo',
      dueDate: daysAgo(2), assignedTo: exec2._id, createdBy: exec2._id, relatedType: 'Lead', relatedId: contactedLead._id,
    },
    {
      type: 'Call', title: 'Negotiation call - discount discussion', dueDate: daysAgo(1),
      assignedTo: exec3._id, createdBy: manager2._id, relatedType: 'Deal', relatedId: negotiationDeal._id,
    },
    {
      type: 'Email', title: 'Send welcome kit to Anita', status: 'Completed', dueDate: daysAgo(4), completedAt: daysAgo(4),
      outcome: 'Welcome kit delivered', assignedTo: exec1._id, createdBy: exec1._id,
      relatedType: 'Customer', relatedId: anitaCustomer._id,
    },
    {
      type: 'Note', title: 'Client asked for 10% discount', status: 'Completed', completedAt: daysAgo(3),
      assignedTo: exec3._id, createdBy: exec3._id, relatedType: 'Deal', relatedId: negotiationDeal._id,
    },
    {
      type: 'Reminder', title: 'Prepare monthly sales report', dueDate: daysFromNow(7),
      assignedTo: manager1._id, createdBy: manager1._id, relatedType: 'User', relatedId: manager1._id,
    },
  ]);

  for (const act of activities) {
    if (!['Lead', 'Customer', 'Deal'].includes(act.relatedType)) continue;
    const action =
      act.type === 'Note' ? A.NOTE_ADDED : act.type === 'Follow-up' ? A.FOLLOW_UP_CREATED : A.ACTIVITY_CREATED;
    log(action, act.relatedType, act.relatedId, act.createdBy, { activityId: act._id, type: act.type, title: act.title });
    if (act.status === 'Completed' && act.type !== 'Note') {
      log(A.ACTIVITY_COMPLETED, act.relatedType, act.relatedId, act.assignedTo, { activityId: act._id, outcome: act.outcome }, null, act.completedAt);
    }
  }
  console.log(`Created ${activities.length} activities (2 overdue, 2 completed)`);

  // ---------- Timeline ----------
  const now = new Date();
  await Timeline.insertMany(timeline.map((t) => ({ ...t, createdAt: t.createdAt || now })));
  console.log(`Created ${timeline.length} timeline entries`);

  console.log('\nSeed complete. Login credentials:');
  console.table([
    { role: 'admin', email: 'admin@crm.com', password: PASSWORDS.admin },
    { role: 'sales_manager', email: 'manager1@crm.com', password: PASSWORDS.manager },
    { role: 'sales_manager', email: 'manager2@crm.com', password: PASSWORDS.manager },
    { role: 'sales_executive', email: 'exec1@crm.com', password: PASSWORDS.executive },
    { role: 'sales_executive', email: 'exec2@crm.com', password: PASSWORDS.executive },
    { role: 'sales_executive', email: 'exec3@crm.com', password: PASSWORDS.executive },
    { role: 'sales_executive (inactive)', email: 'exec4@crm.com', password: PASSWORDS.executive },
  ]);
};

run()
  .catch((err) => {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
