const mongoose = require('mongoose');

const zoneSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true }, // e.g. "North Delhi"
    code: { type: String, required: true, unique: true, uppercase: true, trim: true }, // e.g. "NDL"
    // Areas (pincodes) mapped to this zone. Used for zone detection during order creation.
    pincodes: [{ type: String, trim: true }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Zone', zoneSchema);
