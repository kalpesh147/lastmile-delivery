import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import StatusTimeline from '../components/StatusTimeline';

const AGENT_NEXT_STATUS = {
  Created: ['Picked Up', 'Failed'],
  'Picked Up': ['In Transit', 'Failed'],
  'In Transit': ['Out for Delivery', 'Failed'],
  'Out for Delivery': ['Delivered', 'Failed'],
  Rescheduled: ['Picked Up', 'Failed'],
};

export default function OrderDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [newDate, setNewDate] = useState('');
  const [reason, setReason] = useState('');

  async function fetchOrder() {
    try {
      const { data } = await api.get(`/orders/${id}`);
      setOrder(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load order');
    }
  }

  useEffect(() => {
    fetchOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function updateStatus(status) {
    setActionMsg('');
    try {
      await api.patch(`/orders/${id}/status`, { status });
      setActionMsg(`Status updated to "${status}"`);
      fetchOrder();
    } catch (err) {
      setActionMsg(err.response?.data?.message || 'Could not update status');
    }
  }

  async function reschedule(e) {
    e.preventDefault();
    setActionMsg('');
    try {
      await api.post(`/orders/${id}/reschedule`, { newDeliveryDate: newDate, reason });
      setActionMsg('Reschedule requested successfully');
      setNewDate('');
      setReason('');
      fetchOrder();
    } catch (err) {
      setActionMsg(err.response?.data?.message || 'Could not reschedule');
    }
  }

  if (error) return <div className="page"><p className="error">{error}</p></div>;
  if (!order) return <div className="page"><p>Loading...</p></div>;

  const canAgentUpdate = user.role === 'agent' && String(order.assignedAgent?._id) === String(user.id);
  const nextOptions = AGENT_NEXT_STATUS[order.status] || [];

  return (
    <div className="page">
      <h2>Order {order.orderNumber}</h2>
      <div className="card">
        <p>Status: <span className={`badge badge-${order.status.replace(/\s/g, '-')}`}>{order.status}</span></p>
        <p>Customer: {order.customer?.name} ({order.customer?.email})</p>
        <p>Pickup: {order.pickupAddress.addressLine}, {order.pickupAddress.pincode} ({order.pickupAddress.zone?.name})</p>
        <p>Drop: {order.dropAddress.addressLine}, {order.dropAddress.pincode} ({order.dropAddress.zone?.name})</p>
        <p>Order type: {order.orderType} · Payment: {order.paymentType} · Zone relation: {order.zoneRelation}</p>
        <p>Chargeable weight: {order.package.chargeableWeight} kg (actual {order.package.actualWeight}kg, volumetric {order.package.volumetricWeight}kg)</p>
        <p>Total charge: ₹{order.charge.totalCharge}</p>
        {order.assignedAgent && <p>Assigned agent: {order.assignedAgent.name} ({order.assignedAgent.phone || 'no phone'})</p>}
      </div>

      {actionMsg && <p className="success">{actionMsg}</p>}

      {canAgentUpdate && nextOptions.length > 0 && (
        <div className="card">
          <h3>Update status</h3>
          {nextOptions.map((s) => (
            <button key={s} className="btn btn-secondary" onClick={() => updateStatus(s)}>
              Mark as {s}
            </button>
          ))}
        </div>
      )}

      {user.role === 'customer' && order.status === 'Failed' && (
        <div className="card">
          <h3>Reschedule delivery</h3>
          <form onSubmit={reschedule}>
            <label>New delivery date</label>
            <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} required />
            <label>Reason (optional)</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} />
            <button className="btn" type="submit">Request reschedule</button>
          </form>
        </div>
      )}

      <h3>Tracking timeline</h3>
      <StatusTimeline history={order.statusHistory} />
    </div>
  );
}
