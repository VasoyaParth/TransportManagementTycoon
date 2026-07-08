// Geo math for the offline India map & routing engine.

const R = 6371; // km

export function haversine(lat1, lng1, lat2, lng2) {
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Cumulative distances (km) along a polyline of {lat,lng} points.
export function polylineLengths(points) {
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    cum.push(cum[i - 1] + haversine(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng));
  }
  return cum;
}

// Position + heading at fraction t (0..1) of total path length.
export function pointAlong(points, cum, t) {
  const total = cum[cum.length - 1];
  if (total <= 0 || points.length < 2) {
    return { lat: points[0].lat, lng: points[0].lng, heading: 0 };
  }
  const target = Math.min(Math.max(t, 0), 1) * total;
  let i = 1;
  while (i < cum.length - 1 && cum[i] < target) i++;
  const segLen = cum[i] - cum[i - 1] || 1e-9;
  const f = (target - cum[i - 1]) / segLen;
  const a = points[i - 1], b = points[i];
  const lat = a.lat + (b.lat - a.lat) * f;
  const lng = a.lng + (b.lng - a.lng) * f;
  // Screen heading: x = lng, y = -lat (north up). 0° = pointing north.
  const heading = (Math.atan2(b.lng - a.lng, b.lat - a.lat) * 180) / Math.PI;
  return { lat, lng, heading };
}

// India bounding box used by the map projection.
export const INDIA_BOUNDS = { minLat: 6.5, maxLat: 37.2, minLng: 68.0, maxLng: 97.5 };

// Equirectangular projection into a fixed world canvas. Aspect corrected at
// mid-latitude so distances look right. World units are arbitrary "map px".
export const WORLD_W = 1000;
const latSpan = INDIA_BOUNDS.maxLat - INDIA_BOUNDS.minLat;
const lngSpan = INDIA_BOUNDS.maxLng - INDIA_BOUNDS.minLng;
const midLatRad = ((INDIA_BOUNDS.minLat + INDIA_BOUNDS.maxLat) / 2) * (Math.PI / 180);
export const WORLD_H = (WORLD_W * latSpan) / (lngSpan * Math.cos(midLatRad));

export function project(lat, lng) {
  return {
    x: ((lng - INDIA_BOUNDS.minLng) / lngSpan) * WORLD_W,
    y: ((INDIA_BOUNDS.maxLat - lat) / latSpan) * WORLD_H,
  };
}

export function unproject(x, y) {
  return {
    lng: INDIA_BOUNDS.minLng + (x / WORLD_W) * lngSpan,
    lat: INDIA_BOUNDS.maxLat - (y / WORLD_H) * latSpan,
  };
}
