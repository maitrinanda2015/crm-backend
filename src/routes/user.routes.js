const express = require('express');
const controller = require('../controllers/user.controller');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');
const { idParam } = require('../validators/common');
const schemas = require('../validators/user.validator');

const router = express.Router();

router.use(protect); // every route below needs login

// Manager sees own team, admin sees all executives (must be before /:id)
router.get(
  '/team',
  authorize(ROLES.ADMIN, ROLES.SALES_MANAGER),
  validate({ query: schemas.listUsers }),
  controller.getTeam
);

// Everything below: admin only
router.use(authorize(ROLES.ADMIN));

router
  .route('/')
  .post(validate({ body: schemas.createUser }), controller.createUser)
  .get(validate({ query: schemas.listUsers }), controller.listUsers);

router
  .route('/:id')
  .get(validate({ params: idParam }), controller.getUser)
  .patch(validate({ params: idParam, body: schemas.updateUser }), controller.updateUser)
  .delete(validate({ params: idParam }), controller.deleteUser);

router.patch(
  '/:id/status',
  validate({ params: idParam, body: schemas.updateStatus }),
  controller.updateStatus
);

module.exports = router;