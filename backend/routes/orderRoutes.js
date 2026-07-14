const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/orderController');

const router = express.Router();

router.use(protect);

router.post('/quote', authorize('customer', 'admin'), ctrl.getQuote);
router.post('/', authorize('customer', 'admin'), ctrl.createOrder);
router.get('/', ctrl.listOrders); // filtered by role inside controller
router.get('/:id', ctrl.getOrder);

router.patch('/:id/assign', authorize('admin'), ctrl.assignAgent);
router.patch('/:id/status', authorize('agent', 'admin'), ctrl.updateStatus);
router.post('/:id/reschedule', authorize('customer', 'admin'), ctrl.rescheduleOrder);

module.exports = router;
