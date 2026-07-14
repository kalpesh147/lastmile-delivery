const User = require('../models/User');

/**
 * Haversine distance between two lat/lng points, in km.
 */
function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371; // Earth radius km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Find the best available agent for a pickup zone.
 *
 * Strategy:
 *  1. Filter to agents who are available AND primarily operate in the pickup zone.
 *  2. If pickup location coordinates are provided and agents have currentLocation set,
 *     rank by haversine distance (nearest first).
 *  3. Otherwise fall back to any available agent in that zone (first found).
 *  4. If none in-zone, widen the search to any available agent (cross-zone fallback)
 *     so an order is never left unassigned when agents exist.
 *
 * Returns the chosen agent document, or null if no agent is available at all.
 */
async function findNearestAvailableAgent({ zoneId, pickupLat, pickupLng }) {
  let candidates = await User.find({ role: 'agent', isAvailable: true, zone: zoneId });

  if (candidates.length === 0) {
    // Fallback: no one free in this zone right now, widen the pool
    candidates = await User.find({ role: 'agent', isAvailable: true });
  }

  if (candidates.length === 0) return null;

  if (pickupLat != null && pickupLng != null) {
    const withCoords = candidates.filter(
      (a) => a.currentLocation && a.currentLocation.lat != null && a.currentLocation.lng != null
    );
    if (withCoords.length > 0) {
      withCoords.sort(
        (a, b) =>
          haversineDistanceKm(pickupLat, pickupLng, a.currentLocation.lat, a.currentLocation.lng) -
          haversineDistanceKm(pickupLat, pickupLng, b.currentLocation.lat, b.currentLocation.lng)
      );
      return withCoords[0];
    }
  }

  // No coordinates to compare - just return first available candidate in the zone
  return candidates[0];
}

module.exports = { findNearestAvailableAgent, haversineDistanceKm };
