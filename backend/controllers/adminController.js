const Zone = require('../models/Zone');
const RateCard = require('../models/RateCard');
const CodSurcharge = require('../models/CodSurcharge');
const User = require('../models/User');

/* ---------------- Zones ---------------- */

// POST /api/admin/zones  { name, code, pincodes: [] }
async function createZone(req, res, next) {
  try {
    const { name, code, pincodes } = req.body;
    const zone = await Zone.create({ name, code, pincodes: pincodes || [] });
    res.status(201).json(zone);
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/zones
async function listZones(req, res, next) {
  try {
    const zones = await Zone.find().sort({ name: 1 });
    res.json(zones);
  } catch (err) {
    next(err);
  }
}

// PUT /api/admin/zones/:id  - update zone / add-remove pincodes
async function updateZone(req, res, next) {
  try {
    const zone = await Zone.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!zone) return res.status(404).json({ message: 'Zone not found' });
    res.json(zone);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/admin/zones/:id
async function deleteZone(req, res, next) {
  try {
    await Zone.findByIdAndDelete(req.params.id);
    res.json({ message: 'Zone deleted' });
  } catch (err) {
    next(err);
  }
}

/* ---------------- Rate Cards ---------------- */

// POST /api/admin/rate-cards  { orderType, zoneRelation, baseRate, perKgRate }
async function upsertRateCard(req, res, next) {
  try {
    const { orderType, zoneRelation, baseRate, perKgRate } = req.body;
    const rateCard = await RateCard.findOneAndUpdate(
      { orderType, zoneRelation },
      { baseRate, perKgRate },
      { new: true, upsert: true, runValidators: true }
    );
    res.status(201).json(rateCard);
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/rate-cards
async function listRateCards(req, res, next) {
  try {
    const cards = await RateCard.find();
    res.json(cards);
  } catch (err) {
    next(err);
  }
}

/* ---------------- COD Surcharge ---------------- */

// POST /api/admin/cod-surcharge  { orderType, surchargeType, value }
async function upsertCodSurcharge(req, res, next) {
  try {
    const { orderType, surchargeType, value } = req.body;
    const config = await CodSurcharge.findOneAndUpdate(
      { orderType },
      { surchargeType, value },
      { new: true, upsert: true, runValidators: true }
    );
    res.status(201).json(config);
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/cod-surcharge
async function listCodSurcharges(req, res, next) {
  try {
    const configs = await CodSurcharge.find();
    res.json(configs);
  } catch (err) {
    next(err);
  }
}

/* ---------------- Agent / Staff management ---------------- */

// POST /api/admin/agents  { name, email, password, phone, zone }
async function createAgent(req, res, next) {
  try {
    const { name, email, password, phone, zone } = req.body;
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ message: 'Email already registered' });
    const agent = await User.create({
      name,
      email,
      password,
      phone,
      zone,
      role: 'agent',
      isAvailable: true,
    });
    res.status(201).json({ id: agent._id, name: agent.name, email: agent.email, zone: agent.zone });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/agents
async function listAgents(req, res, next) {
  try {
    const agents = await User.find({ role: 'agent' }).populate('zone', 'name code');
    res.json(agents);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createZone,
  listZones,
  updateZone,
  deleteZone,
  upsertRateCard,
  listRateCards,
  upsertCodSurcharge,
  listCodSurcharges,
  createAgent,
  listAgents,
};
