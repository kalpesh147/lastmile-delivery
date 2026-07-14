import { useEffect, useState } from 'react';
import api from '../api/client';

export default function AdminZones() {
  const [zones, setZones] = useState([]);
  const [form, setForm] = useState({ name: '', code: '', pincodes: '' });
  const [error, setError] = useState('');

  // Editing state: which zone id is being edited, and its draft values
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', code: '', pincodes: '' });
  const [editError, setEditError] = useState('');

  async function fetchZones() {
    const { data } = await api.get('/admin/zones');
    setZones(data);
  }

  useEffect(() => {
    fetchZones();
  }, []);

  async function createZone(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/admin/zones', {
        name: form.name,
        code: form.code,
        pincodes: form.pincodes.split(',').map((p) => p.trim()).filter(Boolean),
      });
      setForm({ name: '', code: '', pincodes: '' });
      fetchZones();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create zone');
    }
  }

  async function deleteZone(id) {
    if (editingId === id) cancelEdit();
    await api.delete(`/admin/zones/${id}`);
    fetchZones();
  }

  function startEdit(zone) {
    setEditingId(zone._id);
    setEditError('');
    setEditForm({
      name: zone.name,
      code: zone.code,
      pincodes: zone.pincodes.join(', '),
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError('');
  }

  async function saveEdit(id) {
    setEditError('');
    try {
      await api.put(`/admin/zones/${id}`, {
        name: editForm.name,
        code: editForm.code,
        pincodes: editForm.pincodes.split(',').map((p) => p.trim()).filter(Boolean),
      });
      setEditingId(null);
      fetchZones();
    } catch (err) {
      setEditError(err.response?.data?.message || 'Could not update zone');
    }
  }

  return (
    <div>
      <h3>Zones</h3>
      <form className="card" onSubmit={createZone}>
        <label>Zone name</label>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <label>Zone code</label>
        <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
        <label>Pincodes (comma-separated)</label>
        <input
          value={form.pincodes}
          onChange={(e) => setForm({ ...form, pincodes: e.target.value })}
          placeholder="110001, 110002"
        />
        {error && <p className="error">{error}</p>}
        <button className="btn" type="submit">Add zone</button>
      </form>

      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Code</th>
            <th>Pincodes</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {zones.map((z) =>
            editingId === z._id ? (
              <tr key={z._id}>
                <td>
                  <input
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    value={editForm.code}
                    onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    value={editForm.pincodes}
                    onChange={(e) => setEditForm({ ...editForm, pincodes: e.target.value })}
                    placeholder="110001, 110002"
                  />
                  {editError && <p className="error">{editError}</p>}
                </td>
                <td>
                  <button className="btn btn-secondary" onClick={() => saveEdit(z._id)}>Save</button>
                  <button className="btn btn-secondary" onClick={cancelEdit}>Cancel</button>
                </td>
              </tr>
            ) : (
              <tr key={z._id}>
                <td>{z.name}</td>
                <td>{z.code}</td>
                <td>{z.pincodes.join(', ')}</td>
                <td>
                  <button className="btn btn-secondary" onClick={() => startEdit(z)}>Edit</button>
                  <button className="btn btn-secondary" onClick={() => deleteZone(z._id)}>Delete</button>
                </td>
              </tr>
            )
          )}
          {zones.length === 0 && (
            <tr>
              <td colSpan="4">No zones yet — add one above.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}