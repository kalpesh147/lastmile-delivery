import { useState } from 'react';
import AdminOrders from './AdminOrders';
import AdminZones from './AdminZones';
import AdminRates from './AdminRates';
import AdminAgents from './AdminAgents';

const TABS = [
  { key: 'orders', label: 'Orders', component: AdminOrders },
  { key: 'zones', label: 'Zones', component: AdminZones },
  { key: 'rates', label: 'Rate Cards & COD', component: AdminRates },
  { key: 'agents', label: 'Agents', component: AdminAgents },
];

export default function AdminDashboard() {
  const [active, setActive] = useState('orders');
  const ActiveComponent = TABS.find((t) => t.key === active).component;

  return (
    <div className="page">
      <h2>Admin dashboard</h2>
      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab ${active === t.key ? 'tab-active' : ''}`}
            onClick={() => setActive(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <ActiveComponent />
    </div>
  );
}
