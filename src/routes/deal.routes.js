const express = require('express');
const controller = require('../controllers/deal.controller');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');
const { idParam } = require('../validators/common');
const schemas = require('../validators/deal.validator');

const router = express.Router();
const ADMIN_OR_MANAGER = [ROLES.ADMIN, ROLES.SALES_MANAGER];

router.use(protect);

router
  .route('/')
  .post(validate({ body: schemas.createDeal }), controller.createDeal)
  .get(validate({ query: schemas.listDeals }), controller.listDeals);

router
  .route('/:id')
  .get(validate({ params: idParam }), controller.getDeal)
  .patch(validate({ params: idParam, body: schemas.updateDeal }), controller.updateDeal)
  .delete(authorize(...ADMIN_OR_MANAGER), validate({ params: idParam }), controller.deleteDeal);

router.patch('/:id/stage', validate({ params: idParam, body: schemas.changeStage }), controller.changeStage);

router.patch(
  '/:id/assign',
  authorize(...ADMIN_OR_MANAGER),
  validate({ params: idParam, body: schemas.assignDeal }),
  controller.assignDeal
);

router.get('/:id/timeline', validate({ params: idParam }), controller.getTimeline);

module.exports = router;