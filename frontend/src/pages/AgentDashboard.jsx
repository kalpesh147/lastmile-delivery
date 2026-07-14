import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

export default function AgentDashboard() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  async function fetchOrders() {
    setLoading(true);
    const { data } = await api.get('/orders');
    setOrders(data);
    setLoading(false);
  }

  useEffect(() => {
    fetchOrders();
  }, []);

  return (
    <div className="page">
      <h2>Your assigned orders</h2>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Order #</th>
              <th>Status</th>
              <th>Pickup</th>
              <th>Drop</th>
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
                <td>{o.pickupAddress.zone?.name}</td>
                <td>{o.dropAddress.zone?.name}</td>
                <td>
                  <Link to={`/orders/${o._id}`}>Open</Link>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan="5">No orders assigned to you yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
