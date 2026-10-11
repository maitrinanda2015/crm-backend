const Setting = require('../models/Setting');
const ApiError = require('../utils/ApiError');

const ACTIVE_STAGES = ['Qualification', 'Discovery', 'Proposal', 'Negotiation'];
const FIXED_PROBABILITY = { Won: 100, Lost: 0 };

// Returns the settings document, creating it with defaults the first time
const getSettings = async () => {
  let settings = await Setting.findOne({ key: 'crm' });
  if (!settings) {
    try {
      settings = await Setting.create({ key: 'crm' });
    } catch (err) {
      if (err.code !== 11000) throw err; // created by a parallel request
      settings = await Setting.findOne({ key: 'crm' });
    }
  }
  return settings;
};

// Default probability for a stage, taken from the CRM configuration
const getStageProbability = async (stage) => {
  if (stage in FIXED_PROBABILITY) return FIXED_PROBABILITY[stage];
  const settings = await getSettings();
  return settings.stageProbabilities?.[stage] ?? 10;
};

const updateSettings = async (data, user) => {
  const settings = await getSettings();

  if (data.companyName !== undefined) settings.companyName = data.companyName;
  if (data.currency !== undefined) settings.currency = data.currency;
  if (data.stageProbabilities) {
    for (const [stage, value] of Object.entries(data.stageProbabilities)) {
      settings.stageProbabilities[stage] = value;
    }
  }

  // Business rule: probability must not decrease as a deal moves through the pipeline
  const p = settings.stageProbabilities;
  for (let i = 0; i < ACTIVE_STAGES.length - 1; i += 1) {
    if (p[ACTIVE_STAGES[i]] > p[ACTIVE_STAGES[i + 1]]) {
      throw ApiError.badRequest(
        'Stage probabilities must not decrease along the pipeline (Qualification <= Discovery <= Proposal <= Negotiation)'
      );
    }
  }

  settings.updatedBy = user._id;
  await settings.save();
  return settings.populate('updatedBy', 'name email');
};

module.exports = { getSettings, getStageProbability, updateSettings };