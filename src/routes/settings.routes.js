const express = require('express');
const controller = require('../controllers/settings.controller');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');
const schemas = require('../validators/settings.validator');

const router = express.Router();

router.use(protect);

router
  .route('/')
  .get(controller.getSettings) // every logged-in user can read the configuration
  .patch(authorize(ROLES.ADMIN), validate({ body: schemas.updateSettings }), controller.updateSettings);

module.exports = router;