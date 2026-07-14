const mongoose = require('mongoose');

/**
 * COD surcharge is configured per order type (B2B/B2C), admin-configurable.
 * Supports either a flat amount or a percentage of the base+weight charge.
 */
const codSurchargeSchema = new mongoose.Schema(
  {
    orderType: { type: String, enum: ['B2B', 'B2C'], required: true, unique: true },
    surchargeType: { type: String, enum: ['flat', 'percentage'], required: true, default: 'flat' },
    value: { type: Number, required: true, min: 0 }, // flat amount OR percentage value (e.g. 2 = 2%)
  },
  { timestamps: true }
);

module.exports = mongoose.model('CodSurcharge', codSurchargeSchema);
