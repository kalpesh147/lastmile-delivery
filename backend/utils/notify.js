const nodemailer = require('nodemailer');
const NotificationLog = require('../models/NotificationLog');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  // Works with any SMTP provider on a free tier (Gmail App Password, Brevo/Sendinblue, Mailtrap, etc.)
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return transporter;
}

/**
 * Send a status-change email to the customer and log the attempt.
 * Never throws - a notification failure should not break the order flow.
 */
async function sendStatusChangeEmail({ order, toEmail, statusLabel, extraMessage }) {
  const subject = `Order ${order.orderNumber}: ${statusLabel}`;
  const text = `Hi,\n\nYour order ${order.orderNumber} is now "${statusLabel}".\n${
    extraMessage || ''
  }\n\nYou can track it anytime from your dashboard.\n\nThanks,\nLast-Mile Delivery Tracker`;

  try {
    if (!process.env.SMTP_HOST) {
      // No SMTP configured (e.g. local dev) - log only, don't fail the request
      await NotificationLog.create({
        order: order._id,
        recipientEmail: toEmail,
        event: `status_change:${statusLabel}`,
        channel: 'email',
        status: 'failed',
        errorMessage: 'SMTP not configured - notification skipped',
      });
      return;
    }

    await getTransporter().sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: toEmail,
      subject,
      text,
    });

    await NotificationLog.create({
      order: order._id,
      recipientEmail: toEmail,
      event: `status_change:${statusLabel}`,
      channel: 'email',
      status: 'sent',
    });
  } catch (err) {
    await NotificationLog.create({
      order: order._id,
      recipientEmail: toEmail,
      event: `status_change:${statusLabel}`,
      channel: 'email',
      status: 'failed',
      errorMessage: err.message,
    });
  }
}

module.exports = { sendStatusChangeEmail };
