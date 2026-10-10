const express = require('express');
const controller = require('../controllers/lead.controller');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');
const { idParam } = require('../validators/common');
const schemas = require('../validators/lead.validator');
const { convertLead } = require('../validators/conversion.validator');

const router = express.Router();
const ADMIN_OR_MANAGER = [ROLES.ADMIN, ROLES.SALES_MANAGER];

router.use(protect);

router
  .route('/')
  .post(validate({ body: schemas.createLead }), controller.createLead)
  .get(validate({ query: schemas.listLeads }), controller.listLeads);

router
  .route('/:id')
  .get(validate({ params: idParam }), controller.getLead)
  .patch(validate({ params: idParam, body: schemas.updateLead }), controller.updateLead)
  .delete(authorize(...ADMIN_OR_MANAGER), validate({ params: idParam }), controller.deleteLead);

router.patch('/:id/status', validate({ params: idParam, body: schemas.updateStatus }), controller.updateStatus);

router.patch(
  '/:id/assign',
  authorize(...ADMIN_OR_MANAGER),
  validate({ params: idParam, body: schemas.assignLead }),
  controller.assignLead
);

router.post('/:id/convert', validate({ params: idParam, body: convertLead }), controller.convertLead);

router.get('/:id/timeline', validate({ params: idParam }), controller.getTimeline);

module.exports = router;