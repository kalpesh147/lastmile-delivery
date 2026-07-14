const mongoose = require('mongoose');

const STATUS_VALUES = [
  'Created',
  'Picked Up',
  'In Transit',
  'Out for Delivery',
  'Delivered',
  'Failed',
  'Rescheduled',
];

// Each entry is append-only. Nothing in this array is ever edited/deleted -
// this is what gives us an immutable tracking timeline.
const statusHistoryEntrySchema = new mongoose.Schema(
  {
    status: { type: String, enum: STATUS_VALUES, required: true },
    timestamp: { type: Date, default: Date.now, required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // who made this change
    actorRole: { type: String, enum: ['customer', 'agent', 'admin', 'system'], required: true },
    note: { type: String, trim: true },
  },
  { _id: true }
);

const rescheduleEntrySchema = new mongoose.Schema(
  {
    previousDeliveryDate: { type: Date },
    newDeliveryDate: { type: Date, required: true },
    reason: { type: String, trim: true },
    requestedAt: { type: Date, default: Date.now },
    reassignedAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: true }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },

    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // customer OR admin who created it

    pickupAddress: {
      addressLine: { type: String, required: true },
      pincode: { type: String, required: true },
      zone: { type: mongoose.Schema.Types.ObjectId, ref: 'Zone', required: true },
    },
    dropAddress: {
      addressLine: { type: String, required: true },
      pincode: { type: String, required: true },
      zone: { type: mongoose.Schema.Types.ObjectId, ref: 'Zone', required: true },
    },
    zoneRelation: { type: String, enum: ['intra', 'inter'], required: true },

    package: {
      length: { type: Number, required: true }, // cm
      breadth: { type: Number, required: true }, // cm
      height: { type: Number, required: true }, // cm
      actualWeight: { type: Number, required: true }, // kg
      volumetricWeight: { type: Number, required: true }, // computed: (L*B*H)/5000
      chargeableWeight: { type: Number, required: true }, // max(actual, volumetric)
    },

    orderType: { type: String, enum: ['B2B', 'B2C'], required: true },
    paymentType: { type: String, enum: ['Prepaid', 'COD'], required: true },

    charge: {
      baseRate: { type: Number, required: true },
      weightCharge: { type: Number, required: true }, // perKgRate * chargeableWeight
      codSurcharge: { type: Number, default: 0 },
      totalCharge: { type: Number, required: true },
      rateCardUsed: { type: mongoose.Schema.Types.ObjectId, ref: 'RateCard' },
    },

    status: { type: String, enum: STATUS_VALUES, default: 'Created', required: true },
    assignedAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Append-only audit trail - the immutable tracking timeline
    statusHistory: { type: [statusHistoryEntrySchema], default: [] },

    // Failed delivery -> reschedule flow
    rescheduleHistory: { type: [rescheduleEntrySchema], default: [] },
    requestedDeliveryDate: { type: Date },

    isOverridden: { type: Boolean, default: false }, // true if admin manually overrode status
  },
  { timestamps: true }
);

orderSchema.statics.STATUS_VALUES = STATUS_VALUES;

module.exports = mongoose.model('Order', orderSchema);
