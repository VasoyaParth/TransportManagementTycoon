// Fuel & charging stations — generated deterministically from the highway
// graph (so they always sit ON highways, near real corridors) plus city
// clusters. ~900+ stations (NFR-8) without shipping a giant data file.

import { ROAD_NODES, ROAD_EDGES } from '../data/highways';
import { CITIES } from '../data/cities';
import { haversine } from './geo';

// deterministic PRNG so every device generates identical stations
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BRANDS_DIESEL = ['IndianOil', 'Bharat Petroleum', 'HP Fuel Stop', 'Nayara Energy', 'Reliance Petro'];
const BRANDS_EV = ['Tata Power EZ', 'Statiq', 'ChargeZone', 'Ather Grid', 'Jio-bp Pulse'];

function buildStations() {
  const rnd = mulberry32(20260707);
  const stations = [];
  let id = 0;

  // Along every highway edge: a station every ~120km of edge length
  for (const e of ROAD_EDGES) {
    const a = ROAD_NODES[e.a], b = ROAD_NODES[e.b];
    if (!a || !b) continue;
    const pts = [{ ...a }, ...(e.via || []).map(([lat, lng]) => ({ lat, lng })), { ...b }];
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += haversine(pts[i - 1].lat, pts[i - 1].lng, pts[i].lat, pts[i].lng);
    const n = Math.max(1, Math.round(len / 120));
    for (let k = 1; k <= n; k++) {
      const t = k / (n + 1);
      // interpolate along the shape
      let target = t * len, acc = 0, lat = a.lat, lng = a.lng;
      for (let i = 1; i < pts.length; i++) {
        const seg = haversine(pts[i - 1].lat, pts[i - 1].lng, pts[i].lat, pts[i].lng);
        if (acc + seg >= target) {
          const f = (target - acc) / (seg || 1e-9);
          lat = pts[i - 1].lat + (pts[i].lat - pts[i - 1].lat) * f;
          lng = pts[i - 1].lng + (pts[i].lng - pts[i - 1].lng) * f;
          break;
        }
        acc += seg;
      }
      const ev = rnd() < 0.22;
      const brand = ev ? BRANDS_EV[(id + k) % BRANDS_EV.length] : BRANDS_DIESEL[(id + k) % BRANDS_DIESEL.length];
      stations.push({
        id: 's' + id++, name: `${brand} · ${e.nh || 'Highway'}`,
        lat: +(lat + (rnd() - 0.5) * 0.03).toFixed(3),
        lng: +(lng + (rnd() - 0.5) * 0.03).toFixed(3),
        type: ev ? 'ev' : 'diesel',
        price: ev ? +(8 + rnd() * 3).toFixed(1) : +(88 + rnd() * 9).toFixed(1),
      });
    }
  }

  // Around cities: count scales with tier
  for (const c of CITIES) {
    const n = c.tier === 1 ? 4 : c.tier === 2 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const ev = rnd() < (c.tier === 1 ? 0.4 : 0.2);
      const brand = ev ? BRANDS_EV[k % BRANDS_EV.length] : BRANDS_DIESEL[k % BRANDS_DIESEL.length];
      stations.push({
        id: 's' + id++, name: `${brand} · ${c.name}`,
        lat: +(c.lat + (rnd() - 0.5) * 0.15).toFixed(3),
        lng: +(c.lng + (rnd() - 0.5) * 0.15).toFixed(3),
        type: ev ? 'ev' : 'diesel',
        price: ev ? +(8 + rnd() * 3).toFixed(1) : +(88 + rnd() * 9).toFixed(1),
      });
    }
  }
  return stations;
}

export const STATIONS = buildStations();

export function findStationNear(lat, lng, type) {
  let best = null, bestD = Infinity;
  for (const s of STATIONS) {
    if (type && s.type !== type) continue;
    const d = haversine(lat, lng, s.lat, s.lng);
    if (d < bestD) { bestD = d; best = s; }
  }
  return best;
}
