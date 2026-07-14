const mongoose = require('mongoose');

/**
 * A RateCard defines pricing for a specific combination of:
 *  - orderType: B2B or B2C
 *  - zoneRelation: intra (pickup & drop in same zone) or inter (different zones)
 *
 * This keeps rate configuration fully admin-driven and avoids hardcoding
 * any pricing logic in application code.
 */
const rateCardSchema = new mongoose.Schema(
  {
    orderType: { type: String, enum: ['B2B', 'B2C'], required: true },
    zoneRelation: { type: String, enum: ['intra', 'inter'], required: true },
    baseRate: { type: Number, required: true, min: 0 }, // flat charge applied to every order of this type
    perKgRate: { type: Number, required: true, min: 0 }, // charge per kg of chargeable weight
  },
  { timestamps: true }
);

// Only one active rate card per (orderType, zoneRelation) combination
rateCardSchema.index({ orderType: 1, zoneRelation: 1 }, { unique: true });

module.exports = mongoose.model('RateCard', rateCardSchema);
