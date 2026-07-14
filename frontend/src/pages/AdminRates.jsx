import { useEffect, useState } from 'react';
import api from '../api/client';

export default function AdminRates() {
  const [rateCards, setRateCards] = useState([]);
  const [codConfigs, setCodConfigs] = useState([]);
  const [rateForm, setRateForm] = useState({
    orderType: 'B2C',
    zoneRelation: 'intra',
    baseRate: '',
    perKgRate: '',
  });
  const [codForm, setCodForm] = useState({ orderType: 'B2C', surchargeType: 'flat', value: '' });
  const [error, setError] = useState('');

  async function fetchAll() {
    const [rc, cod] = await Promise.all([
      api.get('/admin/rate-cards'),
      api.get('/admin/cod-surcharge'),
    ]);
    setRateCards(rc.data);
    setCodConfigs(cod.data);
  }

  useEffect(() => {
    fetchAll();
  }, []);

  async function saveRateCard(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/admin/rate-cards', {
        ...rateForm,
        baseRate: Number(rateForm.baseRate),
        perKgRate: Number(rateForm.perKgRate),
      });
      fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save rate card');
    }
  }

  async function saveCod(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/admin/cod-surcharge', { ...codForm, value: Number(codForm.value) });
      fetchAll();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save COD surcharge');
    }
  }

  return (
    <div>
      <h3>Rate cards (B2B / B2C × intra / inter-zone)</h3>
      <form className="card" onSubmit={saveRateCard}>
        <div className="grid-2">
          <div>
            <label>Order type</label>
            <select
              value={rateForm.orderType}
              onChange={(e) => setRateForm({ ...rateForm, orderType: e.target.value })}
            >
              <option value="B2C">B2C</option>
              <option value="B2B">B2B</option>
            </select>
          </div>
          <div>
            <label>Zone relation</label>
            <select
              value={rateForm.zoneRelation}
              onChange={(e) => setRateForm({ ...rateForm, zoneRelation: e.target.value })}
            >
              <option value="intra">Intra-zone</option>
              <option value="inter">Inter-zone</option>
            </select>
          </div>
          <div>
            <label>Base rate (₹)</label>
            <input
              type="number"
              value={rateForm.baseRate}
              onChange={(e) => setRateForm({ ...rateForm, baseRate: e.target.value })}
              required
            />
          </div>
          <div>
            <label>Per-kg rate (₹)</label>
            <input
              type="number"
              value={rateForm.perKgRate}
              onChange={(e) => setRateForm({ ...rateForm, perKgRate: e.target.value })}
              required
            />
          </div>
        </div>
        {error && <p className="error">{error}</p>}
        <button className="btn" type="submit">Save rate card</button>
      </form>

      <table className="table">
        <thead>
          <tr>
            <th>Order type</th>
            <th>Zone relation</th>
            <th>Base rate</th>
            <th>Per-kg rate</th>
          </tr>
        </thead>
        <tbody>
          {rateCards.map((rc) => (
            <tr key={rc._id}>
              <td>{rc.orderType}</td>
              <td>{rc.zoneRelation}</td>
              <td>₹{rc.baseRate}</td>
              <td>₹{rc.perKgRate}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>COD surcharge</h3>
      <form className="card" onSubmit={saveCod}>
        <div className="grid-2">
          <div>
            <label>Order type</label>
            <select
              value={codForm.orderType}
              onChange={(e) => setCodForm({ ...codForm, orderType: e.target.value })}
            >
              <option value="B2C">B2C</option>
              <option value="B2B">B2B</option>
            </select>
          </div>
          <div>
            <label>Surcharge type</label>
            <select
              value={codForm.surchargeType}
              onChange={(e) => setCodForm({ ...codForm, surchargeType: e.target.value })}
            >
              <option value="flat">Flat (₹)</option>
              <option value="percentage">Percentage (%)</option>
            </select>
          </div>
          <div>
            <label>Value</label>
            <input
              type="number"
              value={codForm.value}
              onChange={(e) => setCodForm({ ...codForm, value: e.target.value })}
              required
            />
          </div>
        </div>
        <button className="btn" type="submit">Save COD config</button>
      </form>

      <table className="table">
        <thead>
          <tr>
            <th>Order type</th>
            <th>Type</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {codConfigs.map((c) => (
            <tr key={c._id}>
              <td>{c.orderType}</td>
              <td>{c.surchargeType}</td>
              <td>{c.surchargeType === 'flat' ? `₹${c.value}` : `${c.value}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
