// Real road geometry (v2.5.0) — fetches the ACTUAL driving path between
// waypoints from the public OSRM server, so trucks follow real highways with
// every bend and bypass, exactly like a navigation app, instead of straight
// graph lines.
//
// STRICTLY VISUAL: distance, fuel, money, timing, borders and ferries all
// still come from the offline graph — if this fetch fails (offline, rate
// limit, timeout) the game silently keeps the classic straight-line path and
// nothing else changes. Results are cached (memory + disk) per waypoint set,
// so a corridor you run daily is fetched exactly once, ever.

import AsyncStorage from '@react-native-async-storage/async-storage';

const OSRM = 'https://router.project-osrm.org/route/v1/driving/';
const CACHE_KEY = 'real-road-cache-v1';
const CACHE_MAX = 220;      // cached corridors on disk (oldest evicted)
const MAX_POINTS = 420;     // per land leg after downsampling (keeps saves light)
const TIMEOUT_MS = 9000;

const mem = new Map();
let disk = null; // lazily loaded { key: [[lat,lng],...] }
let diskDirty = false;

async function loadDisk() {
  if (disk) return disk;
  try { disk = JSON.parse((await AsyncStorage.getItem(CACHE_KEY)) || '{}'); }
  catch (e) { disk = {}; }
  return disk;
}
async function saveDisk() {
  if (!diskDirty || !disk) return;
  diskDirty = false;
  try {
    const keys = Object.keys(disk);
    if (keys.length > CACHE_MAX) for (const k of keys.slice(0, keys.length - CACHE_MAX)) delete disk[k];
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(disk));
  } catch (e) { /* cache is best-effort */ }
}

// Evenly thin a polyline down to at most `max` points (endpoints kept).
export function downsample(pts, max = MAX_POINTS) {
  if (pts.length <= max) return pts;
  const out = [];
  const step = (pts.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) out.push(pts[Math.round(i * step)]);
  return out;
}

const keyOf = wps => wps.map(p => `${p.lat.toFixed(2)},${p.lng.toFixed(2)}`).join(';');

// One fetch at a time with a small gap — polite to the free OSRM server and
// avoids bursts when several deliveries start together.
let queue = Promise.resolve();
const GAP_MS = 350;

function fetchWithTimeout(url) {
  return new Promise((resolve, reject) => {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(() => { if (ctl) ctl.abort(); reject(new Error('timeout')); }, TIMEOUT_MS);
    fetch(url, ctl ? { signal: ctl.signal } : undefined)
      .then(r => { clearTimeout(timer); resolve(r); })
      .catch(e => { clearTimeout(timer); reject(e); });
  });
}

// waypoints: [{lat,lng}, ...] (2..10 points). Resolves to [{lat,lng},...]
// along real roads, or null on any failure (caller keeps the graph path).
export function fetchRealRoad(waypoints) {
  const run = async () => {
    if (!waypoints || waypoints.length < 2) return null;
    const key = keyOf(waypoints);
    if (mem.has(key)) return mem.get(key);
    const d = await loadDisk();
    if (d[key]) {
      const pts = d[key].map(([lat, lng]) => ({ lat, lng }));
      mem.set(key, pts);
      return pts;
    }
    const coords = waypoints.map(p => `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`).join(';');
    const url = `${OSRM}${coords}?overview=full&geometries=geojson&continue_straight=false`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.code !== 'Ok' || !json.routes?.[0]?.geometry?.coordinates?.length) return null;
    const pts = downsample(json.routes[0].geometry.coordinates.map(([lng, lat]) => ({ lat, lng })));
    mem.set(key, pts);
    d[key] = pts.map(p => [+p.lat.toFixed(5), +p.lng.toFixed(5)]);
    diskDirty = true;
    saveDisk();
    return pts;
  };
  // Serialize through the queue; never reject outward.
  const p = queue.then(run).catch(() => null);
  queue = p.then(() => new Promise(r => setTimeout(r, GAP_MS)));
  return p;
}
