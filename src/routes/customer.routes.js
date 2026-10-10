const express = require('express');
const controller = require('../controllers/customer.controller');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');
const { idParam } = require('../validators/common');
const schemas = require('../validators/customer.validator');

const router = express.Router();

router.use(protect);

router
  .route('/')
  .post(validate({ body: schemas.createCustomer }), controller.createCustomer)
  .get(validate({ query: schemas.listCustomers }), controller.listCustomers);

router
  .route('/:id')
  .get(validate({ params: idParam }), controller.getCustomer)
  .patch(validate({ params: idParam, body: schemas.updateCustomer }), controller.updateCustomer)
  .delete(
    authorize(ROLES.ADMIN, ROLES.SALES_MANAGER),
    validate({ params: idParam }),
    controller.deleteCustomer
  );

router.get('/:id/timeline', validate({ params: idParam }), controller.getTimeline);

module.exports = router;