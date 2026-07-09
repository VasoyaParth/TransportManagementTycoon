// Routing engine — real road routing over the National Highway graph.
// Trucks NEVER travel in straight lines: every route is a Dijkstra shortest
// path over ROAD_EDGES, expanded into the full highway polyline (with `via`
// shape points), which the map animates along. Island cities connect only by
// ferry edges; anything else across water is unroutable.

import { ROAD_NODES, ROAD_EDGES, FERRY_EDGES } from '../data/highways';
import { CITIES } from '../data/cities';
import { haversine, polylineLengths } from './geo';

const ROAD_FACTOR = 1.18; // road km vs geometric polyline km (curvature not in shape points)

// ---- Build adjacency once ----------------------------------------------
const adj = {}; // nodeId -> [{to, km, edge, reversed, ferry}]
function addAdj(a, b, km, edge, reversed, ferry) {
  (adj[a] = adj[a] || []).push({ to: b, km, edge, reversed, ferry });
}

function edgePoints(edge, reversed) {
  const a = ROAD_NODES[edge.a], b = ROAD_NODES[edge.b];
  const mid = (edge.via || []).map(([lat, lng]) => ({ lat, lng }));
  const pts = [{ lat: a.lat, lng: a.lng }, ...mid, { lat: b.lat, lng: b.lng }];
  return reversed ? [...pts].reverse() : pts;
}

function edgeKm(edge) {
  const pts = edgePoints(edge, false);
  let km = 0;
  for (let i = 1; i < pts.length; i++) {
    km += haversine(pts[i - 1].lat, pts[i - 1].lng, pts[i].lat, pts[i].lng);
  }
  return km * ROAD_FACTOR;
}

// Build (or rebuild, after cloud hydration) the adjacency graph from the
// current ROAD_NODES / ROAD_EDGES / FERRY_EDGES contents.
export function rebuildGraph() {
  for (const k in adj) delete adj[k];
  for (const k in nearestNodeCache) delete nearestNodeCache[k];
  for (const e of ROAD_EDGES) {
    if (!ROAD_NODES[e.a] || !ROAD_NODES[e.b]) continue;
    const km = edgeKm(e);
    addAdj(e.a, e.b, km, e, false, false);
    addAdj(e.b, e.a, km, e, true, false);
  }
  for (const f of FERRY_EDGES) {
    if (!ROAD_NODES[f.a] || !ROAD_NODES[f.b]) continue;
    const km = edgeKm(f) * 1.05;
    addAdj(f.a, f.b, km, f, false, true);
    addAdj(f.b, f.a, km, f, true, true);
  }
}

// ---- City -> nearest road node -----------------------------------------
const nearestNodeCache = {};
rebuildGraph(); // initial build from bundled data
export function nearestRoadNode(lat, lng) {
  const key = lat.toFixed(3) + ',' + lng.toFixed(3);
  if (nearestNodeCache[key]) return nearestNodeCache[key];
  let best = null, bestD = Infinity;
  for (const id in ROAD_NODES) {
    const n = ROAD_NODES[id];
    const d = haversine(lat, lng, n.lat, n.lng);
    if (d < bestD) { bestD = d; best = id; }
  }
  nearestNodeCache[key] = { id: best, km: bestD };
  return nearestNodeCache[key];
}

export function cityById(id) {
  return CITIES.find(c => c.id === id);
}

// ---- Dijkstra ------------------------------------------------------------
function dijkstra(startId, endId) {
  const dist = { [startId]: 0 };
  const prev = {};
  const visited = new Set();
  // simple binary-less PQ: fine for a ~250-node graph
  const queue = [[0, startId]];
  while (queue.length) {
    let bi = 0;
    for (let i = 1; i < queue.length; i++) if (queue[i][0] < queue[bi][0]) bi = i;
    const [d, u] = queue.splice(bi, 1)[0];
    if (visited.has(u)) continue;
    visited.add(u);
    if (u === endId) break;
    for (const nb of adj[u] || []) {
      const nd = d + nb.km;
      if (nd < (dist[nb.to] ?? Infinity)) {
        dist[nb.to] = nd;
        prev[nb.to] = { from: u, hop: nb };
        queue.push([nd, nb.to]);
      }
    }
  }
  if (dist[endId] === undefined) return null;
  const hops = [];
  let cur = endId;
  while (cur !== startId) {
    hops.unshift(prev[cur]);
    cur = prev[cur].from;
  }
  return { km: dist[endId], hops };
}

// ---- Public API -----------------------------------------------------------
// Returns null if unroutable (e.g. mainland -> island with no ferry chain).
// Route: { points:[{lat,lng}], cum:[km], roadKm, usesFerry, nodeIds }
export function computeRoute(fromLat, fromLng, toLat, toLng) {
  const s = nearestRoadNode(fromLat, fromLng);
  const e = nearestRoadNode(toLat, toLng);
  if (!s.id || !e.id) return null;

  let points = [{ lat: fromLat, lng: fromLng }];
  let usesFerry = false;
  const nodeIds = [s.id];

  if (s.id !== e.id) {
    const path = dijkstra(s.id, e.id);
    if (!path) return null;
    const sn = ROAD_NODES[s.id];
    points.push({ lat: sn.lat, lng: sn.lng });
    for (const { hop } of path.hops) {
      const pts = edgePoints(hop.edge, hop.reversed);
      points.push(...pts.slice(1)); // skip duplicated start point
      if (hop.ferry) usesFerry = true;
      nodeIds.push(hop.to);
    }
  } else {
    const sn = ROAD_NODES[s.id];
    points.push({ lat: sn.lat, lng: sn.lng });
  }
  points.push({ lat: toLat, lng: toLng });

  // dedupe consecutive identical points
  points = points.filter((p, i) => i === 0 ||
    Math.abs(p.lat - points[i - 1].lat) > 1e-6 || Math.abs(p.lng - points[i - 1].lng) > 1e-6);

  const cum = polylineLengths(points);
  const roadKm = Math.round(cum[cum.length - 1] * ROAD_FACTOR);
  return { points, cum, roadKm, usesFerry, nodeIds };
}

// Insert fuel/charging stops: stations are placed along the route whenever the
// remaining range dips. Returns [{lat,lng,atKm,station}] (station from stations engine).
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

// Cities the route physically passes through/near — e.g. a Jaipur → Ahmedabad
// haul really rolls past Ajmer, Udaipur, Himatnagar… Each city is projected
// onto the polyline and returned with its distance-along-route (atKm, on the
// road-adjusted scale), ordered origin→destination, endpoints excluded.
export function routeCities(route, corridorKm = 45, max = 8) {
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
    const atKm = Math.round(cum[bestIdx] * ROAD_FACTOR);
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

// Suggested destinations for a truck: nearby, reachable, profitable (FR-6.4).
export function suggestDestinations(fromLat, fromLng, count = 5) {
  const scored = CITIES
    .map(c => ({ c, d: haversine(fromLat, fromLng, c.lat, c.lng) }))
    .filter(x => x.d > 60 && x.d < 900)
    .sort((a, b) => (b.c.tier === 1 ? 2 : b.c.pop / 3e6) - (a.c.tier === 1 ? 2 : a.c.pop / 3e6) || a.d - b.d);
  const picks = [];
  for (const { c } of scored) {
    const r = computeRoute(fromLat, fromLng, c.lat, c.lng);
    if (r && !r.usesFerry) picks.push({ city: c, route: r });
    if (picks.length >= count) break;
  }
  return picks;
}
