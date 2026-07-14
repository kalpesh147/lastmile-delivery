import { useEffect, useState } from 'react';
import api from '../api/client';

export default function AdminAgents() {
  const [agents, setAgents] = useState([]);
  const [zones, setZones] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', zone: '' });
  const [error, setError] = useState('');

  async function fetchAll() {
    const [agentsRes, zonesRes] = await Promise.all([
      api.get('/admin/agents'),
      api.get('/admin/zones'),
    ]);
    setAgents(agentsRes.data);
    setZones(zonesRes.data);
  }

  useEffect(() => {
    fetchAll();
  }, []);

  async function createAgent(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/admin/agents', form);
      setForm({ name: '', email: '', password: '', phone: '', zone: '' });
      fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create agent');
    }
  }

  return (
    <div>
      <h3>Delivery agents</h3>
      <form className="card" onSubmit={createAgent}>
        <div className="grid-2">
          <div>
            <label>Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label>Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div>
            <label>Password</label>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </div>
          <div>
            <label>Phone</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label>Primary zone</label>
            <select value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })} required>
              <option value="">Select zone</option>
              {zones.map((z) => (
                <option key={z._id} value={z._id}>{z.name}</option>
              ))}
            </select>
          </div>
        </div>
        {error && <p className="error">{error}</p>}
        <button className="btn" type="submit">Add agent</button>
      </form>

      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Zone</th>
            <th>Available</th>
          </tr>
        </thead>
        <tbody>
          {agents.map((a) => (
            <tr key={a._id}>
              <td>{a.name}</td>
              <td>{a.email}</td>
              <td>{a.zone?.name || '-'}</td>
              <td>{a.isAvailable ? 'Yes' : 'No'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
