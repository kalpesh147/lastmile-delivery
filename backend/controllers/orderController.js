const Order = require('../models/Order');
const User = require('../models/User');
const { computeOrderCharge } = require('../utils/rateEngine');
const { findNearestAvailableAgent } = require('../utils/assignmentEngine');
const { sendStatusChangeEmail } = require('../utils/notify');

function generateOrderNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `LMD-${ts}-${rand}`;
}

/**
 * POST /api/orders/quote
 * Computes and returns the charge WITHOUT creating an order, so the
 * customer can see the price before confirming (per spec requirement).
 */
async function getQuote(req, res, next) {
  try {
    const { pickupPincode, dropPincode, length, breadth, height, actualWeight, orderType, paymentType } =
      req.body;
    const result = await computeOrderCharge({
      pickupPincode,
      dropPincode,
      length,
      breadth,
      height,
      actualWeight,
      orderType,
      paymentType,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/orders
 * Creates the order. Can be called by a customer (for themselves) or an
 * admin (on behalf of a customer, via customerEmail/customerId in body).
 */
async function createOrder(req, res, next) {
  try {
    const {
      pickupAddressLine,
      pickupPincode,
      dropAddressLine,
      dropPincode,
      length,
      breadth,
      height,
      actualWeight,
      orderType,
      paymentType,
      customerId, // used when admin creates on behalf of a customer
    } = req.body;

    let customer = req.user;
    if (req.user.role === 'admin') {
      if (!customerId) return res.status(400).json({ message: 'customerId is required when admin creates an order' });
      customer = await User.findById(customerId);
      if (!customer || customer.role !== 'customer') {
        return res.status(400).json({ message: 'customerId must reference a valid customer' });
      }
    }

    const quote = await computeOrderCharge({
      pickupPincode,
      dropPincode,
      length,
      breadth,
      height,
      actualWeight,
      orderType,
      paymentType,
    });

    const order = await Order.create({
      orderNumber: generateOrderNumber(),
      customer: customer._id,
      createdBy: req.user._id,
      pickupAddress: { addressLine: pickupAddressLine, pincode: pickupPincode, zone: quote.pickupZone._id },
      dropAddress: { addressLine: dropAddressLine, pincode: dropPincode, zone: quote.dropZone._id },
      zoneRelation: quote.zoneRelation,
      package: {
        length,
        breadth,
        height,
        actualWeight,
        volumetricWeight: quote.volumetricWeight,
        chargeableWeight: quote.chargeableWeight,
      },
      orderType,
      paymentType,
      charge: quote.charge,
      status: 'Created',
      statusHistory: [
        {
          status: 'Created',
          actor: req.user._id,
          actorRole: req.user.role,
          note: 'Order created',
        },
      ],
    });

    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/orders
 * Role-based listing:
 *  - customer: only their own orders
 *  - agent: only orders assigned to them
 *  - admin: all orders, with optional filters: status, zone, agent
 */
async function listOrders(req, res, next) {
  try {
    const filter = {};
    if (req.user.role === 'customer') {
      filter.customer = req.user._id;
    } else if (req.user.role === 'agent') {
      filter.assignedAgent = req.user._id;
    } else if (req.user.role === 'admin') {
      if (req.query.status) filter.status = req.query.status;
      if (req.query.agent) filter.assignedAgent = req.query.agent;
      if (req.query.zone) {
        filter.$or = [{ 'pickupAddress.zone': req.query.zone }, { 'dropAddress.zone': req.query.zone }];
      }
    }

    const orders = await Order.find(filter)
      .populate('customer', 'name email')
      .populate('assignedAgent', 'name email')
      .populate('pickupAddress.zone', 'name code')
      .populate('dropAddress.zone', 'name code')
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/orders/:id
 * Returns single order with full tracking timeline. Access-controlled by role.
 */
async function getOrder(req, res, next) {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customer', 'name email')
      .populate('assignedAgent', 'name email phone')
      .populate('pickupAddress.zone', 'name code')
      .populate('dropAddress.zone', 'name code')
      .populate('statusHistory.actor', 'name role');

    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (req.user.role === 'customer' && String(order.customer._id) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized to view this order' });
    }
    if (req.user.role === 'agent' && String(order.assignedAgent?._id) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized to view this order' });
    }

    res.json(order);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/orders/:id/assign
 * Admin manually assigns { agentId } OR triggers auto-assignment { auto: true }.
 */
async function assignAgent(req, res, next) {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    let agent;
    if (req.body.auto) {
      agent = await findNearestAvailableAgent({ zoneId: order.pickupAddress.zone });
      if (!agent) return res.status(409).json({ message: 'No available agent found for auto-assignment' });
    } else {
      const { agentId } = req.body;
      agent = await User.findOne({ _id: agentId, role: 'agent' });
      if (!agent) return res.status(400).json({ message: 'Invalid agentId' });
    }

    order.assignedAgent = agent._id;
    order.statusHistory.push({
      status: order.status,
      actor: req.user._id,
      actorRole: req.user.role,
      note: `Agent ${agent.name} assigned${req.body.auto ? ' (auto-assignment)' : ''}`,
    });
    await order.save();

    res.json(order);
  } catch (err) {
    next(err);
  }
}

const NEXT_STATUS_MAP = {
  Created: ['Picked Up', 'Failed'],
  'Picked Up': ['In Transit', 'Failed'],
  'In Transit': ['Out for Delivery', 'Failed'],
  'Out for Delivery': ['Delivered', 'Failed'],
  Delivered: [],
  Failed: ['Rescheduled'],
  Rescheduled: ['Picked Up', 'Failed'],
};

/**
 * PATCH /api/orders/:id/status
 * Agent updates order status through its lifecycle. Admin can override to any status.
 * body: { status, note }
 */
async function updateStatus(req, res, next) {
  try {
    const { status, note } = req.body;
    const order = await Order.findById(req.params.id).populate('customer', 'name email');
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (req.user.role === 'agent') {
      if (String(order.assignedAgent) !== String(req.user._id)) {
        return res.status(403).json({ message: 'You are not assigned to this order' });
      }
      const allowed = NEXT_STATUS_MAP[order.status] || [];
      if (!allowed.includes(status)) {
        return res.status(400).json({
          message: `Cannot move from "${order.status}" to "${status}". Allowed: ${allowed.join(', ') || 'none'}`,
        });
      }
    }
    // admin can override to any status - isOverridden flag set below

    const isOverride = req.user.role === 'admin' && order.status !== status;
    order.status = status;
    if (isOverride) order.isOverridden = true;

    order.statusHistory.push({
      status,
      actor: req.user._id,
      actorRole: req.user.role,
      note: note || (isOverride ? 'Status manually overridden by admin' : undefined),
    });

    await order.save();

    // Email notification to customer on every status change
    await sendStatusChangeEmail({
      order,
      toEmail: order.customer.email,
      statusLabel: status,
      extraMessage:
        status === 'Failed'
          ? 'Your delivery attempt failed. Please log in to reschedule a new delivery date.'
          : undefined,
    });

    res.json(order);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/orders/:id/reschedule
 * Customer reschedules a failed delivery. Agent is reassigned for the new attempt.
 * body: { newDeliveryDate, reason }
 */
async function rescheduleOrder(req, res, next) {
  try {
    const { newDeliveryDate, reason } = req.body;
    const order = await Order.findById(req.params.id).populate('customer', 'name email');
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (req.user.role === 'customer' && String(order.customer._id) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized to reschedule this order' });
    }
    if (order.status !== 'Failed') {
      return res.status(400).json({ message: 'Only orders with status "Failed" can be rescheduled' });
    }

    // Reassign agent for the new attempt
    const newAgent = await findNearestAvailableAgent({ zoneId: order.pickupAddress.zone });

    order.rescheduleHistory.push({
      previousDeliveryDate: order.requestedDeliveryDate,
      newDeliveryDate,
      reason,
      reassignedAgent: newAgent ? newAgent._id : undefined,
    });
    order.requestedDeliveryDate = newDeliveryDate;
    order.assignedAgent = newAgent ? newAgent._id : undefined;
    order.status = 'Rescheduled';

    order.statusHistory.push({
      status: 'Rescheduled',
      actor: req.user._id,
      actorRole: req.user.role,
      note: `Customer rescheduled to ${new Date(newDeliveryDate).toDateString()}${
        newAgent ? `; reassigned to agent ${newAgent.name}` : '; no agent available yet'
      }`,
    });

    await order.save();

    await sendStatusChangeEmail({
      order,
      toEmail: order.customer.email,
      statusLabel: 'Rescheduled',
      extraMessage: `New delivery date: ${new Date(newDeliveryDate).toDateString()}`,
    });

    res.json(order);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getQuote,
  createOrder,
  listOrders,
  getOrder,
  assignAgent,
  updateStatus,
  rescheduleOrder,
};
