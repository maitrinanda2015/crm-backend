const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const Customer = require('../models/Customer');
const Deal = require('../models/Deal');
const Activity = require('../models/Activity');
const User = require('../models/User');
const { ROLES, LEAD_STATUSES, DEAL_STAGES } = require('../config/constants');
const { getAccessFilter } = require('../utils/access');
const { getDateRange } = require('../utils/queryHelper');

const round2 = (n) => Math.round((n || 0) * 100) / 100;
const pct = (part, whole) => (whole ? round2((part / whole) * 100) : 0);

// Role-based access + optional createdAt range, usable in find() and aggregate()
const buildMatch = async (user, query) => {
  const conditions = [await getAccessFilter(user)];
  const createdAt = getDateRange(query.from, query.to);
  if (createdAt) conditions.push({ createdAt });
  return { $and: conditions };
};

// ---------- GET /dashboard/stats ----------
const getStats = async (user, query) => {
  const match = await buildMatch(user, query);
  const activityAccess = await getAccessFilter(user);
  const now = new Date();

  const [leadGroups, totalCustomers, dealGroups, pendingActivities, overdueActivities] = await Promise.all([
    Lead.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Customer.countDocuments(match),
    Deal.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$status', // Open / Won / Lost
          count: { $sum: 1 },
          value: { $sum: '$value' },
          expectedRevenue: { $sum: '$expectedRevenue' },
        },
      },
    ]),
    Activity.countDocuments({
      $and: [activityAccess, { status: 'Pending' }, { $or: [{ dueDate: { $gte: now } }, { dueDate: null }] }],
    }),
    Activity.countDocuments({ $and: [activityAccess, { status: 'Pending', dueDate: { $lt: now } }] }),
  ]);

  // Leads by status (every status present, even if 0)
  const leadsByStatus = Object.fromEntries(LEAD_STATUSES.map((s) => [s, 0]));
  leadGroups.forEach((g) => { leadsByStatus[g._id] = g.count; });
  const totalLeads = Object.values(leadsByStatus).reduce((a, b) => a + b, 0);

  // Deals by status
  const empty = { count: 0, value: 0, expectedRevenue: 0 };
  const deals = { Open: { ...empty }, Won: { ...empty }, Lost: { ...empty } };
  dealGroups.forEach((g) => { deals[g._id] = g; });
  const totalDeals = deals.Open.count + deals.Won.count + deals.Lost.count;

  return {
    leads: {
      total: totalLeads,
      new: leadsByStatus.New,
      contacted: leadsByStatus.Contacted,
      qualified: leadsByStatus.Qualified,
      unqualified: leadsByStatus.Unqualified,
      converted: leadsByStatus.Converted,
      lost: leadsByStatus.Lost,
    },
    customers: { total: totalCustomers },
    deals: {
      total: totalDeals,
      open: deals.Open.count,
      won: deals.Won.count,
      lost: deals.Lost.count,
    },
    revenue: {
      totalRevenue: round2(deals.Won.value), // closed-won value
      expectedRevenue: round2(deals.Open.expectedRevenue), // weighted open pipeline
      openPipelineValue: round2(deals.Open.value),
    },
    rates: {
      conversionRate: pct(leadsByStatus.Converted, totalLeads), // % of leads converted
      winRate: pct(deals.Won.count, deals.Won.count + deals.Lost.count), // % of closed deals won
    },
    activities: {
      pending: pendingActivities,
      overdue: overdueActivities,
    },
  };
};

// ---------- GET /dashboard/pipeline ----------
const getPipeline = async (user, query) => {
  const match = await buildMatch(user, query);

  const groups = await Deal.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$stage',
        count: { $sum: 1 },
        totalValue: { $sum: '$value' },
        expectedRevenue: { $sum: '$expectedRevenue' },
        avgProbability: { $avg: '$probability' },
      },
    },
  ]);

  const byStage = Object.fromEntries(groups.map((g) => [g._id, g]));

  // Every stage, in pipeline order, even when empty
  const stages = DEAL_STAGES.map((stage) => ({
    stage,
    count: byStage[stage]?.count || 0,
    totalValue: round2(byStage[stage]?.totalValue),
    expectedRevenue: round2(byStage[stage]?.expectedRevenue),
    avgProbability: round2(byStage[stage]?.avgProbability),
  }));

  const totals = stages.reduce(
    (acc, s) => ({
      deals: acc.deals + s.count,
      totalValue: round2(acc.totalValue + s.totalValue),
      expectedRevenue: round2(acc.expectedRevenue + s.expectedRevenue),
    }),
    { deals: 0, totalValue: 0, expectedRevenue: 0 }
  );

  return { stages, totals };
};

// ---------- GET /dashboard/team-performance ----------
const getTeamPerformance = async (user, query) => {
  // Which executives: manager -> own team, admin -> all (or one manager's team)
  const userFilter = { role: ROLES.SALES_EXECUTIVE };
  if (user.role === ROLES.SALES_MANAGER) userFilter.manager = user._id;
  else if (query.manager) userFilter.manager = new mongoose.Types.ObjectId(query.manager);

  const executives = await User.find(userFilter)
    .select('name email isActive manager')
    .populate('manager', 'name')
    .lean();
  const ids = executives.map((e) => e._id);

  const createdAt = getDateRange(query.from, query.to);
  const base = { assignedTo: { $in: ids }, ...(createdAt && { createdAt }) };
  const now = new Date();
  const isStatus = (s) => ({ $eq: ['$status', s] });

  // One aggregation per collection, grouped by executive (no N+1 queries)
  const [leadStats, dealStats, activityStats] = await Promise.all([
    Lead.aggregate([
      { $match: base },
      {
        $group: {
          _id: '$assignedTo',
          total: { $sum: 1 },
          converted: { $sum: { $cond: [isStatus('Converted'), 1, 0] } },
        },
      },
    ]),
    Deal.aggregate([
      { $match: base },
      {
        $group: {
          _id: '$assignedTo',
          total: { $sum: 1 },
          won: { $sum: { $cond: [isStatus('Won'), 1, 0] } },
          lost: { $sum: { $cond: [isStatus('Lost'), 1, 0] } },
          revenueWon: { $sum: { $cond: [isStatus('Won'), '$value', 0] } },
          openPipelineValue: { $sum: { $cond: [isStatus('Open'), '$value', 0] } },
          expectedRevenue: { $sum: { $cond: [isStatus('Open'), '$expectedRevenue', 0] } },
        },
      },
    ]),
    Activity.aggregate([
      { $match: { assignedTo: { $in: ids }, status: 'Pending' } },
      {
        $group: {
          _id: '$assignedTo',
          open: { $sum: 1 },
          overdue: {
            $sum: {
              $cond: [
                { $and: [{ $eq: [{ $type: '$dueDate' }, 'date'] }, { $lt: ['$dueDate', now] }] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),
  ]);

  const toMap = (rows) => new Map(rows.map((r) => [String(r._id), r]));
  const L = toMap(leadStats);
  const D = toMap(dealStats);
  const Ac = toMap(activityStats);

  const team = executives
    .map((e) => {
      const id = String(e._id);
      const l = L.get(id) || {};
      const d = D.get(id) || {};
      const a = Ac.get(id) || {};
      return {
        user: { _id: e._id, name: e.name, email: e.email, isActive: e.isActive, manager: e.manager },
        leads: {
          total: l.total || 0,
          converted: l.converted || 0,
          conversionRate: pct(l.converted || 0, l.total || 0),
        },
        deals: {
          total: d.total || 0,
          won: d.won || 0,
          lost: d.lost || 0,
          winRate: pct(d.won || 0, (d.won || 0) + (d.lost || 0)),
        },
        revenue: {
          won: round2(d.revenueWon),
          openPipelineValue: round2(d.openPipelineValue),
          expectedRevenue: round2(d.expectedRevenue),
        },
        activities: {
          pending: (a.open || 0) - (a.overdue || 0),
          overdue: a.overdue || 0,
        },
      };
    })
    .sort((x, y) => y.revenue.won - x.revenue.won); // top performers first

  const summary = team.reduce(
    (acc, m) => ({
      members: acc.members + 1,
      leads: acc.leads + m.leads.total,
      convertedLeads: acc.convertedLeads + m.leads.converted,
      dealsWon: acc.dealsWon + m.deals.won,
      revenueWon: round2(acc.revenueWon + m.revenue.won),
      overdueActivities: acc.overdueActivities + m.activities.overdue,
    }),
    { members: 0, leads: 0, convertedLeads: 0, dealsWon: 0, revenueWon: 0, overdueActivities: 0 }
  );
  summary.conversionRate = pct(summary.convertedLeads, summary.leads);

  return { summary, team };
};

module.exports = { getStats, getPipeline, getTeamPerformance };