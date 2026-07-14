const Zone = require('../models/Zone');
const RateCard = require('../models/RateCard');
const CodSurcharge = require('../models/CodSurcharge');

/**
 * Detect which Zone a given pincode belongs to.
 * Throws if no zone is configured for that pincode - admin must map it first.
 */
async function detectZoneForPincode(pincode) {
  const zone = await Zone.findOne({ pincodes: pincode });
  if (!zone) {
    const err = new Error(
      `No zone is configured for pincode "${pincode}". Ask admin to map this area to a zone first.`
    );
    err.statusCode = 400;
    throw err;
  }
  return zone;
}

/**
 * Volumetric weight formula (industry standard divisor 5000):
 * volumetricWeight (kg) = (Length_cm * Breadth_cm * Height_cm) / 5000
 */
function calculateVolumetricWeight(length, breadth, height) {
  return (length * breadth * height) / 5000;
}

/**
 * Chargeable weight = higher of actual vs volumetric weight.
 */
function calculateChargeableWeight(actualWeight, volumetricWeight) {
  return Math.max(actualWeight, volumetricWeight);
}

/**
 * Full charge computation for an order. Pulls rate cards and COD surcharge
 * config from the DB (admin-configured), never hardcodes numbers.
 *
 * @param {Object} params
 * @param {string} params.pickupPincode
 * @param {string} params.dropPincode
 * @param {number} params.length
 * @param {number} params.breadth
 * @param {number} params.height
 * @param {number} params.actualWeight
 * @param {'B2B'|'B2C'} params.orderType
 * @param {'Prepaid'|'COD'} params.paymentType
 */
async function computeOrderCharge({
  pickupPincode,
  dropPincode,
  length,
  breadth,
  height,
  actualWeight,
  orderType,
  paymentType,
}) {
  // 1. Zone detection
  const pickupZone = await detectZoneForPincode(pickupPincode);
  const dropZone = await detectZoneForPincode(dropPincode);
  const zoneRelation = String(pickupZone._id) === String(dropZone._id) ? 'intra' : 'inter';

  // 2. Volumetric & chargeable weight
  const volumetricWeight = calculateVolumetricWeight(length, breadth, height);
  const chargeableWeight = calculateChargeableWeight(actualWeight, volumetricWeight);

  // 3. Rate card lookup (admin-configured, no hardcoding)
  const rateCard = await RateCard.findOne({ orderType, zoneRelation });
  if (!rateCard) {
    const err = new Error(
      `No rate card configured for orderType=${orderType}, zoneRelation=${zoneRelation}. Admin must configure this first.`
    );
    err.statusCode = 400;
    throw err;
  }

  const baseRate = rateCard.baseRate;
  const weightCharge = rateCard.perKgRate * chargeableWeight;
  let subtotal = baseRate + weightCharge;

  // 4. COD surcharge (admin-configured, per order type)
  let codSurcharge = 0;
  if (paymentType === 'COD') {
    const codConfig = await CodSurcharge.findOne({ orderType });
    if (codConfig) {
      codSurcharge =
        codConfig.surchargeType === 'flat' ? codConfig.value : (subtotal * codConfig.value) / 100;
    }
  }

  const totalCharge = Math.round((subtotal + codSurcharge) * 100) / 100;

  return {
    pickupZone,
    dropZone,
    zoneRelation,
    volumetricWeight: Math.round(volumetricWeight * 100) / 100,
    chargeableWeight: Math.round(chargeableWeight * 100) / 100,
    charge: {
      baseRate,
      weightCharge: Math.round(weightCharge * 100) / 100,
      codSurcharge: Math.round(codSurcharge * 100) / 100,
      totalCharge,
      rateCardUsed: rateCard._id,
    },
  };
}

module.exports = {
  detectZoneForPincode,
  calculateVolumetricWeight,
  calculateChargeableWeight,
  computeOrderCharge,
};
