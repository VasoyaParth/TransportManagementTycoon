// Fuel & charging depots — generated deterministically around every airport
// city (so refuelling is always available near where aircraft actually fly),
// scaled by city tier. Airline edition: no highway network to string these
// along, so depots cluster at airports instead.

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

const BRANDS_DIESEL = ['IndianOil Aviation', 'Bharat Petroleum ATF', 'HP SkyFuel', 'Nayara AeroFuel', 'Reliance AeroFuel'];
const BRANDS_EV = ['Tata Power EZ', 'Statiq Air', 'ChargeZone', 'Ather Grid', 'Jio-bp Pulse'];

function buildStations() {
  const rnd = mulberry32(20260707);
  const stations = [];
  let id = 0;

  // Fuel depots around every airport city — count scales with tier.
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
