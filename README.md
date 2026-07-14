# Last-Mile Delivery Tracker

A full-stack delivery management platform where customers and admins create orders with
auto-calculated pricing, agents are assigned intelligently (manually or automatically), and
customers are notified at every step of the delivery journey.

Built for the Unthinkable Solutions assignment.

---

## Tech Stack

- **Backend:** Node.js, Express, MongoDB (Mongoose), JWT auth, Nodemailer
- **Frontend:** React (Vite), React Router, Axios
- **Database:** MongoDB (local or Atlas)

---

## Project Structure

```
lastmile-delivery-tracker/
├── backend/
│   ├── config/         # DB connection
│   ├── controllers/     # Route handlers (business logic)
│   ├── middleware/     # Auth + error handling
│   ├── models/         # Mongoose schemas
│   ├── routes/         # Express routers
│   ├── utils/           # Rate engine, assignment engine, notifications, seed script
│   └── server.js
└── frontend/
    └── src/
        ├── api/          # Axios client
        ├── components/  # Navbar, ProtectedRoute, StatusTimeline
        ├── context/      # Auth context
        └── pages/        # Role-based pages (customer/agent/admin)
```

---

## Setup Guide

### 1. Prerequisites
- Node.js 18+ and npm
- A MongoDB instance — either local (`mongodb://localhost:27017`) or a free
  [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cluster

### 2. Backend setup

```bash
cd backend
npm install
cp .env.example .env
```

Fill in `.env`:

```
PORT=5000
MONGO_URI=mongodb://localhost:27017/lastmile-delivery  
JWT_SECRET=<any long random string>
JWT_EXPIRES_IN=7d


```


Seed the database with an admin user, sample zones, rate cards, and COD rules:

```bash
npm run seed
```

This creates:
- Admin login: `admin@lastmile.com` / `Admin@123`
- Two zones (North Zone / South Zone) with sample pincodes
- Rate cards for all 4 combinations (B2B/B2C × intra/inter)
- COD surcharge rules for B2B and B2C

Start the server:

```bash
npm run dev      # with auto-restart (nodemon)
# or
npm start
```

Server runs on `http://localhost:5000`.

### 3. Frontend setup

```bash
cd frontend
npm install
cp .env.example .env    # VITE_API_URL=http://localhost:5000/api
npm run dev
```

App runs on `http://localhost:5173`.

### 4. First login

- Register a new customer account via the UI, or
- Log in as admin (`admin@lastmile.com` / `Admin@123`) to configure zones, rate cards, and
  add delivery agents before placing orders.

---

## Database Schema

### User
| Field | Type | Notes |
|---|---|---|
| name, email, password | String | password is bcrypt-hashed |
| role | enum | `customer` \| `agent` \| `admin` |
| zone | ObjectId → Zone | agent's primary operating zone |
| isAvailable | Boolean | agent availability toggle |
| currentLocation | {lat, lng} | optional, used for nearest-agent matching |

### Zone
| Field | Type | Notes |
|---|---|---|
| name, code | String | e.g. "North Zone", "NZ" |
| pincodes | [String] | areas mapped to this zone by admin |

### RateCard
| Field | Type | Notes |
|---|---|---|
| orderType | enum | `B2B` \| `B2C` |
| zoneRelation | enum | `intra` \| `inter` |
| baseRate, perKgRate | Number | admin-configurable, unique per (orderType, zoneRelation) |

### CodSurcharge
| Field | Type | Notes |
|---|---|---|
| orderType | enum | `B2B` \| `B2C` |
| surchargeType | enum | `flat` \| `percentage` |
| value | Number | |

### Order (core entity)
| Field | Type | Notes |
|---|---|---|
| orderNumber | String | auto-generated, unique |
| customer, createdBy | ObjectId → User | createdBy differs from customer when admin creates on behalf |
| pickupAddress / dropAddress | {addressLine, pincode, zone} | zone resolved automatically at creation |
| zoneRelation | enum | intra / inter, computed at creation |
| package | {length, breadth, height, actualWeight, volumetricWeight, chargeableWeight} | |
| orderType, paymentType | enum | B2B/B2C, Prepaid/COD |
| charge | {baseRate, weightCharge, codSurcharge, totalCharge, rateCardUsed} | frozen at order creation time |
| status | enum | Created → Picked Up → In Transit → Out for Delivery → Delivered / Failed → Rescheduled |
| assignedAgent | ObjectId → User | |
| **statusHistory** | **[{status, timestamp, actor, actorRole, note}]** | **append-only, immutable audit trail** |
| rescheduleHistory | [{previousDeliveryDate, newDeliveryDate, reason, reassignedAgent}] | |
| isOverridden | Boolean | true if admin manually overrode the status |

### NotificationLog
Tracks every email attempt (sent/failed) per order, for auditability.

---

## Rate Calculation Logic (`backend/utils/rateEngine.js`)

1. **Zone detection** — look up the `Zone` document whose `pincodes` array contains the
   pickup/drop pincode. If either pincode has no zone mapped, the request fails with a clear
   400 error telling admin to map it first (no silent fallback / no hardcoded default zone).
2. **Zone relation** — `intra` if pickup and drop zones are the same document, else `inter`.
3. **Volumetric weight** — `(Length_cm × Breadth_cm × Height_cm) / 5000` (industry-standard divisor).
4. **Chargeable weight** — `max(actualWeight, volumetricWeight)`.
5. **Rate card lookup** — find the `RateCard` matching `(orderType, zoneRelation)`. Nothing is
   hardcoded; all values come from the DB and are fully admin-configurable via
   `POST /api/admin/rate-cards`.
6. **Charge** — `baseRate + (perKgRate × chargeableWeight)`.
7. **COD surcharge** — only applied when `paymentType = COD`, using the `CodSurcharge` config
   for that order type (flat amount or percentage of subtotal).
8. **Total** — `subtotal + codSurcharge`, rounded to 2 decimals.

This is exposed via `POST /api/orders/quote`, which computes and returns the full price
breakdown **without** creating an order — this is what the frontend calls before the customer
confirms, satisfying the "charge shown before confirmation" requirement.

## Auto-Assignment Logic (`backend/utils/assignmentEngine.js`)

1. Filter agents to `role: agent`, `isAvailable: true`, and `zone` matching the order's pickup zone.
2. If any candidates have `currentLocation` coordinates and the order provides pickup lat/lng,
   rank by Haversine distance and pick the closest.
3. If no coordinates are available, return the first available in-zone agent.
4. If no agent is available in that zone at all, widen the search to any available agent
   system-wide, so orders are never left permanently unassigned when agents exist.

---

## API Reference

All endpoints (except register/login) require `Authorization: Bearer <token>`.

### Auth
| Method | Route | Access | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Register as customer |
| POST | `/api/auth/login` | Public | Login (any role) |
| GET | `/api/auth/me` | Any logged-in user | Current user profile |

### Admin — Zones
| Method | Route | Access |
|---|---|---|
| POST | `/api/admin/zones` | admin |
| GET | `/api/admin/zones` | admin |
| PUT | `/api/admin/zones/:id` | admin |
| DELETE | `/api/admin/zones/:id` | admin |

### Admin — Rate Cards & COD
| Method | Route | Access |
|---|---|---|
| POST | `/api/admin/rate-cards` | admin (upsert by orderType+zoneRelation) |
| GET | `/api/admin/rate-cards` | admin |
| POST | `/api/admin/cod-surcharge` | admin (upsert by orderType) |
| GET | `/api/admin/cod-surcharge` | admin |

### Admin — Agents
| Method | Route | Access |
|---|---|---|
| POST | `/api/admin/agents` | admin |
| GET | `/api/admin/agents` | admin |

### Orders
| Method | Route | Access | Description |
|---|---|---|---|
| POST | `/api/orders/quote` | customer, admin | Compute price without creating an order |
| POST | `/api/orders` | customer, admin | Create order (admin can pass `customerId` to create on behalf of a customer) |
| GET | `/api/orders` | any (role-filtered) | Customer sees own orders; agent sees assigned; admin sees all, with `?status=&agent=&zone=` filters |
| GET | `/api/orders/:id` | any (access-checked) | Full order + tracking timeline |
| PATCH | `/api/orders/:id/assign` | admin | Body: `{agentId}` for manual, or `{auto:true}` for auto-assignment |
| PATCH | `/api/orders/:id/status` | agent, admin | Agent moves through valid lifecycle steps only; admin can override to any status |
| POST | `/api/orders/:id/reschedule` | customer, admin | Only allowed when status is `Failed`; reassigns an agent for the new attempt |

---

## Notes on Design Decisions

- **Immutability of statusHistory:** entries are only ever pushed, never edited or removed,
  satisfying the "immutable tracking history" requirement.
- **Charge is frozen at order creation:** even if admin changes rate cards later, existing
  orders keep the price the customer was originally quoted.
- **Failure isolation for notifications:** a failed email send never blocks the order status
  update — it's logged and the request still succeeds.
