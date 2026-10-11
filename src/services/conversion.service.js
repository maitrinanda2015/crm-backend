const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const Customer = require('../models/Customer');
const Deal = require('../models/Deal');
const ApiError = require('../utils/ApiError');
const timeline = require('./timeline.service');
const { getAccessFilter } = require('../utils/access');
const { TIMELINE_ACTIONS: A } = require('../config/constants');
const settingsService = require('./settings.service');

/**
 * Converts a Qualified lead into a Customer (+ optional Deal) atomically.
 * Everything happens inside one MongoDB transaction: if any step fails,
 * all writes are rolled back and the lead stays Qualified.
 */
const convertLead = async (leadId, data, user) => {
    const access = await getAccessFilter(user);
  const defaultProbability =
    data.deal && data.deal.probability === undefined
      ? await settingsService.getStageProbability(data.deal.stage || 'Qualification')
      : undefined;
  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const lead = await Lead.findOne({ $and: [{ _id: leadId }, access] }).session(session);
      if (!lead) throw ApiError.notFound('Lead not found');

      // Eligibility checks
      if (lead.status === 'Converted') throw ApiError.conflict('Lead has already been converted');
      if (lead.status !== 'Qualified') {
        throw ApiError.badRequest(`Only Qualified leads can be converted (current status: ${lead.status})`);
      }
      if (!lead.assignedTo) throw ApiError.badRequest('Assign the lead to a sales executive before converting');

      // 1) Customer (keeps a reference to the original lead)
      const [customer] = await Customer.create(
        [
          {
            name: lead.name,
            email: lead.email,
            phone: lead.phone,
            company: data.customer?.company || lead.company,
            address: data.customer?.address,
            lead: lead._id,
            assignedTo: lead.assignedTo,
            createdBy: user._id,
          },
        ],
        { session }
      );

      // 2) Optional deal (references both customer and lead)
      let deal = null;
      if (data.deal) {
        [deal] = await Deal.create(
          [
                      {
              ...data.deal,
              probability: data.deal.probability ?? defaultProbability,
              lead: lead._id,
              customer: customer._id,
              assignedTo: lead.assignedTo,
              createdBy: user._id,
            },
          ],
          { session }
        );
      }

      // 3) Mark the lead converted. The status condition makes this atomic:
      //    if another request converted it first, nothing matches and we abort.
      const convertedAt = new Date();
      const update = await Lead.updateOne(
        { _id: lead._id, status: 'Qualified' },
        {
          $set: {
            status: 'Converted',
            convertedAt,
            convertedCustomer: customer._id,
            convertedDeal: deal ? deal._id : undefined,
          },
        },
        { session }
      );
      if (update.modifiedCount === 0) throw ApiError.conflict('Lead has already been converted');

      // 4) Timeline entries (inside the same transaction)
      await timeline.log(
        {
          action: A.LEAD_CONVERTED,
          entityType: 'Lead',
          entityId: lead._id,
          performedBy: user._id,
          previousValue: { status: 'Qualified' },
          newValue: { status: 'Converted', customerId: customer._id, dealId: deal?._id ?? null },
        },
        session
      );
      await timeline.log(
        {
          action: A.CUSTOMER_CREATED,
          entityType: 'Customer',
          entityId: customer._id,
          performedBy: user._id,
          newValue: { name: customer.name, fromLead: lead._id },
        },
        session
      );
      if (deal) {
        await timeline.log(
          {
            action: A.DEAL_CREATED,
            entityType: 'Deal',
            entityId: deal._id,
            performedBy: user._id,
            newValue: {
              name: deal.name,
              value: deal.value,
              stage: deal.stage,
              probability: deal.probability,
              expectedRevenue: deal.expectedRevenue,
            },
          },
          session
        );
      }

      lead.set({ status: 'Converted', convertedAt, convertedCustomer: customer._id, convertedDeal: deal?._id });
      result = { lead, customer, deal };
    });

    return result;
  } catch (err) {
    // Unique index on Customer.lead -> concurrent double conversion
    if (err.code === 11000) throw ApiError.conflict('Lead has already been converted');
    throw err;
  } finally {
    await session.endSession();
  }
};

module.exports = { convertLead };