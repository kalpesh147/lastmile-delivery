const mongoose = require('mongoose');

const notificationLogSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    recipientEmail: { type: String, required: true },
    event: { type: String, required: true }, // e.g. "status_change:Delivered"
    channel: { type: String, enum: ['email', 'sms'], default: 'email' },
    status: { type: String, enum: ['sent', 'failed'], required: true },
    errorMessage: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('NotificationLog', notificationLogSchema);
