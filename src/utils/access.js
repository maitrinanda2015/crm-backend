const User = require('../models/User');
const { ROLES } = require('../config/constants');

// IDs of the sales executives who report to this manager
const getTeamIds = (managerId) => User.distinct('_id', { manager: managerId });

/**
 * Returns a MongoDB filter limiting records to what the user may access.
 *  - admin:     everything
 *  - manager:   records assigned to self/team members, or created by self
 *  - executive: only records assigned to them
 */
const getAccessFilter = async (user, field = 'assignedTo') => {
  if (user.role === ROLES.ADMIN) return {};

  if (user.role === ROLES.SALES_MANAGER) {
    const teamIds = await getTeamIds(user._id);
    return {
      $or: [{ [field]: { $in: [user._id, ...teamIds] } }, { createdBy: user._id }],
    };
  }

  return { [field]: user._id };
};

module.exports = { getTeamIds, getAccessFilter };