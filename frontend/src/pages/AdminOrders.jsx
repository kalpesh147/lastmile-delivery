import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

const STATUS_OPTIONS = ['Created', 'Picked Up', 'In Transit', 'Out for Delivery', 'Delivered', 'Failed', 'Rescheduled'];

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [agents, setAgents] = useState([]);
  const [zones, setZones] = useState([]);
  const [filters, setFilters] = useState({ status: '', agent: '', zone: '' });
  const [msg, setMsg] = useState('');

  async function fetchOrders() {
    const params = {};
    if (filters.status) params.status = filters.status;
    if (filters.agent) params.agent = filters.agent;
    if (filters.zone) params.zone = filters.zone;
    const { data } = await api.get('/orders', { params });
    setOrders(data);
  }

  async function fetchLookups() {
    const [agentsRes, zonesRes] = await Promise.all([api.get('/admin/agents'), api.get('/admin/zones')]);
    setAgents(agentsRes.data);
    setZones(zonesRes.data);
  }

  useEffect(() => {
    fetchLookups();
  }, []);

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  async function autoAssign(orderId) {
    setMsg('');
    try {
      await api.patch(`/orders/${orderId}/assign`, { auto: true });
      setMsg('Auto-assigned nearest available agent');
      fetchOrders();
    } catch (err) {
      setMsg(err.response?.data?.message || 'Auto-assignment failed');
    }
  }

  async function manualAssign(orderId, agentId) {
    if (!agentId) return;
    setMsg('');
    try {
      await api.patch(`/orders/${orderId}/assign`, { agentId });
      setMsg('Agent assigned');
      fetchOrders();
    } catch (err) {
      setMsg(err.response?.data?.message || 'Assignment failed');
    }
  }

  async function overrideStatus(orderId, status) {
    if (!status) return;
    setMsg('');
    try {
      await api.patch(`/orders/${orderId}/status`, { status, note: 'Overridden by admin from dashboard' });
      setMsg(`Status overridden to ${status}`);
      fetchOrders();
    } catch (err) {
      setMsg(err.response?.data?.message || 'Override failed');
    }
  }

  return (
    <div>
      <h3>All orders</h3>
      <div className="card filters">
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filters.agent} onChange={(e) => setFilters({ ...filters, agent: e.target.value })}>
          <option value="">All agents</option>
          {agents.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
        </select>
        <select value={filters.zone} onChange={(e) => setFilters({ ...filters, zone: e.target.value })}>
          <option value="">All zones</option>
          {zones.map((z) => <option key={z._id} value={z._id}>{z.name}</option>)}
        </select>
      </div>

      {msg && <p className="success">{msg}</p>}

      <table className="table">
        <thead>
          <tr>
            <th>Order #</th>
            <th>Customer</th>
            <th>Status</th>
            <th>Agent</th>
            <th>Assign</th>
            <th>Override status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o._id}>
              <td>{o.orderNumber}</td>
              <td>{o.customer?.name}</td>
              <td><span className={`badge badge-${o.status.replace(/\s/g, '-')}`}>{o.status}</span></td>
              <td>{o.assignedAgent?.name || '-'}</td>
              <td>
                <button className="btn btn-secondary" onClick={() => autoAssign(o._id)}>Auto</button>
                <select onChange={(e) => manualAssign(o._id, e.target.value)} defaultValue="">
                  <option value="" disabled>Pick agent...</option>
                  {agents.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
                </select>
              </td>
              <td>
                <select onChange={(e) => overrideStatus(o._id, e.target.value)} defaultValue="">
                  <option value="" disabled>Set status...</option>
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </td>
              <td><Link to={`/orders/${o._id}`}>View</Link></td>
            </tr>
          ))}
          {orders.length === 0 && (
            <tr><td colSpan="7">No orders match these filters.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
