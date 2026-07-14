# System Design Write-Up: Last-Mile Delivery Tracker

## Rate Calculation Engine

The pricing engine (`backend/utils/rateEngine.js`) is isolated from the HTTP layer so it can
be unit-tested independently and reused by both the price-quote endpoint and the actual
order-creation endpoint — guaranteeing the customer is always charged exactly what they were
quoted.

The calculation runs in five steps. First, the pickup and drop pincodes are each resolved to a
`Zone` document via a database lookup (`Zone.findOne({ pincodes: pincode })`). If a pincode has
no zone mapping, the request fails fast with a descriptive error rather than silently
defaulting to some zone — this forces correct admin configuration rather than masking gaps in
setup. Second, the zone relation is derived by comparing the two zone IDs: equal means `intra`,
different means `inter`. Third, volumetric weight is computed using the standard courier-industry
formula `(L × B × H) / 5000`. Fourth, the chargeable weight is the greater of actual and
volumetric weight — this correctly handles both bulky-but-light packages (where volumetric
wins) and small-but-heavy packages (where actual wins), which we verified with two opposite
test cases during development. Fifth, the engine looks up the matching `RateCard` document for
the `(orderType, zoneRelation)` pair and computes `baseRate + perKgRate × chargeableWeight`. If
payment type is COD, a `CodSurcharge` document (flat amount or percentage, configured per order
type) is applied on top.

Critically, no prices, weights, or thresholds are hardcoded anywhere in application code — every
number involved comes from admin-managed collections (`Zone`, `RateCard`, `CodSurcharge`), so
business users can retune pricing without a code deployment. The computed charge is persisted
onto the `Order` document at creation time, so historical orders are unaffected by later rate
changes.

## Zone Detection Approach

Rather than doing live geocoding, zone detection is a simple, robust, admin-controlled mapping:
each `Zone` document owns an array of pincodes it covers, and detection is a single indexed
lookup. This keeps the system deterministic and fast, avoids dependency on a third-party
geocoding API (with its cost and reliability concerns), and matches how real Indian logistics
companies commonly organize serviceable areas — by pincode-to-zone tables maintained by
operations teams. Admins manage this through simple CRUD endpoints (`POST/GET/PUT/DELETE
/api/admin/zones`), and the frontend surfaces validation errors immediately if a customer
enters an unmapped pincode, prompting them to contact support rather than allowing an
incorrectly-priced or unroutable order to be created.

## Auto-Assignment Logic

The assignment engine (`backend/utils/assignmentEngine.js`) first narrows the candidate pool to
agents who are marked `isAvailable: true` and whose primary `zone` matches the order's pickup
zone — the intuition being that an agent based in that area is best positioned to do the
pickup. If multiple candidates remain and the system has location data (agent `currentLocation`
lat/lng), it ranks them by Haversine great-circle distance to the pickup point and selects the
closest, approximating "nearest available agent" without needing a full routing engine. If no
location data exists, it falls back to the first available in-zone agent — still correct, just
less optimized. If literally no agent is free in that zone, the search widens to any available
agent system-wide, so an order is never stuck unassigned purely because of an empty zone at
that moment; a human dispatcher (the admin) can always override this via manual assignment
regardless. Admins can also trigger this same logic on demand via a single "Auto" button per
order, or hand-pick an agent directly, which is exposed identically through one endpoint
(`PATCH /api/orders/:id/assign`) differentiated only by the request body shape (`{auto:true}`
vs `{agentId}`).

## Failed Delivery Handling

When an agent marks an order `Failed`, this transition is push-appended to the order's
`statusHistory` array along with the agent's note (e.g. "customer not available"), and an email
notification is dispatched to the customer. The order remains in the `Failed` state until the
customer takes action — this is an intentional design choice so a failure never silently
resolves itself without customer input. When the customer calls the reschedule endpoint
(`POST /api/orders/:id/reschedule`) with a new delivery date, the system: (1) validates the
order is actually in `Failed` state, rejecting reschedule attempts on any other status; (2) logs
a `rescheduleHistory` entry recording the previous/new date and reason; (3) re-invokes the same
auto-assignment logic used at order creation to pick a (possibly new) agent for the fresh
attempt; and (4) transitions status to `Rescheduled`, which the lifecycle map treats as
re-entering the active flow (it can move back to `Picked Up` or `Failed` again). This reuses the
existing assignment and status-history machinery rather than introducing a parallel code path,
keeping the failure/retry loop consistent with the primary delivery flow and fully auditable
end-to-end.
