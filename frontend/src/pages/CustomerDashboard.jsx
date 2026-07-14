import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

const emptyForm = {
  pickupAddressLine: '',
  pickupPincode: '',
  dropAddressLine: '',
  dropPincode: '',
  length: '',
  breadth: '',
  height: '',
  actualWeight: '',
  orderType: 'B2C',
  paymentType: 'Prepaid',
};

export default function CustomerDashboard() {
  const [form, setForm] = useState(emptyForm);
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState('');
  const [quoting, setQuoting] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [orders, setOrders] = useState([]);
  const [placeError, setPlaceError] = useState('');
  const [placedMsg, setPlacedMsg] = useState('');

  function update(field) {
    return (e) => {
      setForm({ ...form, [field]: e.target.value });
      setQuote(null); // invalidate quote when inputs change
    };
  }

  async function fetchOrders() {
    const { data } = await api.get('/orders');
    setOrders(data);
  }

  useEffect(() => {
    fetchOrders();
  }, []);

  async function getQuote(e) {
    e.preventDefault();
    setQuoteError('');
    setQuoting(true);
    setQuote(null);
    try {
      const { data } = await api.post('/orders/quote', {
        ...form,
        length: Number(form.length),
        breadth: Number(form.breadth),
        height: Number(form.height),
        actualWeight: Number(form.actualWeight),
      });
      setQuote(data);
    } catch (err) {
      setQuoteError(err.response?.data?.message || 'Could not calculate quote');
    } finally {
      setQuoting(false);
    }
  }

  async function confirmOrder() {
    setPlaceError('');
    setPlaceError('');
    setPlacing(true);
    try {
      await api.post('/orders', {
        ...form,
        length: Number(form.length),
        breadth: Number(form.breadth),
        height: Number(form.height),
        actualWeight: Number(form.actualWeight),
      });
      setPlacedMsg('Order placed successfully!');
      setForm(emptyForm);
      setQuote(null);
      fetchOrders();
    } catch (err) {
      setPlaceError(err.response?.data?.message || 'Could not place order');
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="page">
      <h2>Create a new order</h2>
      <form className="card" onSubmit={getQuote}>
        <div className="grid-2">
          <div>
            <label>Pickup address</label>
            <input value={form.pickupAddressLine} onChange={update('pickupAddressLine')} required />
          </div>
          <div>
            <label>Pickup pincode</label>
            <input value={form.pickupPincode} onChange={update('pickupPincode')} required />
          </div>
          <div>
            <label>Drop address</label>
            <input value={form.dropAddressLine} onChange={update('dropAddressLine')} required />
          </div>
          <div>
            <label>Drop pincode</label>
            <input value={form.dropPincode} onChange={update('dropPincode')} required />
          </div>
          <div>
            <label>Length (cm)</label>
            <input type="number" value={form.length} onChange={update('length')} required />
          </div>
          <div>
            <label>Breadth (cm)</label>
            <input type="number" value={form.breadth} onChange={update('breadth')} required />
          </div>
          <div>
            <label>Height (cm)</label>
            <input type="number" value={form.height} onChange={update('height')} required />
          </div>
          <div>
            <label>Actual weight (kg)</label>
            <input type="number" value={form.actualWeight} onChange={update('actualWeight')} required />
          </div>
          <div>
            <label>Order type</label>
            <select value={form.orderType} onChange={update('orderType')}>
              <option value="B2C">B2C</option>
              <option value="B2B">B2B</option>
            </select>
          </div>
          <div>
            <label>Payment type</label>
            <select value={form.paymentType} onChange={update('paymentType')}>
              <option value="Prepaid">Prepaid</option>
              <option value="COD">COD</option>
            </select>
          </div>
        </div>
        {quoteError && <p className="error">{quoteError}</p>}
        <button className="btn" type="submit" disabled={quoting}>
          {quoting ? 'Calculating...' : 'Get price quote'}
        </button>
      </form>

      {quote && (
        <div className="card quote-card">
          <h3>Price breakdown</h3>
          <p>Zone relation: <strong>{quote.zoneRelation}</strong></p>
          <p>Volumetric weight: {quote.volumetricWeight} kg</p>
          <p>Chargeable weight: {quote.chargeableWeight} kg</p>
          <p>Base rate: ₹{quote.charge.baseRate}</p>
          <p>Weight charge: ₹{quote.charge.weightCharge}</p>
          <p>COD surcharge: ₹{quote.charge.codSurcharge}</p>
          <h3>Total: ₹{quote.charge.totalCharge}</h3>
          {placeError && <p className="error">{placeError}</p>}
          <button className="btn" onClick={confirmOrder} disabled={placing}>
            {placing ? 'Placing order...' : 'Confirm & place order'}
          </button>
        </div>
      )}
      {placedMsg && <p className="success">{placedMsg}</p>}

      <h2>Your orders</h2>
      <table className="table">
        <thead>
          <tr>
            <th>Order #</th>
            <th>Status</th>
            <th>Total</th>
            <th>Created</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o._id}>
              <td>{o.orderNumber}</td>
              <td>
                <span className={`badge badge-${o.status.replace(/\s/g, '-')}`}>{o.status}</span>
              </td>
              <td>₹{o.charge.totalCharge}</td>
              <td>{new Date(o.createdAt).toLocaleDateString()}</td>
              <td>
                <Link to={`/orders/${o._id}`}>View</Link>
              </td>
            </tr>
          ))}
          {orders.length === 0 && (
            <tr>
              <td colSpan="5">No orders yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
