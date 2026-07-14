const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/adminController');

const router = express.Router();

router.use(protect, authorize('admin'));

router.post('/zones', ctrl.createZone);
router.get('/zones', ctrl.listZones);
router.put('/zones/:id', ctrl.updateZone);
router.delete('/zones/:id', ctrl.deleteZone);

router.post('/rate-cards', ctrl.upsertRateCard);
router.get('/rate-cards', ctrl.listRateCards);

router.post('/cod-surcharge', ctrl.upsertCodSurcharge);
router.get('/cod-surcharge', ctrl.listCodSurcharges);

router.post('/agents', ctrl.createAgent);
router.get('/agents', ctrl.listAgents);

module.exports = router;
