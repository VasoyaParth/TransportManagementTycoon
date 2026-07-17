// Routing engine — airline edition. Aircraft fly direct, point-to-point
// between airports: no road graph, no ferries. Every route is a great-circle
// arc (the real shortest path a plane actually flies) rendered as a smooth
// curve of waypoints, which the map animates the aircraft along.
//
// Field names on the returned route object (points/cum/roadKm/usesFerry/
// ferrySegments/bordersCrossed/...) intentionally match the old road-routing
// engine's shape — gameStore.js and the UI already consume that exact shape,
// so keeping it means the whole delivery/economy/achievement pipeline works
// unchanged. `roadKm` is simply "route distance in km" here; `usesFerry` and
// `ferrySegments` stay permanently empty (nothing to cross by air).

import { CITIES } from '../data/cities';
import { haversine, polylineLengths } from './geo';

const AIR_ROUTE_FACTOR = 1.03; // small buffer over pure great-circle for holding patterns / approach paths

export function cityById(id) {
  return CITIES.find(c => c.id === id);
}

// Sea ports made no sense once routing went point-to-point by air — kept as
// a no-op so any leftover caller (map "ports" toggle, etc.) degrades to an
// empty list instead of crashing.
export function ferryPorts() { return []; }

const nearestCityCache = {};
function nearestCity(lat, lng) {
  const key = lat.toFixed(2) + ',' + lng.toFixed(2);
  const hit = nearestCityCache[key];
  if (hit) return hit;
  let best = null, bestD = Infinity;
  for (const c of CITIES) {
    const d = haversine(lat, lng, c.lat, c.lng);
    if (d < bestD) { bestD = d; best = c; }
  }
  nearestCityCache[key] = best;
  return best;
}

// Great-circle interpolation (spherical slerp) between two lat/lng points —
// the actual shortest path over a sphere, which is what a real flight plan
// follows. Produces `steps` waypoints so the path reads as a gentle curve on
// the map instead of a single straight (and geographically wrong) line.
function greatCircleSteps(lat1, lng1, lat2, lng2, steps = 24) {
  const toRad = d => (d * Math.PI) / 180, toDeg = r => (r * 180) / Math.PI;
  const phi1 = toRad(lat1), lam1 = toRad(lng1), phi2 = toRad(lat2), lam2 = toRad(lng2);
  const d = 2 * Math.asin(Math.sqrt(
    Math.sin((phi2 - phi1) / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin((lam2 - lam1) / 2) ** 2
  ));
  if (d < 1e-9) return [{ lat: lat1, lng: lng1 }, { lat: lat2, lng: lng2 }];
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const a = Math.sin((1 - f) * d) / Math.sin(d);
    const b = Math.sin(f * d) / Math.sin(d);
    const x = a * Math.cos(phi1) * Math.cos(lam1) + b * Math.cos(phi2) * Math.cos(lam2);
    const y = a * Math.cos(phi1) * Math.sin(lam1) + b * Math.cos(phi2) * Math.sin(lam2);
    const z = a * Math.sin(phi1) + b * Math.sin(phi2);
    const phi = Math.atan2(z, Math.sqrt(x * x + y * y));
    const lam = Math.atan2(y, x);
    pts.push({ lat: toDeg(phi), lng: toDeg(lam) });
  }
  return pts;
}

// ---- Public API -----------------------------------------------------------
// Route: { points:[{lat,lng}], cum:[km], roadKm, usesFerry:false,
//          bordersCrossed, borderNames, ferrySegment:null, ferrySegments:[] }
export function computeRoute(fromLat, fromLng, toLat, toLng) {
  if (fromLat === toLat && fromLng === toLng) return null;
  const points = greatCircleSteps(fromLat, fromLng, toLat, toLng, 24);
  const cum = polylineLengths(points);
  const roadKm = Math.round((cum[cum.length - 1] || 0) * AIR_ROUTE_FACTOR);

  // International flight? Compare the country of the nearest known city at
  // each end — still routes through customs time/fees the same way a road
  // border crossing used to.
  const fromCity = nearestCity(fromLat, fromLng);
  const toCity = nearestCity(toLat, toLng);
  const fromCountry = fromCity?.country || 'IN', toCountry = toCity?.country || 'IN';
  const bordersCrossed = fromCountry !== toCountry ? 1 : 0;

  return {
    points, cum, roadKm, usesFerry: false, nodeIds: [],
    bordersCrossed, borderNames: bordersCrossed ? [`${fromCountry}–${toCountry}`] : [],
    ferrySegment: null, ferrySegments: [],
  };
}

// Insert refuelling/technical stops: on routes longer than the aircraft's
// range, a stop is placed at the nearest fuel depot to each waypoint where
// remaining range would run out. Returns [{lat,lng,atKm,station}].
import { findStationNear } from './stations';
export function planFuelStops(route, model) {
  const range = model.range * 0.9; // keep a 10% reserve
  const total = route.roadKm;
  if (total <= range) return [];
  const stops = [];
  const nStops = Math.ceil(total / range) - 1;
  for (let i = 1; i <= nStops; i++) {
    const t = i / (nStops + 1);
    const idx = route.cum.findIndex(c => c >= t * route.cum[route.cum.length - 1]);
    const p = route.points[Math.max(1, idx)];
    const station = findStationNear(p.lat, p.lng, model.propulsion === 'electric' ? 'ev' : 'diesel');
    stops.push({ lat: station ? station.lat : p.lat, lng: station ? station.lng : p.lng,
      atKm: Math.round(t * total), station });
  }
  return stops;
}

// Cities the great-circle path flies near — e.g. a Delhi -> Chennai cargo run
// really does pass over Nagpur, Hyderabad… Each city is projected onto the
// flight path and returned with its distance-along-route (atKm), ordered
// origin->destination, endpoints excluded.
export function routeCities(route, corridorKm = 80, max = 8) {
  if (!route || !route.points || route.points.length < 2) return [];
  const pts = route.points, cum = route.cum;
  const total = route.roadKm;
  const out = [];
  for (const c of CITIES) {
    let bestD = Infinity, bestIdx = 0;
    for (let i = 0; i < pts.length; i++) {
      const d = haversine(c.lat, c.lng, pts[i].lat, pts[i].lng);
      if (d < bestD) { bestD = d; bestIdx = i; }
    }
    if (bestD > corridorKm) continue;
    const atKm = Math.round(cum[bestIdx]);
    if (atKm < total * 0.06 || atKm > total * 0.94) continue; // skip endpoints
    out.push({ city: c, atKm, offsetKm: Math.round(bestD) });
  }
  // one entry per city (closest pass), sorted along the route
  const seen = new Set();
  return out
    .sort((a, b) => a.atKm - b.atKm || a.offsetKm - b.offsetKm)
    .filter(x => (seen.has(x.city.id) ? false : (seen.add(x.city.id), true)))
    .slice(0, max);
}

// Suggested destinations for an aircraft: nearby, reachable, profitable.
export function suggestDestinations(fromLat, fromLng, count = 5, allowedCountries = null) {
  const scored = CITIES
    .filter(c => !allowedCountries || allowedCountries.includes(c.country || 'IN'))
    .map(c => ({ c, d: haversine(fromLat, fromLng, c.lat, c.lng) }))
    .filter(x => x.d > 60 && x.d < 900)
    .sort((a, b) => (b.c.tier === 1 ? 2 : b.c.pop / 3e6) - (a.c.tier === 1 ? 2 : a.c.pop / 3e6) || a.d - b.d);
  const picks = [];
  for (const { c } of scored) {
    const r = computeRoute(fromLat, fromLng, c.lat, c.lng);
    if (r) picks.push({ city: c, route: r });
    if (picks.length >= count) break;
  }
  return picks;
}
