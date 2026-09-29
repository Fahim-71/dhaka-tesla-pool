const EARTH_RADIUS_M = 6371000;
const toRadians = (degrees) => (degrees * Math.PI) / 180;

/**
 * Straight-line ("as the crow flies") distance in metres between two points,
 * using the haversine formula. No road network - see docs/domain.md.
 */
export function haversineMetres(a, b) {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/**
 * Trip distance between two areas, rounded to the nearest 100 m so fares are
 * easy to check by hand. Never less than 100 m.
 * Banani -> Mohakhali = 1,900 m, Banani -> Gulshan 1 = 1,800 m.
 */
export function tripDistanceMetres(from, to) {
  return Math.max(100, Math.round(haversineMetres(from, to) / 100) * 100);
}
