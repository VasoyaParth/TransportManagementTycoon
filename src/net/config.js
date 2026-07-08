// Cloud config hydrator. At startup (after login) this pulls ALL game catalogs
// from the backend and overwrites the in-memory arrays IN PLACE, so every
// screen and engine module reads cloud data — the bundled arrays act only as an
// offline safety net if a collection can't be fetched.
import { api } from './api';
import * as Cities from '../data/cities';
import * as Trucks from '../data/trucks';
import * as Staff from '../data/staffNames';
import * as Stations from '../engine/stations';
import * as Highways from '../data/highways';
import { setEconomy } from '../engine/economy';
import { rebuildGraph } from '../engine/routing';

// Fetch every page of a paginated collection into one array.
async function fetchAll(collection) {
  let cursor = '';
  const out = [];
  let guard = 0;
  do {
    const res = await api.config(collection, cursor, 100);
    const items = (res && res.items) || [];
    out.push(...items);
    const nc = res && res.nextCursor;
    cursor = nc == null ? '' : String(nc);
    if (++guard > 500) break;
  } while (cursor);
  return out;
}

// Overwrite an array's contents in place (keeps the shared reference alive).
function replaceArr(arr, next) {
  if (!Array.isArray(arr) || !Array.isArray(next) || next.length === 0) return false;
  arr.length = 0;
  arr.push(...next);
  return true;
}

// Which cloud collection fills which in-memory array.
const ARRAY_MAP = [
  ['cities', Cities.CITIES],
  ['states', Cities.STATES],
  ['trucks', Trucks.TRUCK_MODELS],
  ['cargo', Trucks.CARGO_TYPES],
  ['campaigns', Trucks.CAMPAIGNS],
  ['powerups', Trucks.POWERUPS],
  ['contractFlavors', Trucks.CONTRACT_FLAVORS],
  ['truckColors', Trucks.TRUCK_COLORS],
  ['truckLogos', Trucks.TRUCK_LOGOS],
  ['logos', Trucks.LOGOS],
  ['avatars', Trucks.AVATARS],
  ['companyNames', Trucks.COMPANY_NAME_IDEAS],
  ['staffRoles', Staff.STAFF_ROLES],
  ['staffLevels', Staff.STAFF_LEVELS],
  ['stations', Stations.STATIONS],
];

// Returns { ok, loaded: {collection: count}, failed: [collection] }.
export async function hydrateConfig() {
  const loaded = {};
  const failed = [];
  await Promise.all(ARRAY_MAP.map(async ([name, target]) => {
    try {
      const data = await fetchAll(name);
      if (replaceArr(target, data)) loaded[name] = data.length;
      else failed.push(name);
    } catch {
      failed.push(name);
    }
  }));
  // Staff name pools arrive as a flat, paginated list of {name, gender}.
  try {
    const rows = await fetchAll('staffNames');
    if (rows.length) {
      const m = rows.filter(r => r.gender === 'm').map(r => r.name);
      const f = rows.filter(r => r.gender === 'f').map(r => r.name);
      if (m.length) { Staff.STAFF_NAMES.m.length = 0; Staff.STAFF_NAMES.m.push(...m); }
      if (f.length) { Staff.STAFF_NAMES.f.length = 0; Staff.STAFF_NAMES.f.push(...f); }
      loaded.staffNames = m.length + f.length;
    }
  } catch { failed.push('staffNames'); }

  // Highway graph: road nodes ({key,lat,lng}), road edges & ferry edges.
  try {
    const [nodes, edges, ferries] = await Promise.all([
      fetchAll('roadNodes'), fetchAll('roadEdges'), fetchAll('ferryEdges'),
    ]);
    let touched = false;
    if (nodes.length) {
      for (const k in Highways.ROAD_NODES) delete Highways.ROAD_NODES[k];
      for (const n of nodes) if (n.key) Highways.ROAD_NODES[n.key] = { lat: n.lat, lng: n.lng };
      loaded.roadNodes = nodes.length; touched = true;
    }
    if (replaceArr(Highways.ROAD_EDGES, edges)) { loaded.roadEdges = edges.length; touched = true; }
    if (replaceArr(Highways.FERRY_EDGES, ferries)) { loaded.ferryEdges = ferries.length; touched = true; }
    if (touched) rebuildGraph(); // recompute Dijkstra adjacency from cloud data
  } catch { failed.push('highways'); }

  // Economy constants (rates, fuel prices, tolls) — applied live so DB edits take effect.
  try {
    const res = await api.config('economyConfig', '', 5);
    const cfg = res && res.items && res.items[0];
    if (cfg) { setEconomy(cfg); loaded.economyConfig = 1; }
  } catch { failed.push('economyConfig'); }

  // Staff avatar map (role:gender → icon).
  try {
    const res = await api.config('staffAvatar', '', 5);
    const doc = res && res.items && res.items[0];
    if (doc && typeof doc === 'object') {
      for (const k in doc) if (k !== '_id' && k !== 'order') Staff.STAFF_AVATAR[k] = doc[k];
      loaded.staffAvatar = 1;
    }
  } catch { failed.push('staffAvatar'); }

  return { ok: Object.keys(loaded).length > 0, loaded, failed };
}
