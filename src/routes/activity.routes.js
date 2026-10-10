const express = require('express');
const controller = require('../controllers/activity.controller');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { idParam } = require('../validators/common');
const schemas = require('../validators/activity.validator');

const router = express.Router();

router.use(protect);

router
  .route('/')
  .post(validate({ body: schemas.createActivity }), controller.createActivity)
  .get(validate({ query: schemas.listActivities }), controller.listActivities);

router
  .route('/:id')
  .get(validate({ params: idParam }), controller.getActivity)
  .patch(validate({ params: idParam, body: schemas.updateActivity }), controller.updateActivity)
  .delete(validate({ params: idParam }), controller.deleteActivity);

router.patch(
  '/:id/complete',
  validate({ params: idParam, body: schemas.completeActivity }),
  controller.completeActivity
);

module.exports = router;