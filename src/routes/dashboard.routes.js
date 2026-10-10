const express = require('express');
const controller = require('../controllers/dashboard.controller');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');
const { dashboardQuery } = require('../validators/dashboard.validator');

const router = express.Router();

router.use(protect);

router.get('/stats', validate({ query: dashboardQuery }), controller.getStats);
router.get('/pipeline', validate({ query: dashboardQuery }), controller.getPipeline);
router.get(
  '/team-performance',
  authorize(ROLES.ADMIN, ROLES.SALES_MANAGER),
  validate({ query: dashboardQuery }),
  controller.getTeamPerformance
);

module.exports = router;