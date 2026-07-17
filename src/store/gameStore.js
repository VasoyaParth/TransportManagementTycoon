// Game store — single source of truth. Zustand + AsyncStorage persistence.
// Offline-first: everything is timestamp-based so elapsed real time while the
// app was closed is settled on load (deliveries complete, builds finish,
// campaigns expire, salaries get paid) — no backend, ever.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TRUCK_MODELS, CARGO_TYPES, CAMPAIGNS, POWERUPS, CONTRACT_FLAVORS } from '../data/trucks';
import { HQ_TIERS, GARAGE_TIERS } from '../data/buildings';
import { COUNTRY_BY_CODE } from '../data/expansion';
import { STAFF_NAMES, STAFF_LEVELS } from '../data/staffNames';
import { CITIES } from '../data/cities';
import { computeRoute, planFuelStops, cityById } from '../engine/routing';
import { cmpVer } from '../net/updates';
import { deliveryEconomics, tripDurationSec, inr, REAL_SEC_PER_GAME_HOUR, ECON } from '../engine/economy';
import { play, setSoundEnabled, setMusicVolume, setSfxVolume } from '../engine/sound';
import { setHapticsEnabled, setHapticsIntensity } from '../engine/haptics';
import { initNotifications, pushNow, scheduleAt, setNotificationsEnabled, flavor } from '../engine/notify';
import { writeAutoBackup } from '../engine/backup';

// Random-flavoured OS push: picks a fresh funny line each time.
const pushFlavor = (kind, vars) => { const f = flavor(kind, vars); pushNow(f.title, f.body); };

export const GAME_HOUR_MS = 3600000; // 1 in-game hour = 1 real minute -> 1 day = 24 min
const SALARY_EVERY_DAYS = 30;
const CONTRACTS_PER_DAY = 6;
// Fresh contracts land on the board every ~2–4 hours (not just at day rollover).
const CONTRACT_REFRESH_MIN_MS = 2 * 3600 * 1000;
const CONTRACT_REFRESH_MAX_MS = 4 * 3600 * 1000;
const nextRefreshDelay = () =>
  CONTRACT_REFRESH_MIN_MS + Math.random() * (CONTRACT_REFRESH_MAX_MS - CONTRACT_REFRESH_MIN_MS);
// Gold → cash exchange rate (₹ per Gold). Gold is premium, so it converts rich.
export const GOLD_TO_CASH = 50000;

// Flat Gold cost to apply a new truck livery (colour/accent/emblem), charged
// once per Apply — see paintTruck().
export const LIVERY_COST = 20;

// ---- Free daily gold mini-games (replace watch-to-earn ads) ----
export const DAILY_PLAYS = 10; // per game, per in-game day
// Roulette wheel — fixed segment order (UI spins to the landed index). Weighted
// so big prizes are rare; most spins give little or nothing.
export const ROULETTE_SEGMENTS = [
  { label: '+1 Gold', type: 'gold', amount: 1, color: '#2563EB', w: 24 },
  { label: 'Try again', type: 'nothing', color: '#98A1AD', w: 18 },
  { label: '+2 Gold', type: 'gold', amount: 2, color: '#0E9F5B', w: 16 },
  { label: 'Speed 1h', type: 'speed', color: '#D97706', w: 10 },
  { label: '+3 Gold', type: 'gold', amount: 3, color: '#7D3C98', w: 11 },
  { label: 'Try again', type: 'nothing', color: '#98A1AD', w: 13 },
  { label: '2× Next', type: 'double', color: '#C0392B', w: 5 },
  { label: '+5 Gold', type: 'gold', amount: 5, color: '#B7791F', w: 3 },
];
// Scratch-card payout rules — a random rule is applied to the 6 revealed tiles.
const SCRATCH_RULES = [
  { id: 'avg', label: 'Average of all 6', calc: t => Math.floor(t.reduce((a, b) => a + b, 0) / 6) },
  { id: 'min', label: 'Lowest tile', calc: t => Math.min(...t) },
  { id: 'max', label: 'Highest tile', calc: t => Math.max(...t) },
  { id: 'sum3', label: 'First 3 added up', calc: t => t[0] + t[1] + t[2] },
  { id: 'min3', label: 'Lowest of first 3', calc: t => Math.min(t[0], t[1], t[2]) },
  { id: 'pick', label: 'One lucky tile', calc: t => t[Math.floor(Math.random() * 6)] },
];
const clampGold = v => Math.max(0, Math.min(5, Math.round(v))); // scratch caps at 5
// Slot Machine — 3 independent reels, weighted so rare symbols pay bigger.
export const SLOT_SYMBOLS = [
  { id: 'cherry', icon: 'fruit-cherries', weight: 30 },
  { id: 'lemon', icon: 'fruit-citrus', weight: 26 },
  { id: 'bell', icon: 'bell-ring', weight: 18 },
  { id: 'clover', icon: 'clover', weight: 14 },
  { id: 'gem', icon: 'diamond-stone', weight: 8 },
  { id: 'seven', icon: 'numeric-7-circle', weight: 4 },
];
const SLOT_JACKPOT = { cherry: 2, lemon: 3, bell: 4, clover: 6, gem: 10, seven: 20 };

// Golden Convoy symbols — `count` copies of each go into the 9-container bag,
// `value` is the Gold tier (pair pays value, three-of-a-kind pays value × 3).
export const CONVOY_SYMBOLS = [
  { id: 'diesel', icon: 'barrel', name: 'Diesel', value: 1, count: 3, color: '#8C6D3F' },
  { id: 'tyre', icon: 'tire', name: 'Tyre', value: 2, count: 3, color: '#3E4650' },
  { id: 'horn', icon: 'bullhorn', name: 'Air Horn', value: 3, count: 2, color: '#B4562F' },
  { id: 'gold', icon: 'gold', name: 'Gold Bar', value: 5, count: 2, color: '#B8860B' },
  { id: 'gem', icon: 'diamond-stone', name: 'Diamond', value: 8, count: 1, color: '#2563EB' },
  { id: 'key', icon: 'key-variant', name: 'Golden Key', value: 12, count: 1, color: '#7D3C98' },
];
const clampSlot = v => Math.max(0, Math.min(25, Math.round(v))); // jackpot can exceed scratch's 5 cap
function rollSlotSymbol() {
  const total = SLOT_SYMBOLS.reduce((a, x) => a + x.weight, 0);
  let roll = Math.random() * total;
  for (const sym of SLOT_SYMBOLS) { roll -= sym.weight; if (roll <= 0) return sym; }
  return SLOT_SYMBOLS[0];
}

// Toll Gate Pick (v3.8.0) — replaces Slot Machine + Golden Convoy. Four toll
// lanes, pick one; most pay a little gold, one lane is a dead lane (nothing),
// and rarely a lane pays a CASH bonus instead of gold — the only free
// mini-game that can hand out actual rupees, not just Gold.
export const TOLL_LANES = [
  { id: 'gold1', type: 'gold', amount: 2, weight: 30, icon: 'gold', label: '+2 Gold' },
  { id: 'gold2', type: 'gold', amount: 4, weight: 22, icon: 'gold', label: '+4 Gold' },
  { id: 'nothing', type: 'nothing', weight: 20, icon: 'close-circle-outline', label: 'Waved through — nothing' },
  { id: 'gold3', type: 'gold', amount: 7, weight: 14, icon: 'gold', label: '+7 Gold' },
  { id: 'cash1', type: 'cash', amount: 25000, weight: 9, icon: 'cash', label: '₹25K refund' },
  { id: 'gold4', type: 'gold', amount: 12, weight: 4, icon: 'gold', label: '+12 Gold' },
  { id: 'cash2', type: 'cash', amount: 75000, weight: 1, icon: 'cash-multiple', label: '₹75K jackpot refund' },
];
// International customs charged per border crossing (v1.4.0 expansion).
const CUSTOMS_FEE_BASE = 15000;   // ₹ paperwork/duty per crossing
const CUSTOMS_FEE_PER_TON = 800;  // ₹ per ton per crossing
const CUSTOMS_HOURS = 3;          // game-hours of inspection time per crossing

// Truck condition & on-road incidents (v1.5.0). Condition degrades with km
// driven and gets knocked down by accidents; low condition slows the truck
// down (never destroys anything). Incidents are a partial cash+time hit on an
// in-progress delivery, resolved either slowly on their own or faster by
// paying for a mechanic to come out.
const CONDITION_WEAR_PER_KM = 0.0018; // ~55% condition lost over 300,000km of hard use
const CONDITION_MIN_SPEED_FACTOR = 0.65; // speed floor at 0 condition (never fully stalls)
const SERVICE_COST_PCT = 0.05;    // service cost as a % of the model's price
const INCIDENT_INTERVAL_MS = { rare: 22 * 60 * 1000, sometimes: 10 * 60 * 1000 };
const INCIDENT_CHANCE = { rare: 0.16, sometimes: 0.3 };
const MECHANIC_DELAY_CUT = 0.6; // mechanic call-out shaves this fraction off the remaining delay

// On-road incident catalog. `mechanic: true` = a mechanic call-out can cut the
// delay (physical breakdowns only — you can't "repair" a theft or a police
// checkpost, those you just accept and ride out). Weights sum to 1.
export const INCIDENT_TYPES = [
  {
    id: 'accident', weight: 0.28, title: 'Accident on the road!', icon: 'car-brake-alert', color: '#DC3D43',
    mechanic: true, conditionHit: [8, 18], delayMin: 600, delayMax: 2400, penaltyMin: 0.04, penaltyMax: 0.12,
    notify: (name, p) => `${name} was clipped on the highway — ${inr(p)} in damage. A mechanic can get it moving faster.`
  },
  {
    id: 'flat', weight: 0.24, title: 'Tyre burst!', icon: 'car-tire-alert', color: '#D97706',
    mechanic: true, conditionHit: [3, 8], delayMin: 300, delayMax: 1200, penaltyMin: 0.01, penaltyMax: 0.04,
    notify: (name, p) => `${name} blew a tyre — ${inr(p)} for a roadside replacement. A mechanic can speed it up.`
  },
  {
    id: 'theft', weight: 0.2, title: 'Cargo theft in transit!', icon: 'shield-alert', color: '#7D3C98',
    mechanic: false, conditionHit: null, delayMin: 600, delayMax: 1800, penaltyMin: 0.05, penaltyMax: 0.12,
    notify: (name, p) => `Bandits grabbed part of ${name}'s cargo — lost ${inr(p)}. Nothing to fix; the driver carries on.`
  },
  {
    id: 'checkpost', weight: 0.16, title: 'Police checkpost', icon: 'police-badge', color: '#2563EB',
    mechanic: false, conditionHit: null, delayMin: 240, delayMax: 900, penaltyMin: 0.01, penaltyMax: 0.03,
    notify: (name, p) => `${name} pulled over for papers — ${inr(p)} in fines/chai-pani and a short wait.`
  },
  {
    id: 'weather', weight: 0.12, title: 'Heavy weather ahead', icon: 'weather-pouring', color: '#0E7C86',
    mechanic: false, conditionHit: null, delayMin: 480, delayMax: 1500, penaltyMin: 0, penaltyMax: 0.01,
    notify: (name) => `${name} slowed to a crawl in a downpour — waiting it out safely.`
  },
];
export const incidentMeta = id => INCIDENT_TYPES.find(x => x.id === id) || INCIDENT_TYPES[0];

// Where a live delivery is in its lifecycle at `now`, and how far along the
// ROUTE (0..1) the truck should be drawn. Walks the phase timeline built from
// the per-delivery durations saved by startDelivery: loading at origin →
// drive → (ferry paperwork/board → sail → dock/roll-off) → drive → unloading.
// Old saves without phase fields degrade gracefully to pure driving.
export function deliveryPhase(d, now = Date.now()) {
  const total = Math.max(1, (d.endsAt - d.startedAt) / 1000);
  const load = d.loadSec || 0, unload = d.unloadSec || 0;
  // Every sea hop gets its own board → sail → roll-off cycle, so multi-ferry
  // routes (mainland → island → island) convert truck↔ferry at each port
  // instead of treating everything between the first and last hop as "at sea".
  const hops = (d.route && (d.route.ferrySegments
    || (d.route.ferrySegment ? [d.route.ferrySegment] : []))) || [];
  const board = hops.length ? (d.ferryBoardSec || 0) : 0;
  const unboard = hops.length ? (d.ferryUnboardSec || 0) : 0;
  const drive = Math.max(1, total - load - unload - (board + unboard) * hops.length);
  const segs = [{ phase: 'loading', dur: load, f0: 0, f1: 0 }];
  let prev = 0;
  for (const h of hops) {
    if (h.startFrac > prev) segs.push({ phase: 'driving', dur: drive * (h.startFrac - prev), f0: prev, f1: h.startFrac });
    segs.push({ phase: 'ferry-board', dur: board, f0: h.startFrac, f1: h.startFrac });
    segs.push({ phase: 'ferry', dur: drive * (h.endFrac - h.startFrac), f0: h.startFrac, f1: h.endFrac });
    segs.push({ phase: 'ferry-unboard', dur: unboard, f0: h.endFrac, f1: h.endFrac });
    prev = h.endFrac;
  }
  if (prev < 1) segs.push({ phase: 'driving', dur: drive * (1 - prev), f0: prev, f1: 1 });
  segs.push({ phase: 'unloading', dur: unload, f0: 1, f1: 1 });
  let t = (now - d.startedAt) / 1000;
  if (t <= 0) return { phase: 'loading', frac: 0 };
  for (const sg of segs) {
    if (t < sg.dur) return { phase: sg.phase, frac: sg.f0 + (sg.f1 - sg.f0) * (sg.dur > 0 ? t / sg.dur : 0) };
    t -= sg.dur;
  }
  return { phase: 'done', frac: 1 };
}

// Short human label per phase for banners/trackers.
export const PHASE_LABELS = {
  loading: 'Loading goods at origin',
  driving: 'On the road',
  'ferry-board': 'Clearing paperwork & boarding the ferry',
  ferry: 'At sea — truck aboard the ferry',
  'ferry-unboard': 'Docked — rolling off & clearing papers',
  unloading: 'Unloading at destination',
  done: 'Arrived',
};

// ---------- Staff mood (derived, not stored) ----------
// Drivers tire right after a trip and recharge with rest; mechanics get busy
// whenever the fleet needs fixing. Managers are disabled (see randomCandidates).
export function staffMood(member, { trucks = [], deliveries = [] } = {}, now = Date.now()) {
  if (member.role === 'driver') {
    if (member.truckId && deliveries.some(d => d.truckId === member.truckId)) {
      return { label: 'On the road', icon: 'truck-fast', color: '#2563EB' };
    }
    if ((member.lastTripEndAt || 0) > now - 3 * 3600 * 1000) {
      return { label: 'Tired — resting', icon: 'sleep', color: '#D97706' };
    }
    return { label: 'Energetic', icon: 'lightning-bolt', color: '#12A150' };
  }
  if (member.role === 'mechanic') {
    const busy = trucks.some(t => t.status === 'broken') || deliveries.some(d => d.incident && d.incident.mechanicCalled);
    return busy
      ? { label: 'Busy fixing', icon: 'wrench-clock', color: '#D97706' }
      : { label: 'Relaxed — chai break', icon: 'coffee', color: '#12A150' };
  }
  return { label: 'On duty', icon: 'briefcase-account', color: '#64748B' };
}

let idSeq = 1;
const uid = p => `${p}-${Date.now().toString(36)}-${(idSeq++).toString(36)}`;

// Rescale every active delivery to run at 2x pace WITHOUT a position jump.
// Naively halving `endsAt` shrinks the total duration while `startedAt` stays
// put, so frac = elapsed/total suddenly jumps forward — the truck teleports
// ahead on the map. Instead we solve for a new startedAt/endsAt pair that
// keeps frac continuous at the moment of the boost, then doubles the rate of
// change thereafter — the truck visibly speeds up along the same path
// instead of skipping forward.
function rescaleDeliveriesFaster(deliveries, now, factor = 2) {
  return deliveries.map(d => {
    const oldTotal = Math.max(1, d.endsAt - d.startedAt);
    const f0 = Math.min(1, Math.max(0, (now - d.startedAt) / oldTotal));
    const newTotal = oldTotal / factor;
    const newStartedAt = now - f0 * newTotal;
    // Every sub-duration deliveryPhase uses to build its piecewise timeline
    // (load/unload/ferry board-unboard, in absolute seconds) must shrink by
    // the SAME factor as the total, or the phase boundaries shift relative
    // to the new total and frac still jumps a little at the seam. Scaling
    // them all together keeps deliveryPhase's output perfectly continuous.
    return {
      ...d, startedAt: newStartedAt, endsAt: newStartedAt + newTotal,
      loadSec: (d.loadSec || 0) / factor, unloadSec: (d.unloadSec || 0) / factor,
      ferryBoardSec: (d.ferryBoardSec || 0) / factor, ferryUnboardSec: (d.ferryUnboardSec || 0) / factor,
    };
  });
}

export const modelById = id => TRUCK_MODELS.find(m => m.id === id);
export const cargoById = id => CARGO_TYPES.find(c => c.id === id);

// ---------- Garage / hub economics (price & upkeep vary by city) ----------
const HUB_BASE_COST = { 1: 25000000, 2: 12000000, 3: 6000000 }; // ₹ by tier
const HUB_MONTHLY_MAINT = { 1: 150000, 2: 80000, 3: 40000 };     // ₹/month by tier
// Deterministic ±10% wobble per city so every city has its own distinct price.
function cityWobble(id) {
  let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 21 - 10) / 100;
}
export function hubCostForCity(city) {
  if (!city) return 0;
  const base = HUB_BASE_COST[city.tier] || 6000000;
  return Math.round((base * (1 + cityWobble(city.id))) / 100000) * 100000;
}
export function hubMaintForCity(city) {
  if (!city) return 0;
  return HUB_MONTHLY_MAINT[city.tier] || 40000;
}

function makeNotification(type, icon, message) {
  return { id: uid('n'), type, icon, message, ts: Date.now(), read: false };
}

// Maps each contract flavour to the CARGO_TYPES id it actually represents, so
// the New Delivery sheet can pre-select the right cargo instead of always
// defaulting to "General Goods" for every contract.
const FLAVOR_CARGO = {
  bulk: 'construction', longhaul: 'general', government: 'general', mining: 'steel',
  urgent: 'retail', pharma: 'pharma', green: 'electronics', island: 'general',
};

// ============================ v2.4.0 systems ============================
// ---------- Bank & Loans ----------
// Flat-interest EMI loans: total due = principal × (1 + apr), split over
// `months` EMI installments, charged every LOAN_EMI_INTERVAL_DAYS game days
// (v3.9.0: every 2 days, not once a month — a loan is a live, closely-watched
// thing, not a background chore). Credit score moves with on-time vs missed
// EMIs and gates the bigger products.
export const LOAN_EMI_INTERVAL_DAYS = 2;
// Every loan is secured against real collateral — trucks and/or garages
// pledged at loan time, worth at least COLLATERAL_COVERAGE of the amount
// borrowed. Miss enough EMIs in a row and the bank seizes the cheapest
// pledged asset still standing to claw back what's owed — a truck or garage
// pledged to the bank shows a small bank badge everywhere it appears (the
// same "small circle" treatment as an on-road incident badge).
export const COLLATERAL_COVERAGE = 0.7; // pledged assets must cover 70% of the loan
export const MISSED_STREAK_FOR_REPO = 2; // 2 consecutive missed EMIs on one loan -> repossession
export const LOAN_PRODUCTS = [
  { id: 'micro', name: 'Micro Loan', icon: 'cash-fast', amount: 500000, apr: 0.10, months: 6, minScore: 0,
    blurb: 'A quick top-up — fuel this week, a small repair, nothing fancy.' },
  { id: 'kickstart', name: 'Kickstart Loan', icon: 'rocket-launch-outline', amount: 2500000, apr: 0.12, months: 10, minScore: 0,
    blurb: 'A starter line of credit — fuel, hires, first garage.' },
  { id: 'fleet', name: 'Fleet Builder Loan', icon: 'truck-plus', amount: 10000000, apr: 0.15, months: 20, minScore: 600,
    blurb: 'Serious capital for serious rigs. Banks like a clean record.' },
  { id: 'empire', name: 'Empire Loan', icon: 'bank', amount: 50000000, apr: 0.18, months: 30, minScore: 720,
    blurb: 'Country unlocks, garage networks, the big leagues.' },
  { id: 'titan', name: 'Titan Loan', icon: 'domain', amount: 150000000, apr: 0.20, months: 36, minScore: 800,
    blurb: 'Continental expansion money. Only the banks’ best customers see this offer.' },
];
export function creditScoreOf(credit) {
  const c = credit || { paid: 0, missed: 0 };
  return Math.max(300, Math.min(900, 650 + (c.paid || 0) * 8 - (c.missed || 0) * 45));
}

// Every truck/garage currently pledged as collateral on ANY active loan —
// used to badge them everywhere (Fleet list, truck detail, map) and to stop
// the same asset being pledged twice.
export function pledgedTruckIds(s) {
  const set = new Set();
  for (const ln of s.loans || []) for (const id of ln.collateral?.truckIds || []) set.add(id);
  return set;
}
export function pledgedHubCityIds(s) {
  const set = new Set();
  for (const ln of s.loans || []) for (const id of ln.collateral?.hubCityIds || []) set.add(id);
  return set;
}
// Live resale value of a piece of collateral right now (assets depreciate,
// so this is recomputed fresh every time, not frozen at pledge time).
function collateralAssetValue(s, kind, id) {
  if (kind === 'truck') {
    const t = s.trucks.find(x => x.id === id);
    if (!t) return 0;
    const model = modelById(t.modelId);
    const wear = Math.min(0.45, (t.km / 200000) * 0.35 + (t.deliveries / 200) * 0.1);
    return Math.round(model.price * (0.7 - wear));
  }
  if (kind === 'hub') {
    const h = (s.hubs || []).find(x => x.cityId === id);
    if (!h || h.hq) return 0;
    return Math.round((h.cost || 0) * 0.5);
  }
  return 0;
}
export function collateralTotalValue(s, collateral) {
  if (!collateral) return 0;
  let total = 0;
  for (const id of collateral.truckIds || []) total += collateralAssetValue(s, 'truck', id);
  for (const id of collateral.hubCityIds || []) total += collateralAssetValue(s, 'hub', id);
  return total;
}

// ---------- Custom Loan (slider-picked amount, v3.8.0) ----------
// Instead of only fixed catalog amounts, the player can pick ANY amount on a
// slider — e.g. exactly ₹5,00,000 — and the terms scale smoothly with both
// the amount (bigger = slightly pricier) and the player's credit score
// (better score = cheaper + longer runway), computed live as they drag.
export const CUSTOM_LOAN_MIN = 100000; // ₹1L floor
export function customLoanMax(score) {
  // Poor score (300) tops out around ₹25L; excellent score (900) opens up
  // to ₹6Cr — same spirit as the fixed tiers' minScore gates, but continuous.
  const f = Math.max(0, Math.min(1, (score - 300) / 600));
  return Math.round((2500000 + f * 57500000) / 100000) * 100000;
}
export function customLoanTerms(amount, score) {
  const f = Math.max(0, Math.min(1, (score - 300) / 600));
  const sizeFactor = Math.max(0, Math.min(1, (amount - CUSTOM_LOAN_MIN) / (100000000 - CUSTOM_LOAN_MIN)));
  const apr = Math.max(0.08, Math.min(0.22, 0.09 + sizeFactor * 0.09 - f * 0.05));
  const months = 6 + Math.round(sizeFactor * 24) + Math.round(f * 6); // 6–36 months
  const totalDue = Math.round(amount * (1 + apr));
  return { apr, months, totalDue, emi: Math.round(totalDue / months) };
}

// ---------- Fuel price market ----------
// Diesel drifts every game day on a deterministic walk (hash of the day), so
// the whole fleet sees the same market and the 7-day history can be redrawn
// anywhere without storing it. 0.85× (crash) … 1.25× (spike) of base price.
export function fuelFactorForDay(day) {
  let h = (day * 2654435761) >>> 0; h = (h ^ (h >>> 13)) >>> 0; h = (h * 2246822519) >>> 0; h = (h ^ (h >>> 16)) >>> 0;
  return 0.85 + (h % 41) / 100;
}

// ---------- Daily showroom deals ----------
// A rotating set of trucks goes on sale every game day — deterministic from
// the day hash so every player (and every restart) sees the same deals.
// Returns 0 or the discount fraction (0.10–0.25) for a model today.
export function truckDealFor(modelId, day) {
  let h = ((day + 3) * 2654435761) >>> 0;
  for (let i = 0; i < modelId.length; i++) h = ((h * 31 + modelId.charCodeAt(i)) >>> 0);
  h = (h ^ (h >>> 13)) >>> 0;
  if (h % 100 < 18) return (10 + (h >>> 8) % 16) / 100; // ~18% of models: 10–25% off
  return 0;
}
export function dealPriceFor(model, day) {
  const d = truckDealFor(model.id, day);
  return d ? Math.round((model.price * (1 - d)) / 10000) * 10000 : model.price;
}

// ---------- Driver XP, levels & perks ----------
// Drivers earn XP per delivery (distance-weighted). Levels unlock permanent
// perks that plug straight into the delivery economics and incident rolls.

export const DRIVER_PERKS = [
  { level: 2, id: 'fuel_saver', name: 'Fuel Saver', icon: 'gas-station-outline', desc: '−5% fuel cost on every trip' },
  { level: 4, id: 'night_rider', name: 'Night Rider', icon: 'weather-night', desc: '+8% driving pace' },
  { level: 6, id: 'border_expert', name: 'Border Expert', icon: 'passport', desc: '−30% customs waiting time' },
  { level: 8, id: 'road_captain', name: 'Road Captain', icon: 'shield-check', desc: '−20% chance of road incidents' },
  { level: 10, id: 'living_legend', name: 'Living Legend', icon: 'crown', desc: '+10% freight revenue' },
];
export const driverLevel = xp => Math.min(10, Math.floor(Math.sqrt((xp || 0) / 250)));
export const driverXpForLevel = l => l * l * 250;
export const driverPerkIds = m => { const l = driverLevel(m?.xp); return DRIVER_PERKS.filter(p => p.level <= l).map(p => p.id); };

// ---------- Regional weather ----------
// Real weather only where it actually happens: each game day a deterministic
// hash picks 3–5 zones from a plausibility catalog (snow in the Himalayas &
// Siberia, dust storms over the Thar/Gulf deserts, monsoon rain on the
// coasts). Routes passing through an active zone drive slower.
export const WEATHER_KINDS = {
  rain: { label: 'Rain', color: '#2563EB', slow: 0.92, icon: 'weather-rainy' },
  heavyrain: { label: 'Heavy Rain', color: '#1D4ED8', slow: 0.8, icon: 'weather-pouring' },
  storm: { label: 'Thunderstorm', color: '#7C3AED', slow: 0.75, icon: 'weather-lightning-rainy' },
  dust: { label: 'Dust Storm', color: '#B45309', slow: 0.8, icon: 'weather-windy' },
  snow: { label: 'Snowfall', color: '#0891B2', slow: 0.7, icon: 'weather-snowy-heavy' },
  fog: { label: 'Dense Fog', color: '#64748B', slow: 0.85, icon: 'weather-fog' },
};
const WEATHER_REGIONS = [
  { name: 'Kashmir Valley', lat: 34.1, lng: 74.8, kinds: ['snow', 'fog'] },
  { name: 'Himachal Hills', lat: 31.9, lng: 77.1, kinds: ['snow', 'rain', 'fog'] },
  { name: 'Ladakh Plateau', lat: 34.2, lng: 77.6, kinds: ['snow'] },
  { name: 'Konkan Coast', lat: 17.0, lng: 73.5, kinds: ['rain', 'heavyrain', 'storm'] },
  { name: 'Kerala Coast', lat: 9.9, lng: 76.4, kinds: ['heavyrain', 'storm', 'rain'] },
  { name: 'Thar Desert', lat: 26.9, lng: 71.5, kinds: ['dust'] },
  { name: 'Gangetic Plain', lat: 26.5, lng: 82.0, kinds: ['fog', 'rain'] },
  { name: 'Bengal Delta', lat: 22.8, lng: 89.5, kinds: ['heavyrain', 'storm'] },
  { name: 'Northeast Hills', lat: 25.6, lng: 93.0, kinds: ['rain', 'fog', 'heavyrain'] },
  { name: 'Nepal Himalaya', lat: 28.2, lng: 84.5, kinds: ['snow', 'rain'] },
  { name: 'Bhutan Highlands', lat: 27.5, lng: 90.4, kinds: ['snow', 'rain', 'fog'] },
  { name: 'Sri Lanka Wet Zone', lat: 6.9, lng: 80.4, kinds: ['rain', 'storm'] },
  { name: 'Myanmar Coast', lat: 16.5, lng: 96.5, kinds: ['heavyrain', 'storm'] },
  { name: 'Malay Peninsula', lat: 3.5, lng: 102.0, kinds: ['heavyrain', 'storm', 'rain'] },
  { name: 'Balochistan Desert', lat: 27.5, lng: 65.5, kinds: ['dust'] },
  { name: 'Persian Desert', lat: 32.5, lng: 55.5, kinds: ['dust'] },
  { name: 'Arabian Desert', lat: 24.2, lng: 54.7, kinds: ['dust'] },
  { name: 'Tibetan Plateau', lat: 30.5, lng: 90.0, kinds: ['snow', 'fog'] },
  { name: 'Yunnan Highlands', lat: 25.5, lng: 101.5, kinds: ['rain', 'fog'] },
  { name: 'Siberian Taiga', lat: 55.5, lng: 90.0, kinds: ['snow', 'fog'] },
  { name: 'Russian Plain', lat: 55.5, lng: 40.0, kinds: ['snow', 'fog', 'rain'] },
  { name: 'Urals', lat: 56.5, lng: 60.5, kinds: ['snow'] },
];
export function generateWeather(day) {
  let h = ((day + 7) * 2654435761) >>> 0; h = (h ^ (h >>> 15)) >>> 0;
  const count = 4 + (h % 4); // 4–7 active zones
  const zones = [];
  const used = new Set();
  for (let i = 0; i < count * 3 && zones.length < count; i++) {
    const idx = (((h >>> (i * 3)) + i * 131) >>> 0) % WEATHER_REGIONS.length;
    if (used.has(idx)) continue;
    used.add(idx);
    const r = WEATHER_REGIONS[idx];
    const kind = r.kinds[(((h >>> (i * 2)) + i) >>> 0) % r.kinds.length];
    // Organic blob, not a circle: the boundary radius varies with the angle
    // through 2 random harmonics — every zone gets its own irregular
    // state-boundary-like curve, deterministic per day+region.
    zones.push({
      id: `w-${day}-${idx}`, kind, name: r.name, lat: r.lat, lng: r.lng,
      radiusKm: 130 + ((h >>> (i + 4)) % 130), day,
      shape: {
        a1: 0.28 + ((h >>> (i + 7)) % 27) / 100,               // 0.28–0.54: big asymmetric lobes
        p1: (((h >>> (i + 11)) % 360) * Math.PI) / 180,
        k1: 2 + ((h >>> (i + 3)) % 2),                          // 2–3 lobes
        a2: 0.12 + ((h >>> (i + 13)) % 16) / 100,               // mid ripple
        p2: (((h >>> (i + 17)) % 360) * Math.PI) / 180,
        k2: 5 + ((h >>> (i + 5)) % 3),                          // 5–7 ripples
        a3: 0.05 + ((h >>> (i + 19)) % 8) / 100,                // fine jagged edge
        p3: (((h >>> (i + 23)) % 360) * Math.PI) / 180,
        k3: 9 + ((h >>> (i + 9)) % 5),                          // 9–13 jags
      },
    });
  }
  return zones;
}
// Boundary radius (km) of a weather blob at a given bearing from its centre.
export function weatherRadiusAt(z, ang) {
  const sh = z.shape;
  if (!sh) return z.radiusKm; // old saves: plain circle (regenerated on load anyway)
  return z.radiusKm * Math.max(0.3,
    1 + sh.a1 * Math.sin(sh.k1 * ang + sh.p1)
      + sh.a2 * Math.sin(sh.k2 * ang + sh.p2)
      + (sh.a3 || 0) * Math.sin((sh.k3 || 11) * ang + (sh.p3 || 0)));
}
// Blob outline as lat/lng points (for drawing on the map).
export function weatherPolygon(z, n = 64) {
  const out = [];
  const kLat = 111, kLng = 111 * Math.cos((z.lat * Math.PI) / 180);
  // Deterministic per-vertex jitter (hash of zone id + vertex index): breaks
  // the smooth sine curve into an irregular hand-drawn border like a real
  // state boundary. Same seed every render, so the outline never wobbles.
  let zh = 0; for (let c = 0; c < z.id.length; c++) zh = (zh * 31 + z.id.charCodeAt(c)) >>> 0;
  for (let i = 0; i <= n; i++) {
    const ang = (i / n) * 2 * Math.PI;
    const wrap = i % n; // last vertex must equal the first — closed border
    const jit = 1 + ((((zh >>> (wrap % 20)) + wrap * 2654435761) >>> 0) % 17 - 8) / 100; // ±8%
    const r = weatherRadiusAt(z, ang) * jit;
    out.push({ lat: z.lat + (r / kLat) * Math.sin(ang), lng: z.lng + (r / kLng) * Math.cos(ang) });
  }
  return out;
}
const degKm = (a, b) => { // fast approximate distance in km
  const dLat = (a.lat - b.lat) * 111;
  const dLng = (a.lng - b.lng) * 111 * Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
};
// Worst (slowest) weather zone a route passes through; 1 = clear skies.
// Uses the zone's ACTUAL irregular boundary (weatherRadiusAt), so what the
// player sees on the map is exactly what slows the truck — no invisible math.
export function weatherOnRoute(points, zones) {
  if (!zones?.length || !points?.length) return { factor: 1, hits: [] };
  let factor = 1; const hits = [];
  const step = Math.max(1, Math.floor(points.length / 60));
  for (const z of zones) {
    const k = WEATHER_KINDS[z.kind]; if (!k) continue;
    const kLat = 111, kLng = 111 * Math.cos((z.lat * Math.PI) / 180);
    for (let i = 0; i < points.length; i += step) {
      const dy = (points[i].lat - z.lat) * kLat, dx = (points[i].lng - z.lng) * kLng;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= weatherRadiusAt(z, Math.atan2(dy, dx))) { if (k.slow < factor) factor = k.slow; hits.push(z); break; }
    }
  }
  return { factor, hits };
}

// ---------- Company level ----------
export const COMPANY_TITLES = [
  'Street Hauler', 'Local Carrier', 'City Mover', 'District Star', 'State Champion',
  'Regional Power', 'National Carrier', 'Highway King', 'Border Baron',
  'Continental Titan', 'Logistics Legend', 'Transport Emperor',
];
export function companyXP(s) {
  return Math.floor((s.stats.revenue || 0) / 50000 + (s.stats.deliveries || 0) * 40
    + (s.stats.km || 0) / 20 + (s.hubs || []).length * 500 + (s.trucks || []).length * 300);
}
export const companyLevelOf = xp => Math.floor(Math.sqrt(xp / 1000));
export const companyXpForLevel = l => l * l * 1000;
export const companyTitleOf = l => COMPANY_TITLES[Math.min(l, COMPANY_TITLES.length - 1)];

// ---------- Weekly challenges ----------
// 5 challenges per real ISO week, deterministic from the week id. Progress is
// measured against a stats snapshot taken when the week starts, each claim
// pays gold + cash, and clearing all of them pays a big jackpot on top.
const WEEKLY_POOL = [
  { key: 'deliveries', icon: 'package-variant-closed-check', label: n => `Complete ${n} deliveries`, targets: [8, 15, 25], gold: 20, cash: 500000 },
  { key: 'km', icon: 'highway', label: n => `Drive ${n.toLocaleString('en-IN')} km`, targets: [3000, 6000, 12000], gold: 20, cash: 500000 },
  { key: 'contracts', icon: 'file-sign', label: n => `Finish ${n} contracts`, targets: [3, 6, 10], gold: 25, cash: 600000 },
  { key: 'borders', icon: 'passport', label: n => `Cross ${n} border${n > 1 ? 's' : ''}`, targets: [1, 3, 6], gold: 30, cash: 800000 },
  { key: 'gamesPlayed', icon: 'dice-multiple', label: n => `Play ${n} mini-games`, targets: [10, 20, 30], gold: 15, cash: 300000 },
  { key: 'revenue', icon: 'cash-multiple', label: n => `Earn ${inr(n)} revenue`, targets: [2000000, 5000000, 12000000], gold: 25, cash: 700000 },
  { key: 'campaigns', icon: 'bullhorn-variant', label: n => `Launch ${n} marketing campaign${n > 1 ? 's' : ''}`, targets: [1, 2, 4], gold: 18, cash: 400000 },
  { key: 'promotions', icon: 'account-arrow-up', label: n => `Promote ${n} staff member${n > 1 ? 's' : ''}`, targets: [1, 2, 3], gold: 18, cash: 400000 },
];
export const WEEKLY_JACKPOT = { gold: 100, cash: 2500000 };
export const WEEKLY_CHALLENGE_COUNT = 5;
function isoWeekId(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dayNum + 3);
  const firstThu = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((t - firstThu) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return `${t.getUTCFullYear()}-W${week}`;
}
function pickChallenges(seedId, pool, count, statKeys, stats) {
  let h = 0; for (let i = 0; i < seedId.length; i++) h = (h * 31 + seedId.charCodeAt(i)) >>> 0;
  const picks = []; const used = new Set();
  for (let i = 0; picks.length < count && i < pool.length * 3; i++) {
    // Unsigned shifts only — a signed >> on a large hash goes negative and a
    // negative index here crashed the game on open (v2.4.0 hotfix).
    const idx = (((h >>> (i * 2)) + i * 7) >>> 0) % pool.length;
    if (used.has(idx)) continue; used.add(idx);
    const p = pool[idx];
    const target = p.targets[(h >>> (i + 5)) % 3];
    picks.push({ key: p.key, icon: p.icon, label: p.label(target), target, gold: p.gold, cash: p.cash });
  }
  const snap = {};
  statKeys.forEach(k => { snap[k] = Math.floor(stats[k] || 0); });
  return { challenges: picks, snapshot: snap };
}
const WEEKLY_STAT_KEYS = ['deliveries', 'km', 'contracts', 'borders', 'gamesPlayed', 'revenue', 'campaigns', 'promotions'];
export function buildWeekly(weekId, stats) {
  const { challenges, snapshot } = pickChallenges(weekId, WEEKLY_POOL, WEEKLY_CHALLENGE_COUNT, WEEKLY_STAT_KEYS, stats);
  return { id: weekId, challenges, snapshot, claimed: [], jackpotPaid: false };
}

// ---------- Daily challenges ----------
// 3 lighter-weight challenges that reset every real calendar day — same
// mechanics as weekly (snapshot progress, per-task claim, sweep jackpot),
// smaller targets and payouts since they're meant to clear same-day.
const DAILY_POOL = [
  { key: 'deliveries', icon: 'package-variant-closed-check', label: n => `Complete ${n} deliver${n > 1 ? 'ies' : 'y'}`, targets: [2, 3, 5], gold: 5, cash: 100000 },
  { key: 'km', icon: 'highway', label: n => `Drive ${n.toLocaleString('en-IN')} km`, targets: [500, 1000, 2000], gold: 5, cash: 100000 },
  { key: 'contracts', icon: 'file-sign', label: n => `Finish ${n} contract${n > 1 ? 's' : ''}`, targets: [1, 2, 3], gold: 6, cash: 120000 },
  { key: 'gamesPlayed', icon: 'dice-multiple', label: n => `Play ${n} mini-game${n > 1 ? 's' : ''}`, targets: [3, 5, 8], gold: 4, cash: 80000 },
  { key: 'revenue', icon: 'cash-multiple', label: n => `Earn ${inr(n)} revenue`, targets: [300000, 700000, 1500000], gold: 6, cash: 150000 },
];
export const DAILY_JACKPOT = { gold: 20, cash: 400000 };
export const DAILY_CHALLENGE_COUNT = 3;
const DAILY_STAT_KEYS = ['deliveries', 'km', 'contracts', 'gamesPlayed', 'revenue'];
function dailyDateId(d = new Date()) { return d.toDateString(); }
export function buildDaily(dayId, stats) {
  const { challenges, snapshot } = pickChallenges(dayId, DAILY_POOL, DAILY_CHALLENGE_COUNT, DAILY_STAT_KEYS, stats);
  return { id: dayId, challenges, snapshot, claimed: [], jackpotPaid: false };
}

// ---------- 30-day login streak calendar (v3.0.0) ----------
// Every day of the streak has its OWN reward — gold, cash, boosts, shields —
// escalating to a day-30 mega chest. After day 30 the calendar repeats its
// last week. Types: gold | cash | speed (1h 2×) | shield (24h) | double (2× next).
export const STREAK_REWARDS = [
  { day: 1, type: 'gold', amount: 2, icon: 'gold', label: '+2 Gold' },
  { day: 2, type: 'gold', amount: 4, icon: 'gold', label: '+4 Gold' },
  { day: 3, type: 'cash', amount: 200000, icon: 'cash', label: '₹2L Cash' },
  { day: 4, type: 'gold', amount: 6, icon: 'gold', label: '+6 Gold' },
  { day: 5, type: 'speed', icon: 'fast-forward', label: '2× Speed 1h' },
  { day: 6, type: 'gold', amount: 8, icon: 'gold', label: '+8 Gold' },
  { day: 7, type: 'cash', amount: 500000, icon: 'cash-multiple', label: '₹5L Cash' },
  { day: 8, type: 'gold', amount: 8, icon: 'gold', label: '+8 Gold' },
  { day: 9, type: 'gold', amount: 10, icon: 'gold', label: '+10 Gold' },
  { day: 10, type: 'shield', icon: 'shield-check', label: 'Shield 24h' },
  { day: 11, type: 'cash', amount: 800000, icon: 'cash-multiple', label: '₹8L Cash' },
  { day: 12, type: 'gold', amount: 12, icon: 'gold', label: '+12 Gold' },
  { day: 13, type: 'gold', amount: 12, icon: 'gold', label: '+12 Gold' },
  { day: 14, type: 'double', icon: 'chevron-double-up', label: '2× Next Trip' },
  { day: 15, type: 'cash', amount: 1200000, icon: 'cash-multiple', label: '₹12L Cash' },
  { day: 16, type: 'gold', amount: 15, icon: 'gold', label: '+15 Gold' },
  { day: 17, type: 'gold', amount: 15, icon: 'gold', label: '+15 Gold' },
  { day: 18, type: 'speed', icon: 'fast-forward', label: '2× Speed 1h' },
  { day: 19, type: 'cash', amount: 1500000, icon: 'cash-multiple', label: '₹15L Cash' },
  { day: 20, type: 'gold', amount: 20, icon: 'gold', label: '+20 Gold' },
  { day: 21, type: 'shield', icon: 'shield-check', label: 'Shield 24h' },
  { day: 22, type: 'gold', amount: 20, icon: 'gold', label: '+20 Gold' },
  { day: 23, type: 'cash', amount: 2000000, icon: 'cash-multiple', label: '₹20L Cash' },
  { day: 24, type: 'gold', amount: 25, icon: 'gold', label: '+25 Gold' },
  { day: 25, type: 'double', icon: 'chevron-double-up', label: '2× Next Trip' },
  { day: 26, type: 'gold', amount: 30, icon: 'gold', label: '+30 Gold' },
  { day: 27, type: 'cash', amount: 3000000, icon: 'cash-multiple', label: '₹30L Cash' },
  { day: 28, type: 'shield', icon: 'shield-check', label: 'Shield 24h' },
  { day: 29, type: 'gold', amount: 40, icon: 'gold', label: '+40 Gold' },
  { day: 30, type: 'mega', gold: 50, cash: 5000000, icon: 'treasure-chest', label: 'MEGA: +50G + ₹50L' },
];
export const streakRewardFor = streak =>
  STREAK_REWARDS[Math.min(Math.max(streak, 1), 30) - 1]
  || STREAK_REWARDS[23 + ((streak - 24) % 7)]; // past 30: repeat the last week

// Hidden gems — tap a specific existing UI element a set number of times in a
// row (within a short window) to find one, once ever, for a big one-time
// reward. `hint` stays vague and is all the player sees until it's found;
// `where` is only shown after discovery, for the Settings checklist.
export const EASTER_EGGS = [
  { id: 'hq_home', title: 'Home Sweet Home', hint: 'Somewhere on the map, home is where the heart is...', where: 'Open your HQ on the map and tap the building icon in its modal 5 times fast.' },
  { id: 'kalavad_roots', title: 'Gujarat Roots', hint: 'A small town holds a big secret.', where: 'Search "Kalavad" in New Delivery and tap the result 3 times fast.' },
  { id: 'mirror_mirror', title: 'Mirror Mirror', hint: 'Vanity has its rewards.', where: 'Tap your own CEO avatar in Settings → Profile 5 times fast.' },
  { id: 'branded', title: 'Branded', hint: 'Your logo is worth more than you think.', where: 'Tap your own company logo in Settings → Company 4 times fast.' },
  { id: 'midas_touch', title: 'Midas Touch', hint: 'Some numbers are luckier than others.', where: 'Tap your Gold total in the Mini-Games screen 7 times fast.' },
  { id: 'version_detective', title: 'Version Detective', hint: 'Read the fine print closely enough.', where: 'Tap the "Installed vX.X" pill in Settings → About 6 times fast.' },
  { id: 'window_shopper', title: 'Window Shopper', hint: 'Looking at everything, buying nothing.', where: 'Tap the "All" filter in the Truck Showroom 8 times fast.' },
  { id: 'curious_mind', title: 'Curious Mind', hint: 'Curiosity about yourself pays off.', where: 'Tap the "About" tab in Settings 5 times fast.' },
  { id: 'steady_hands', title: 'Steady Hands', hint: 'Balance in all things.', where: 'Tap "Normal" difficulty in Settings → Gameplay 4 times fast.' },
  { id: 'not_a_bug', title: 'Not a Bug, a Feature', hint: 'The mascot has a sense of humour.', where: 'Tap the truck logo on the splash screen 10 times fast.' },
  { id: 'nice_try', title: 'Nice Try', hint: 'Reading the warning label a little too closely.', where: 'Tap the Danger Zone warning text in Settings → Gameplay 6 times fast (doesn’t actually reset anything).' },
  { id: 'port_master', title: 'Harbour Master', hint: 'The sea rewards those who keep checking the docks.', where: 'Tap the anchor (ports) button on the map 6 times fast.' },
  { id: 'fuel_sniffer', title: 'Fuel Sniffer', hint: 'Always hunting for the cheapest litre.', where: 'Tap the fuel-station toggle on the map 7 times fast.' },
  { id: 'inbox_zero', title: 'Inbox Zero', hint: 'Obsessed with a clean inbox.', where: 'Tap "Mark all read" in Notifications 5 times fast.' },
  { id: 'money_gazer', title: 'Money Gazer', hint: 'Staring at your balance won’t grow it... or will it?', where: 'Tap your cash balance in the top header 6 times fast.' },
  { id: 'number_cruncher', title: 'Number Cruncher', hint: 'Some people really love spreadsheets.', where: 'Tap the "Economy" tab in the bottom bar 7 times fast.' },
  { id: 'speed_demon', title: 'Speed Demon', hint: 'Life in the fast lane, always.', where: 'Tap "Very Fast" game speed in Settings → Gameplay 5 times fast.' },
  { id: 'meet_the_maker', title: 'Meet the Maker', hint: 'Say hello to the person behind the wheel of the code.', where: 'Tap the Lead Developer card in Settings → About 7 times fast.' },
  { id: 'hello_claude', title: 'Hello, Claude', hint: 'Someone else never clocked off building this.', where: 'Tap the Claude card in Settings → About 9 times fast.' },
  // v2.3.0 — the tough five. High tap counts, obscure corners: these are meant
  // to survive weeks of hunting.
  { id: 'ghost_rider', title: 'Ghost Rider', hint: 'Only night owls notice the sky change.', where: 'Tap the day/night weather icon in the top header 9 times fast.' },
  { id: 'gold_digger', title: 'Gold Digger', hint: 'Some wallets have false bottoms.', where: 'Tap the Gold Wallet chip in the Power-Ups store 10 times fast.' },
  { id: 'long_hauler', title: 'Long Hauler', hint: 'Obsessed with the odometer, ten times over.', where: 'Tap the Distance stat in the Economy tab 10 times fast.' },
  { id: 'ledger_lord', title: 'Ledger Lord', hint: 'A true auditor checks the books twelve times.', where: 'Tap the Company Ledger header icon 12 times fast.' },
  { id: 'streak_freak', title: 'Streak Freak', hint: 'Worship the daily flame, eleven-fold.', where: 'Tap the streak flame in the Rewards tab 11 times fast.' },
  // v10.9.0 — a few final ones, including one for the other half of the team.
  { id: 'meet_jeel', title: 'Meet Jeel', hint: 'The other half of the team deserves a knock too.', where: 'Tap the Jeel Gajera developer card in Settings → About 8 times fast.' },
  { id: 'donor', title: 'Big Heart', hint: 'Giving it all away, one tap at a time.', where: 'Tap the Charity Drive icon in the Bank sheet 5 times fast.' },
];
const EASTER_EGG_REWARD = { cash: 1000000, gold: 15 }; // ₹10 lakhs + 15 Gold, per egg, one-time

// ---------- Achievements (Steam-style, 5 tiers per track) ----------
// Every track is measured from state that already exists — nothing new to
// count. Each of the 5 tiers pays a one-time gold reward when first reached
// (checked by syncAchievements, which the 1s game loop already drives).
export const ACHIEVEMENT_TIERS = ['Beginner', 'Amateur', 'Professional', 'Expert', 'Legend'];
export const ACHIEVEMENT_TIER_GOLD = [5, 10, 20, 40, 80];
export const ACHIEVEMENTS = [
  { id: 'road_warrior', title: 'Road Warrior', icon: 'highway', unit: 'km',
    desc: 'Total kilometres your fleet has driven.', levels: [500, 2500, 10000, 50000, 250000] },
  { id: 'delivery_master', title: 'Delivery Master', icon: 'package-variant-closed-check', unit: 'deliveries',
    desc: 'Deliveries completed across the whole company.', levels: [5, 25, 100, 500, 2000] },
  { id: 'freight_fortune', title: 'Freight Fortune', icon: 'cash-multiple', unit: '₹',
    desc: 'Lifetime freight revenue earned.', levels: [1000000, 10000000, 50000000, 250000000, 1000000000] },
  { id: 'fleet_collector', title: 'Fleet Collector', icon: 'truck', unit: 'trucks',
    desc: 'Trucks owned at the same time.', levels: [2, 5, 10, 20, 40] },
  { id: 'dream_team', title: 'Dream Team', icon: 'account-group', unit: 'staff',
    desc: 'People on your payroll.', levels: [2, 5, 10, 20, 35] },
  { id: 'garage_mogul', title: 'Garage Mogul', icon: 'garage', unit: 'hubs',
    desc: 'Garages & hubs owned (HQ counts).', levels: [2, 4, 7, 12, 18] },
  { id: 'globe_trotter', title: 'Globe Trotter', icon: 'earth', unit: 'countries',
    desc: 'Countries unlocked for delivery.', levels: [2, 3, 4, 5, 6] },
  { id: 'gem_hunter', title: 'Gem Hunter', icon: 'diamond-stone', unit: 'gems',
    desc: 'Hidden easter eggs discovered.', levels: [1, 4, 9, 15, 23] },
  { id: 'gold_reserve', title: 'Gold Reserve', icon: 'gold', unit: 'gold',
    desc: 'Gold held in the vault at once.', levels: [150, 300, 600, 1200, 2500] },
  // The funny ones — badges of honour nobody exactly *wants* to earn.
  { id: 'crash_test_star', title: 'Crash Test Star', icon: 'car-brake-alert', unit: 'incidents',
    desc: 'Road incidents survived. Your insurance agent knows you by first name.', levels: [1, 5, 15, 40, 100] },
  { id: 'bandit_magnet', title: 'Bandit Magnet', icon: 'shield-alert', unit: 'thefts',
    desc: 'Cargo thefts endured. The bandits send you Diwali cards now.', levels: [1, 3, 8, 20, 50] },
  { id: 'fuel_baron', title: 'Fuel Baron', icon: 'gas-station', unit: '₹',
    desc: 'Money burned at the pump. The petrol bunk named a chair after you.', levels: [100000, 1000000, 5000000, 25000000, 100000000] },
  { id: 'sea_legs', title: 'Sea Legs', icon: 'ferry', unit: 'ferries',
    desc: 'Ferries boarded. Your trucks secretly wanted to be boats.', levels: [1, 5, 15, 40, 100] },
  { id: 'passport_stamps', title: 'Passport Stamps', icon: 'passport', unit: 'borders',
    desc: 'Borders crossed. Customs officers wave like old friends.', levels: [1, 5, 15, 40, 100] },
  // v2.3.0 — ten fresh tracks, all fed by counters the store already bumps.
  { id: 'contract_king', title: 'Contract King', icon: 'file-sign', unit: 'contracts',
    desc: 'Contracts completed for clients on the board.', levels: [1, 10, 40, 150, 500] },
  { id: 'campaign_guru', title: 'Campaign Guru', icon: 'bullhorn-variant', unit: 'campaigns',
    desc: 'Marketing campaigns launched.', levels: [1, 5, 15, 40, 100] },
  { id: 'people_person', title: 'People Person', icon: 'account-arrow-up', unit: 'promotions',
    desc: 'Staff promotions handed out. HR loves you.', levels: [1, 3, 8, 20, 50] },
  { id: 'teleporter', title: 'Teleporter', icon: 'transfer', unit: 'transfers',
    desc: 'Fast-travels between your garages.', levels: [1, 5, 20, 60, 150] },
  { id: 'lucky_streak', title: 'Lucky Streak', icon: 'dice-multiple', unit: 'plays',
    desc: 'Mini-games played. The house always wins... or does it?', levels: [5, 25, 100, 400, 1000] },
  { id: 'network_weaver', title: 'Network Weaver', icon: 'map-marker-path', unit: 'routes',
    desc: 'Unique routes lit up on the map.', levels: [3, 10, 30, 80, 200] },
  { id: 'cash_hoarder', title: 'Cash Hoarder', icon: 'safe', unit: '₹',
    desc: 'Cash balance held at one time.', levels: [10000000, 50000000, 200000000, 500000000, 2000000000] },
  { id: 'mechanic_bff', title: "Mechanic's BFF", icon: 'wrench-clock', unit: 'call-outs',
    desc: 'Roadside mechanic call-outs paid for.', levels: [1, 5, 15, 40, 100] },
  { id: 'daily_devotee', title: 'Daily Devotee', icon: 'calendar-star', unit: 'days',
    desc: 'Best daily-login streak reached.', levels: [3, 7, 14, 30, 90] },
  { id: 'big_spender', title: 'Big Spender', icon: 'gold', unit: 'gold',
    desc: 'Gold spent on power-ups and repairs.', levels: [25, 100, 400, 1200, 4000] },
  // v10.9.0 — tracks fed by collateral loans / Charity Drive.
  { id: 'philanthropist', title: 'Philanthropist', icon: 'hand-heart', unit: '₹',
    desc: 'Cash donated through the Charity Drive, lifetime.', levels: [100000, 1000000, 10000000, 50000000, 200000000] },
  { id: 'collateral_king', title: 'Collateral King', icon: 'bank', unit: 'loans',
    desc: 'Collateral-backed loans taken out, lifetime.', levels: [1, 3, 6, 12, 25] },
  { id: 'trendsetter', title: 'Trendsetter', icon: 'palette', unit: 'repaints',
    desc: 'Trucks repainted with a custom livery, lifetime.', levels: [1, 5, 15, 40, 100] },
];
// Current metric value for a track, computed from live state.
export function achievementValue(s, id) {
  switch (id) {
    case 'road_warrior': return Math.floor(s.stats.km);
    case 'delivery_master': return s.stats.deliveries;
    case 'freight_fortune': return Math.floor(s.stats.revenue);
    case 'fleet_collector': return s.trucks.length;
    case 'dream_team': return s.staff.length;
    case 'garage_mogul': return (s.hubs || []).length;
    case 'globe_trotter': return (s.unlockedCountries || ['IN']).length;
    case 'gem_hunter': return (s.easterEggs?.found || []).length;
    case 'gold_reserve': return s.gold;
    case 'crash_test_star': return s.stats.incidents || 0;
    case 'bandit_magnet': return s.stats.thefts || 0;
    case 'fuel_baron': return Math.floor(s.stats.fuelSpend || 0);
    case 'sea_legs': return s.stats.ferries || 0;
    case 'passport_stamps': return s.stats.borders || 0;
    case 'contract_king': return s.stats.contracts || 0;
    case 'campaign_guru': return s.stats.campaigns || 0;
    case 'people_person': return s.stats.promotions || 0;
    case 'teleporter': return s.stats.fastTravels || 0;
    case 'lucky_streak': return s.stats.gamesPlayed || 0;
    case 'network_weaver': return (s.corridors || []).length;
    case 'cash_hoarder': return Math.max(0, Math.floor(s.balance));
    case 'mechanic_bff': return s.stats.mechanicCalls || 0;
    case 'daily_devotee': return Math.max(s.login?.bestStreak || 0, s.login?.streak || 0);
    case 'big_spender': return s.stats.goldSpent || 0;
    case 'philanthropist': return s.stats.donated || 0;
    case 'collateral_king': return s.stats.loansTaken || 0;
    case 'trendsetter': return s.stats.repaints || 0;
    default: return 0;
  }
}

function randomContracts(dayNumber, count = CONTRACTS_PER_DAY) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const flavor = CONTRACT_FLAVORS[Math.floor(Math.random() * CONTRACT_FLAVORS.length)];
    const pool = flavor.id === 'longhaul' ? CITIES.filter(c => c.tier === 1)
      : flavor.id === 'island' ? CITIES.filter(c => c.state.includes('Andaman') || c.state === 'Lakshadweep')
        : CITIES.filter(c => c.tier <= 2);
    const dest = pool[Math.floor(Math.random() * pool.length)];
    // Small last-mile loads (1–5 t) that suit the mini/light trucks the player
    // actually owns; bulk/mining flavours skew a little heavier.
    const heavy = flavor.id === 'bulk' || flavor.id === 'mining';
    const cargoTons = 1 + Math.floor(Math.random() * (heavy ? 6 : 4)) + (heavy ? 2 : 0);
    const expiresAt = Date.now() + (4 + Math.random() * 8) * 3600 * 1000;
    out.push({
      id: uid('c'), flavorId: flavor.id, day: dayNumber,
      destCityId: dest.id, cargoTons, cargoType: FLAVOR_CARGO[flavor.id] || 'general', mult: flavor.mult,
      expiresAt, status: 'available', deliveryId: null, rewardPaid: 0,
    });
  }
  return out;
}

function randomCandidates() {
  const out = [];
  for (let i = 0; i < 8; i++) {
    // Managers are disabled for now (no gameplay effect yet) — re-add 'manager'
    // to this pool when a real use for them lands.
    // const role = ['driver', 'mechanic', 'manager'][Math.floor(Math.random() * 3)];
    const role = ['driver', 'mechanic'][Math.floor(Math.random() * 2)];
    const level = STAFF_LEVELS[Math.floor(Math.random() * 3)];
    const gender = Math.random() < 0.65 ? 'm' : 'f';
    const names = STAFF_NAMES[gender];
    const name = names[Math.floor(Math.random() * names.length)];
    const salary = Math.round((level.salary[0] + Math.random() * (level.salary[1] - level.salary[0])) / 500) * 500;
    const skill = Math.round(level.skill[0] + Math.random() * (level.skill[1] - level.skill[0]));
    out.push({ id: uid('cand'), name, gender, role, level: level.id, salary, skill, bonus: salary * 2 });
  }
  return out;
}

// One free starter driver so the player can dispatch immediately.
function starterDriver() {
  const gender = Math.random() < 0.6 ? 'm' : 'f';
  const names = STAFF_NAMES[gender];
  return {
    id: uid('staff'), name: names[Math.floor(Math.random() * names.length)], gender,
    role: 'driver', level: 'junior', salary: 22000, skill: 35, bonus: 0,
    hiredAt: Date.now(), truckId: null,
  };
}

const initialState = {
  phase: 'splash', // splash | onboarding | game
  company: null, // {name, ceo, logo, avatar, hqCityId, code, createdAt}
  balance: 0,
  gold: 0,
  games: { day: 0, scratchUsed: 0, spinUsed: 0, diceUsed: 0, slotUsed: 0 }, // daily free gold mini-games
  trucks: [], // {id, modelId, status, lat, lng, cityId, fuelPct, buildEndsAt, buildTotalSec, km, deliveries, driverId, brokenSince, condition}
  deliveries: [], // active: {id, truckId, fromCityId, toCityId, cargoType, cargoTons, route:{points,cum,roadKm,usesFerry,ferrySegment}, stops, startedAt, endsAt, econ, contractId, incident:{type,startedAt,resolveAt,penalty,mechanicCalled}|null}
  history: [], // completed deliveries (most recent first, capped)
  staff: [],
  candidates: [],
  hubs: [], // {cityId, name, hq, since} — HQ + purchased garages/hubs
  corridors: [], // {id, fromCityId, toCityId, points} — unlocked/highlighted routes
  contracts: [],
  unlockedCountries: ['IN'], // v1.4.0: neighbouring countries unlock in-game
  campaigns: [], // {id, campaignId, startedAt, endsAt}
  notifications: [],
  boosts: { speedUntil: 0, doubleNext: false },
  stats: {
    revenue: 0, fuelSpend: 0, deliveries: 0, km: 0, incidents: 0, thefts: 0, ferries: 0, borders: 0,
    contracts: 0, campaigns: 0, promotions: 0, fastTravels: 0, gamesPlayed: 0, mechanicCalls: 0, goldSpent: 0,
    repaints: 0,
  },
  ledger: [], // day-wise money book: {id, ts, day, kind, icon, label, amount} — newest first, capped
  loans: [], // active bank loans: {id, productId, name, principal, remaining, emi, months, paidMonths, lastEmiDay}
  credit: { paid: 0, missed: 0 }, // EMI track record → credit score
  weather: [], // today's active weather zones (regenerated each game day)
  weatherDay: 0,
  lastWeatherEvolveAt: 0, // real ms of the last gentle weather-evolution step
  lastCompanyLevel: 0, // last company level a reward was paid for
  weekly: null, // this week's challenges {id, challenges, snapshot, claimed, jackpotPaid}
  daily: null, // today's challenges {id, challenges, snapshot, claimed, jackpotPaid}
  updateGiftVersion: '', // last update-welcome-gift version already granted
  clockStart: 0, // real ms when day 1 hour 0 began
  lastSalaryDay: 0,
  lastContractDay: 0,
  nextContractAt: 0, // real ms of the next 2–4h contract-board refresh
  lastEventAt: 0, // real ms of the last random-event roll
  lastIncidentAt: 0, // real ms of the last delivery-incident roll
  mapEvents: [], // recent world events with a location, highlighted on the map
  pricing: {}, // per-cargo ₹/km/t overrides; empty => each cargo uses its own default rate
  settings: {
    speed: 1, autosave: true, sound: true, haptics: true, showStations: true, showPorts: true,
    difficulty: 'normal', events: 'rare', tutorialSeen: false,
    musicVolume: 0.4, sfxVolume: 1, hapticIntensity: 'medium',
    finaleSeen: false, finaleModalShown: false, // Grand Finale gift + celebration screen, each one-time-ever
    stockRemovalGiftClaimed: false, // one-time thank-you gift for the Stock Market's removal
    notif: { delivery: true, truck: true, fuel: true, daily: true },
  },
  easterEggs: { found: [] }, // ids of discovered hidden gems (persisted, one-time rewards)
  achievements: { unlocked: {} }, // {"road_warrior:2": ts} — track:tierIndex reached (persisted)
  lastBackupAt: 0, // real ms of the last rolling auto-backup
  login: { lastDay: '', streak: 0, bestStreak: 0 }, // daily login gold streak (real calendar days)
};

export const useGame = create(
  persist(
    (set, get) => ({
      ...initialState,

      // ---------- helpers ----------
      // Company ledger — every rupee in or out gets a day-stamped book entry.
      // `amount` is signed (+income / -expense). Capped so old saves stay light.
      logLedger(kind, icon, label, amount) {
        if (!amount) return;
        const { day } = get().gameDay();
        set({
          ledger: [{ id: uid('lg'), ts: Date.now(), day, kind, icon, label, amount: Math.round(amount) },
          ...(get().ledger || [])].slice(0, 300),
        });
      },

      notify(type, icon, message) {
        const s = get();
        const cat = { delivery: 'delivery', truck: 'truck', system: 'daily' }[type] || 'daily';
        if (s.settings.notif[cat] === false) return;
        set({ notifications: [makeNotification(type, icon, message), ...s.notifications].slice(0, 120) });
      },

      gameDay() {
        const s = get();
        if (!s.clockStart) return { day: 1, hour: 8 };
        const hours = Math.floor((Date.now() - s.clockStart) / (GAME_HOUR_MS / s.settings.speed));
        return { day: Math.floor(hours / 24) + 1, hour: hours % 24 };
      },

      marketingBoost() {
        const s = get();
        const now = Date.now();
        let best = 0;
        for (const a of s.campaigns) {
          if (a.endsAt > now) {
            const def = CAMPAIGNS.find(c => c.id === a.campaignId);
            if (def && def.boost > best) best = def.boost;
          }
        }
        return best;
      },

      // ---------- lifecycle ----------
      createCompany({ name, ceo, logo, avatar, hqCityId, truckModelId }) {
        const model = modelById(truckModelId);
        const hq = cityById(hqCityId);
        const code = 'TE-' + Math.random().toString(36).slice(2, 7).toUpperCase();
        const startCapital = 5000000;
        const truck = {
          id: uid('t'), modelId: model.id, status: 'building',
          lat: hq.lat, lng: hq.lng, cityId: hq.id, fuelPct: 100,
          buildEndsAt: Date.now() + model.build * 1000, buildTotalSec: model.build,
          km: 0, deliveries: 0, driverId: null, condition: 100,
        };
        set({
          phase: 'game',
          updateGiftVersion: '3.0.0', // fresh companies skip only the old "two horizons" gift — the v10.9.0 Grand Finale (settings.finaleSeen) is NOT stamped here, so every new company still gets that celebration once
          company: { name, ceo, logo, avatar, hqCityId, code, createdAt: Date.now() },
          balance: startCapital - model.price,
          gold: 100,
          trucks: [truck],
          staff: [starterDriver()],
          hubs: [{ cityId: hq.id, name: hq.name + ' HQ', hq: true, since: Date.now() }],
          corridors: [],
          clockStart: Date.now(),
          lastSalaryDay: 0, lastContractDay: 0,
          nextContractAt: Date.now() + nextRefreshDelay(),
          unlockedCountries: ['IN'],
          contracts: randomContracts(1),
          candidates: randomCandidates(),
          notifications: [makeNotification('system', 'rocket-launch',
            `${name} is live! Your first ${model.name} is being built at ${hq.name}.`)],
        });
        initNotifications();
        scheduleAt(truck.buildEndsAt, `${truck.id}-built`, 'Your first truck is ready!',
          `${model.name} just rolled off the line at ${hq.name}. Time to haul!`);
      },

      resetGame() {
        set({ ...initialState, phase: 'splash' });
      },

      // Settle everything that finished while app was closed (offline progress)
      settleOffline() {
        const s = get();
        if (s.phase !== 'game') return;
        // Ask for OS-notification permission + set up the channel (idempotent).
        setNotificationsEnabled(s.settings?.notif?.delivery !== false || s.settings?.notif?.truck !== false);
        initNotifications();
        const now = Date.now();
        let changed = false;
        // finished builds
        const trucks = s.trucks.map(t => {
          if (t.status === 'building' && t.buildEndsAt <= now) {
            changed = true;
            get().notify('truck', 'check-decagram', `${modelById(t.modelId).name} finished building and is ready to roll.`);
            return { ...t, status: 'parked', buildEndsAt: null };
          }
          return t;
        });
        if (changed) set({ trucks });
        // finished deliveries
        for (const d of [...s.deliveries]) {
          if (d.endsAt <= now) get().completeDelivery(d.id, true);
        }
        // expired campaigns just fall out of the active filter naturally
        get().dailyTick();
      },

      // Award any achievement tiers newly reached — one-time gold + a notify
      // per tier. Cheap (a handful of comparisons), driven by the 1s loop.
      syncAchievements() {
        const s = get();
        const unlocked = s.achievements?.unlocked || {};
        let patch = null, goldWon = 0;
        for (const a of ACHIEVEMENTS) {
          const v = achievementValue(s, a.id);
          for (let tier = 0; tier < a.levels.length; tier++) {
            const key = `${a.id}:${tier}`;
            if (v >= a.levels[tier] && !unlocked[key]) {
              patch = patch || { ...unlocked };
              patch[key] = Date.now();
              goldWon += ACHIEVEMENT_TIER_GOLD[tier];
              get().notify('system', 'trophy',
                `Achievement unlocked — ${a.title} · ${ACHIEVEMENT_TIERS[tier]} (${a.levels[tier].toLocaleString()} ${a.unit}). +${ACHIEVEMENT_TIER_GOLD[tier]} Gold!`);
            }
          }
        }
        if (patch) {
          set({ achievements: { unlocked: patch }, gold: get().gold + goldWon });
          play('coin', 0.8);
        }
      },

      // Snapshot the whole game into the rolling local auto-backup slot and
      // stamp when it happened. Also runs automatically once per real day.
      backupNow() {
        set({ lastBackupAt: Date.now() });
        return writeAutoBackup(get().cloudSnapshot());
      },

      // Runs every second from the game loop; also on load.
      dailyTick() {
        const s = get();
        if (s.phase !== 'game') return;
        get().syncAchievements();
        const now = Date.now();
        // Rolling auto-backup, once per real day.
        if (now - (s.lastBackupAt || 0) > 24 * 3600 * 1000) get().backupNow();
        // Daily login gold: consecutive real days build a streak (2 gold per
        // streak day, capped at 14/day from day 7 onward).
        {
          const today = new Date().toDateString();
          const lg = s.login || { lastDay: '', streak: 0 };
          if (lg.lastDay !== today) {
            const yesterday = new Date(now - 24 * 3600 * 1000).toDateString();
            const streak = lg.lastDay === yesterday ? lg.streak + 1 : 1;
            const rw = streakRewardFor(streak);
            set({ login: { lastDay: today, streak, bestStreak: Math.max(lg.bestStreak || 0, streak) } });
            const cur = get();
            if (rw.type === 'gold') set({ gold: cur.gold + rw.amount });
            else if (rw.type === 'cash') { set({ balance: cur.balance + rw.amount }); get().logLedger('bonus', 'calendar-star', `Day ${streak} streak reward`, rw.amount); }
            else if (rw.type === 'speed') set({ boosts: { ...cur.boosts, speedUntil: now + 3600 * 1000 } });
            else if (rw.type === 'shield') set({ boosts: { ...cur.boosts, shieldUntil: now + 24 * 3600 * 1000 } });
            else if (rw.type === 'double') set({ boosts: { ...cur.boosts, doubleNext: true } });
            else if (rw.type === 'mega') { set({ gold: cur.gold + rw.gold, balance: cur.balance + rw.cash }); get().logLedger('bonus', 'treasure-chest', 'Day 30 MEGA streak chest', rw.cash); }
            get().notify('system', rw.icon, `Day ${streak} streak reward: ${rw.label}!${streak < 30 ? ` Tomorrow: ${streakRewardFor(streak + 1).label}.` : ' Legendary dedication!'}`);
          }
        }
        const { day } = get().gameDay();
        // Monthly running costs: staff salaries + garage maintenance (non-HQ).
        if (day - s.lastSalaryDay >= SALARY_EVERY_DAYS) {
          const salaries = s.staff.reduce((a, x) => a + x.salary, 0);
          const upkeep = (s.hubs || []).filter(h => !h.hq).reduce((a, h) => a + (h.maint || hubMaintForCity(cityById(h.cityId))), 0);
          const total = salaries + upkeep;
          if (total > 0) {
            set({ balance: s.balance - total, lastSalaryDay: day });
            if (salaries) get().logLedger('salary', 'account-cash', 'Staff salaries', -salaries);
            if (upkeep) get().logLedger('upkeep', 'garage', 'Garage upkeep & light bills', -upkeep);
            get().notify('system', 'cash-minus', `Monthly costs: ${inr(salaries)} salaries + ${inr(upkeep)} garage upkeep = ${inr(total)}.`);
          } else {
            set({ lastSalaryDay: day });
          }
        }
        // ---- v3.0.0 update welcome gift: one-time mega bonus for existing
        // players when they first open the Two Horizons update. New companies
        // never see it (createCompany stamps the version at birth).
        // IMPORTANT: this must be a "reached or passed" check (cmpVer < 0),
        // NOT an exact-string check — an exact "!== '3.0.0'" stays true
        // forever once the flag moves on to a later version, so this block
        // and the one below would fight each other every single tick,
        // flip-flopping the flag back and forth and re-granting both gifts
        // forever. (This is exactly what happened before — sorry!)
        if (cmpVer(s.updateGiftVersion || '0.0.0', '3.0.0') < 0) {
          // Fresh get() — the login-streak block above may have just granted
          // gold; using the stale snapshot would silently clobber it.
          const gcur = get();
          set({ updateGiftVersion: '3.0.0', gold: gcur.gold + 300, balance: gcur.balance + 25000000 });
          get().logLedger('bonus', 'party-popper', 'Update 3.0.0 welcome gift', 25000000);
          get().notify('system', 'party-popper',
            'UPDATE 3.0.0 IS HERE — the biggest one ever! 17 new countries across two horizons: Thailand to the Philippines & Indonesia in the east, Saudi Arabia to Kenya & Ethiopia in the west. Welcome gift: +₹2.5 Crore + 300 Gold. Thank you for building your empire with us!');
          play('coin', 1);
        }
        // ---- v10.9.0 Grand Finale gift: the final major content release.
        // Deliberately on its OWN flag (settings.finaleSeen) instead of chaining onto
        // updateGiftVersion — every company (brand new or returning) gets
        // this celebration exactly once, since it's the send-off moment,
        // not a "you missed an old update" backfill.
        if (!s.settings?.finaleSeen) {
          const gcur = get();
          set({
            settings: { ...gcur.settings, finaleSeen: true },
            gold: gcur.gold + 500, balance: gcur.balance + 50000000,
          });
          get().logLedger('bonus', 'party-popper', 'v10.9.0 Grand Finale gift', 50000000);
          get().notify('system', 'party-popper',
            'CONGRATULATIONS — TRUCK EMPIRE TYCOON v10.9.0 IS HERE! This is our final grand release — thank you for building this empire with us. +₹5 Crore + 500 Gold to celebrate!');
          play('coin', 1);
        }
        // ---- v2.4.0 daily/periodic systems ----
        // Weather: fresh zones each game day, only in plausible regions. New
        // weather is NOT just visual — any truck already driving through a
        // fresh zone gets its remaining trip slowed by that zone's factor.
        if ((s.weatherDay || 0) !== day || (s.weather || []).some(z => !z.shape || !z.shape.a3)) {
          // Fresh systems get a life cycle: they grow in, peak, shrink out and
          // dissipate (20–45 real minutes each), drifting slowly as they go.
          const zones = generateWeather(day).map(z => ({
            ...z, baseRadiusKm: z.radiusKm, born: now,
            lifeMs: (20 + Math.random() * 25) * 60 * 1000,
            drift: { dLat: (Math.random() - 0.5) * 0.5, dLng: (Math.random() - 0.5) * 0.5 },
          }));
          const nowW = Date.now();
          const slowed = [];
          const deliveries = get().deliveries.map(d => {
            if (d.wxDay === day) return d;
            const wx = weatherOnRoute(d.route.points, zones);
            if (wx.factor >= 0.999) return { ...d, wxDay: day };
            const rem = Math.max(0, d.endsAt - nowW);
            if (rem > 60000) slowed.push({ d, wx });
            return { ...d, wxDay: day, endsAt: rem > 60000 ? nowW + rem / wx.factor : d.endsAt };
          });
          set({ weather: zones, weatherDay: day, deliveries, lastWeatherEvolveAt: now });
          for (const { d, wx } of slowed) {
            const t = get().trucks.find(x => x.id === d.truckId);
            const z = wx.hits[0];
            const k = z && WEATHER_KINDS[z.kind];
            get().notify('truck', k?.icon || 'weather-pouring',
              `${k?.label || 'Weather'} over ${z?.name || 'the route'} — ${t ? (t.customName || modelById(t.modelId).name) : 'a truck'} slowed ${Math.round((1 - wx.factor) * 100)}% for the rest of the trip.`);
          }
        }
        // Living weather (v3.1.0): every ~7 real minutes each system breathes —
        // expands toward its peak, then contracts and dissipates; dead systems
        // are replaced by a fresh one somewhere else. Gentle, never jumpy.
        if (now - (get().lastWeatherEvolveAt || 0) > 30 * 60 * 1000 && (get().weather || []).length) {
          // Long AFK gap — a single incremental evolve step would look stale
          // (systems that should've died ages ago still lingering), so do a
          // full regen instead of nudging.
          const zones = generateWeather(day).map(z => ({
            ...z, baseRadiusKm: z.radiusKm, born: now,
            lifeMs: (20 + Math.random() * 25) * 60 * 1000,
            drift: { dLat: (Math.random() - 0.5) * 0.5, dLng: (Math.random() - 0.5) * 0.5 },
          }));
          set({ weather: zones, lastWeatherEvolveAt: now });
        } else if (now - (get().lastWeatherEvolveAt || 0) > 7 * 60 * 1000 && (get().weather || []).length) {
          const curZones = get().weather;
          let bornMsg = null;
          const evolved = curZones.map(z => {
            const born = z.born || now, life = z.lifeMs || 30 * 60 * 1000;
            const age = now - born;
            if (age >= life) {
              // Dissipate → a new system spawns from the catalog (offset seed
              // so it usually lands in a different region than the dead one).
              const fresh = generateWeather(day * 131 + Math.floor(now / 600000))[0];
              if (!fresh) return null;
              const nz = {
                ...fresh, id: `w-${now}-${Math.floor(Math.random() * 1e6)}`,
                baseRadiusKm: fresh.radiusKm, radiusKm: Math.round(fresh.radiusKm * 0.5), // grows in from small
                born: now, lifeMs: (20 + Math.random() * 25) * 60 * 1000,
                drift: { dLat: (Math.random() - 0.5) * 0.5, dLng: (Math.random() - 0.5) * 0.5 },
              };
              const k = WEATHER_KINDS[nz.kind];
              bornMsg = `${k?.label || 'Weather'} system forming over ${nz.name} — plan routes accordingly.`;
              return nz;
            }
            // Breathe: 70% → 130% of base radius across the life cycle; drift slowly.
            const phase = Math.sin(Math.PI * (age / life));
            const frac = age / life;
            return {
              ...z,
              radiusKm: Math.max(60, Math.round((z.baseRadiusKm || z.radiusKm) * (0.7 + 0.6 * phase))),
              lat: +(z.lat + (z.drift?.dLat || 0) * 0.12).toFixed(3),
              lng: +(z.lng + (z.drift?.dLng || 0) * 0.12).toFixed(3),
              intensity: frac < 0.5 ? 'building' : 'weakening',
            };
          }).filter(Boolean);
          set({ weather: evolved, lastWeatherEvolveAt: now });
          if (bornMsg) get().notify('system', 'weather-cloudy-alert', bornMsg);
        }
        // Loan EMIs: charged every LOAN_EMI_INTERVAL_DAYS game days per loan.
        // A missed EMI dings the credit score and adds 5% penalty interest to
        // what's left; miss MISSED_STREAK_FOR_REPO in a row and the bank
        // repossesses the cheapest pledged asset still standing.
        for (const ln of get().loans || []) {
          const sinceLast = day - (ln.lastEmiDay || 0);
          // Fire the "due tomorrow" reminder once — this block used to re-run
          // every 1s tick for the whole in-game day the condition stayed
          // true, spamming dozens of identical notifications/toasts. Stamping
          // remindedDay on the loan makes it a one-shot per due cycle.
          if (sinceLast === LOAN_EMI_INTERVAL_DAYS - 1 && ln.remindedDay !== day) {
            get().notify('system', 'bank-clock', `EMI on ${ln.name} due tomorrow — ${inr(Math.min(ln.emi, ln.remaining))}.`);
            set({ loans: get().loans.map(x => x.id === ln.id ? { ...x, remindedDay: day } : x) });
          }
          if (sinceLast < LOAN_EMI_INTERVAL_DAYS) continue;
          const cur = get();
          const curLoan = (cur.loans || []).find(x => x.id === ln.id);
          if (!curLoan) continue;
          const due = Math.min(curLoan.emi, curLoan.remaining);
          if (cur.balance >= due) {
            const remaining = curLoan.remaining - due;
            set({
              balance: cur.balance - due,
              credit: { ...cur.credit, paid: (cur.credit?.paid || 0) + 1 },
              loans: remaining <= 0
                ? cur.loans.filter(x => x.id !== curLoan.id)
                : cur.loans.map(x => x.id === curLoan.id ? { ...x, remaining, paidMonths: x.paidMonths + 1, lastEmiDay: day, missedStreak: 0 } : x),
            });
            get().logLedger('loan', 'bank', `EMI · ${curLoan.name}`, -due);
            if (remaining <= 0) get().notify('system', 'bank-check', `${curLoan.name} fully repaid — credit score up!`);
          } else {
            const missedStreak = (curLoan.missedStreak || 0) + 1;
            set({
              credit: { ...cur.credit, missed: (cur.credit?.missed || 0) + 1 },
              loans: cur.loans.map(x => x.id === curLoan.id ? { ...x, remaining: Math.round(x.remaining * 1.05), lastEmiDay: day, missedStreak } : x),
            });
            get().notify('system', 'bank-remove', `EMI missed on ${curLoan.name}! 5% penalty added and your credit score took a hit.`);
            if (missedStreak >= MISSED_STREAK_FOR_REPO) {
              const after = get();
              const afterLoan = (after.loans || []).find(x => x.id === curLoan.id);
              if (afterLoan) {
                // Find the cheapest pledged asset still owned (never the last
                // truck or the HQ hub).
                const candidates = [];
                for (const id of afterLoan.collateral?.truckIds || []) {
                  if (after.trucks.length <= 1) continue;
                  const t = after.trucks.find(x => x.id === id);
                  if (t) candidates.push({ kind: 'truck', id, value: collateralAssetValue(after, 'truck', id), label: t.customName || modelById(t.modelId).name });
                }
                for (const id of afterLoan.collateral?.hubCityIds || []) {
                  const h = (after.hubs || []).find(x => x.cityId === id);
                  if (h && !h.hq) candidates.push({ kind: 'hub', id, value: collateralAssetValue(after, 'hub', id), label: h.name });
                }
                candidates.sort((a, b) => a.value - b.value);
                const seized = candidates[0];
                if (seized) {
                  const remaining2 = Math.max(0, afterLoan.remaining - seized.value);
                  set({
                    trucks: seized.kind === 'truck' ? after.trucks.filter(x => x.id !== seized.id) : after.trucks,
                    hubs: seized.kind === 'hub' ? after.hubs.filter(x => x.cityId !== seized.id) : after.hubs,
                    loans: remaining2 <= 0
                      ? after.loans.filter(x => x.id !== afterLoan.id)
                      : after.loans.map(x => x.id === afterLoan.id ? { ...x, remaining: remaining2, missedStreak: 0 } : x),
                  });
                  get().logLedger('loan', 'bank-remove', `Repossessed · ${seized.label} (${afterLoan.name})`, seized.value);
                  get().notify('system', 'bank-remove', `Bank repossessed ${seized.label} over missed EMIs on ${afterLoan.name} — ${inr(seized.value)} written off the loan.`);
                }
                // If no seizable asset remains, penalty interest keeps
                // accruing as usual on the next miss — no crash, no loop.
              }
            }
          }
        }
        // Company level-ups: pay a one-time gold reward per level reached.
        {
          const cur = get();
          const lvl = companyLevelOf(companyXP(cur));
          if (lvl > (cur.lastCompanyLevel || 0)) {
            const reward = lvl * 10;
            set({ lastCompanyLevel: lvl, gold: cur.gold + reward });
            get().notify('system', 'medal', `Company level up! Now Level ${lvl} — "${companyTitleOf(lvl)}". +${reward} Gold.`);
            play('coin', 0.9);
          }
        }
        // Weekly challenges: roll a fresh set when the real ISO week changes.
        {
          const wid = isoWeekId();
          if (!s.weekly || s.weekly.id !== wid) {
            set({ weekly: buildWeekly(wid, get().stats) });
            if (s.weekly) get().notify('system', 'calendar-week', 'New weekly challenges are live — big bonus for a clean sweep!');
          }
        }
        // Daily challenges: roll a fresh set when the real calendar day changes.
        {
          const did = dailyDateId();
          if (!s.daily || s.daily.id !== did) {
            set({ daily: buildDaily(did, get().stats) });
            if (s.daily) get().notify('system', 'calendar-today', 'New daily challenges are live!');
          }
        }
        // fresh contracts each day + flavor event
        if (day > s.lastContractDay) {
          const kept = s.contracts.filter(c => c.status !== 'available' || c.expiresAt > Date.now());
          set({ contracts: [...randomContracts(day), ...kept].slice(0, 24), lastContractDay: day });
          if (day > 1) {
            play('day', 0.6);
            get().notify('system', 'weather-sunset-up', `Day ${day} begins across your empire.`);
            // Harmless atmospheric flavour (frequent, no gameplay impact).
            if (Math.random() < 0.22) {
              const flavor = [
                ['traffic-light', 'Traffic advisory: slow-moving convoy reported on NH44.'],
                ['file-document-outline', 'New contracts are pouring in — check the contract board.'],
                ['weather-pouring', 'Monsoon showers reported along the Konkan coast.'],
                ['star-circle', 'Industry buzz: your company is being talked about!'],
              ];
              const [icon, msg] = flavor[Math.floor(Math.random() * flavor.length)];
              get().notify('system', icon, msg);
            }
          }
        }
        // Fresh contracts flow onto the board every ~2–4 hours of real time,
        // independent of the day rollover, so the board keeps churning quickly.
        if (now >= (s.nextContractAt || 0)) {
          const cur = get();
          const kept = cur.contracts.filter(c => c.status !== 'available' || c.expiresAt > now);
          const fresh = randomContracts(day, 4);
          set({
            contracts: [...fresh, ...kept].slice(0, 24),
            nextContractAt: now + nextRefreshDelay(),
          });
          if (s.nextContractAt) get().notify('system', 'file-document-multiple', 'Fresh contracts just landed on the board.');
        }
        // Random events on a REAL-TIME cadence (independent of the day rollover),
        // so they happen noticeably often during play.
        const freq = s.settings.events || 'rare';
        if (freq !== 'off') {
          const intervalMs = freq === 'sometimes' ? 12 * 60 * 1000 : 25 * 60 * 1000;
          if (now - (s.lastEventAt || 0) > intervalMs) {
            set({ lastEventAt: now });
            get().rollRandomEvent();
          }
        }
        // In-progress delivery incidents (accident/theft) — separate, rarer
        // cadence from the world events above; only ever a partial hit.
        if (freq !== 'off') {
          const iIntervalMs = INCIDENT_INTERVAL_MS[freq] || INCIDENT_INTERVAL_MS.rare;
          if (now - (s.lastIncidentAt || 0) > iIntervalMs) {
            set({ lastIncidentAt: now });
            get().rollDeliveryIncident();
          }
        }
        // Resolve incidents whose delay has run out (mechanic-assisted or not).
        const dueIncidents = s.deliveries.filter(d => d.incident && d.incident.resolveAt <= now);
        if (dueIncidents.length) {
          set({
            deliveries: get().deliveries.map(d => dueIncidents.some(x => x.id === d.id) ? { ...d, incident: null } : d),
          });
          dueIncidents.forEach(d => {
            const t = get().trucks.find(x => x.id === d.truckId);
            get().notify('truck', 'check-decagram', `${t ? (t.customName || modelById(t.modelId).name) : 'Truck'} is back underway after the ${d.incident.type}.`);
          });
        }
      },

      // Rare world events (goods stolen, accident, fuel spike, windfall).
      // settings.events: 'off' | 'rare' (~5%) | 'sometimes' (~12%).
      rollRandomEvent() {
        const s = get();
        const freq = s.settings.events || 'rare';
        const chance = freq === 'off' ? 0 : freq === 'sometimes' ? 0.6 : 0.35;
        if (Math.random() > chance) return;
        // Push a located event so the map can highlight it (kept short, capped).
        const pushMapEvent = (kind, icon, color, lat, lng, label) => {
          if (lat == null || lng == null) return;
          set({
            mapEvents: [{ id: uid('ev'), kind, icon, color, lat, lng, label, ts: Date.now() },
            ...(get().mapEvents || [])].slice(0, 6)
          });
        };
        const anyCity = () => {
          const h = (s.hubs || [])[Math.floor(Math.random() * Math.max(1, (s.hubs || []).length))];
          return h ? cityById(h.cityId) : cityById(s.company?.hqCityId);
        };
        // Incident Shield power-up: no bad luck of any kind while active.
        const shielded = (s.boosts.shieldUntil || 0) > Date.now();
        const pool = [];
        // Goods stolen — lose a small sum if you have cash.
        if (s.balance > 100000 && !shielded) pool.push(() => {
          const loss = Math.min(s.balance, Math.round(50000 + Math.random() * 200000));
          const c = anyCity();
          set({ balance: s.balance - loss });
          get().logLedger('theft', 'shield-alert', `Cargo theft near ${c ? c.name : 'a depot'}`, -loss);
          if (c) pushMapEvent('theft', 'shield-alert', '#C0392B', c.lat, c.lng, 'Cargo theft');
          get().notify('system', 'shield-alert', `Cargo theft! Bandits stole goods worth ${inr(loss)} near ${c ? c.name : 'a depot'}.`);
          pushFlavor('theft', { amount: inr(loss), city: c ? c.name : 'a depot' });
        });
        // Accident — a random on-road truck breaks down.
        const onRoad = s.trucks.filter(t => t.status === 'delivering' || t.status === 'parked');
        if (onRoad.length && !shielded) pool.push(() => {
          const t = onRoad[Math.floor(Math.random() * onRoad.length)];
          const d = s.deliveries.find(x => x.truckId === t.id);
          set({
            deliveries: d ? s.deliveries.filter(x => x.id !== d.id) : s.deliveries,
            trucks: get().trucks.map(x => x.id === t.id ? { ...x, status: 'broken' } : x),
          });
          pushMapEvent('accident', 'car-brake-alert', '#E67E22', t.lat, t.lng, 'Breakdown');
          get().notify('truck', 'car-brake-alert', `Accident! ${modelById(t.modelId).name} broke down and needs repair.`);
          pushFlavor('breakdown', { truck: modelById(t.modelId).name });
        });
        // Fuel price spike — informational.
        pool.push(() => get().notify('system', 'gas-station', 'Fuel prices spiked nationwide — watch your margins today.'));
        // Windfall — small bonus.
        pool.push(() => {
          const bonus = Math.round(40000 + Math.random() * 120000);
          const c = anyCity();
          set({ balance: get().balance + bonus });
          get().logLedger('bonus', 'gift', `Loyal client bonus${c ? ` · ${c.name}` : ''}`, bonus);
          if (c) pushMapEvent('windfall', 'gift', '#12A150', c.lat, c.lng, 'Client bonus');
          get().notify('system', 'gift', `Loyal client bonus! You received ${inr(bonus)}${c ? ` in ${c.name}` : ''}.`);
          pushFlavor('windfall', { amount: inr(bonus), city: c ? c.name : null });
        });
        pool[Math.floor(Math.random() * pool.length)]();
      },

      // In-progress delivery incidents — an 'accident' or 'theft' on a truck
      // that's actively driving. Unlike rollRandomEvent's breakdown (which
      // pulls the truck off the road entirely), this only ever costs a partial
      // cut of that delivery's earnings plus a delay; the delivery, contract
      // and cargo all survive. Resolves on its own once incident.resolveAt
      // passes (see dailyTick), or faster if the player calls a mechanic.
      rollDeliveryIncident() {
        const s = get();
        // Incident Shield power-up blocks every on-road mishap while active.
        if ((s.boosts.shieldUntil || 0) > Date.now()) return;
        const freq = s.settings.events || 'rare';
        const chance = INCIDENT_CHANCE[freq] || 0;
        if (chance <= 0 || Math.random() > chance) return;
        const now = Date.now();
        // Only deliveries with real road left ahead of them (skip ones about
        // to arrive, and ones already mid-incident).
        const active = s.deliveries.filter(d => !d.incident && d.endsAt - now > 3 * 60 * 1000
          && (now - d.startedAt) < (d.endsAt - d.startedAt) * 0.85);
        if (!active.length) return;
        const d = active[Math.floor(Math.random() * active.length)];
        const t = s.trucks.find(x => x.id === d.truckId);
        if (!t) return;
        // Road Captain perk (driver level 8): 20% of would-be incidents just
        // don't happen — an experienced pair of hands on the wheel.
        const capDrv = s.staff.find(x => x.id === t.driverId && x.role === 'driver');
        if (capDrv && driverPerkIds(capDrv).includes('road_captain') && Math.random() < 0.2) return;
        // Weighted pick across the incident catalog (INCIDENT_TYPES).
        const roll = Math.random();
        let acc = 0, meta = INCIDENT_TYPES[0];
        for (const it of INCIDENT_TYPES) { acc += it.weight; if (roll < acc) { meta = it; break; } }
        const type = meta.id;
        const delaySec = Math.round(meta.delayMin + Math.random() * (meta.delayMax - meta.delayMin));
        const penaltyPct = meta.penaltyMin + Math.random() * (meta.penaltyMax - meta.penaltyMin);
        const penalty = Math.min(s.balance, Math.round((d.econ.gross || d.econ.net || 0) * penaltyPct));
        const incident = { type, startedAt: now, resolveAt: now + delaySec * 1000, penalty, mechanicCalled: false };
        set({
          // Lifetime incident counters feed the achievement tracks (old saves
          // may lack these fields, hence the || 0).
          stats: {
            ...s.stats,
            incidents: (s.stats.incidents || 0) + 1,
            thefts: (s.stats.thefts || 0) + (type === 'theft' ? 1 : 0),
          },
          balance: s.balance - penalty,
          deliveries: s.deliveries.map(x => x.id === d.id ? { ...x, incident, endsAt: x.endsAt + delaySec * 1000 } : x),
          trucks: meta.conditionHit
            ? s.trucks.map(x => x.id === t.id ? { ...x, condition: Math.max(10, (x.condition == null ? 100 : x.condition) - (meta.conditionHit[0] + Math.random() * (meta.conditionHit[1] - meta.conditionHit[0]))) } : x)
            : s.trucks,
        });
        const name = t.customName || modelById(t.modelId).name;
        if (penalty) get().logLedger('incident', meta.icon, `${meta.title.replace('!', '')} — ${name}`, -penalty);
        get().notify('truck', meta.icon, `${meta.title} ${meta.notify(name, penalty)}`);
        pushNow(meta.title, meta.notify(name, penalty));
      },

      // Pay to have a mechanic come out to a delivery mid-incident, cutting
      // the remaining delay short instead of waiting it out for free.
      callMechanic(deliveryId) {
        const s = get();
        const d = s.deliveries.find(x => x.id === deliveryId);
        if (!d || !d.incident) return { ok: false, err: 'No active incident on this delivery' };
        if (!incidentMeta(d.incident.type).mechanic) return { ok: false, err: 'A mechanic can’t help with this — it will clear on its own' };
        if (d.incident.mechanicCalled) return { ok: false, err: 'Mechanic already on the way' };
        const cost = Math.round(30000 + Math.random() * 40000);
        if (s.balance < cost) return { ok: false, err: 'Insufficient funds' };
        const now = Date.now();
        const remaining = Math.max(0, d.incident.resolveAt - now);
        const cut = Math.round(remaining * MECHANIC_DELAY_CUT);
        set({
          balance: s.balance - cost,
          stats: { ...s.stats, mechanicCalls: (s.stats.mechanicCalls || 0) + 1 },
          deliveries: s.deliveries.map(x => x.id === deliveryId ? {
            ...x, endsAt: x.endsAt - cut,
            incident: { ...x.incident, mechanicCalled: true, resolveAt: x.incident.resolveAt - cut },
          } : x),
        });
        get().logLedger('repair', 'wrench', 'Roadside mechanic call-out', -cost);
        get().notify('truck', 'wrench', `Mechanic dispatched for ${inr(cost)} — delay cut short.`);
        return { ok: true, cost };
      },

      // ---------- fleet ----------
      buyTruck(modelId) {
        const s = get();
        const model = modelById(modelId);
        if (!model) return { ok: false, err: 'Unknown model' };
        // Daily showroom deal: today's discounted price is the real price.
        const day = get().gameDay().day;
        const price = dealPriceFor(model, day);
        if (s.balance < price) return { ok: false, err: 'Insufficient funds' };
        const hq = cityById(s.company.hqCityId);
        const truck = {
          id: uid('t'), modelId, status: 'building',
          lat: hq.lat, lng: hq.lng, cityId: hq.id, fuelPct: 100,
          buildEndsAt: Date.now() + model.build * 1000, buildTotalSec: model.build,
          km: 0, deliveries: 0, driverId: null, condition: 100,
        };
        set({ balance: s.balance - price, trucks: [...s.trucks, truck] });
        get().logLedger('truck', 'truck', `Bought ${model.name}${price < model.price ? ' (deal!)' : ''}`, -price);
        get().notify('truck', 'factory', `${model.name} ordered — building at HQ (${model.build}s).`);
        {
          const hqCity = cityById(s.company?.hqCityId);
          const f = flavor('truckReady', { truck: model.name, city: hqCity ? hqCity.name : 'HQ' });
          scheduleAt(truck.buildEndsAt, `${truck.id}-built`, f.title, f.body);
        }
        return { ok: true };
      },

      finishBuildIfDue(truckId) {
        const s = get();
        const t = s.trucks.find(x => x.id === truckId);
        if (t && t.status === 'building' && t.buildEndsAt <= Date.now()) {
          set({ trucks: s.trucks.map(x => x.id === truckId ? { ...x, status: 'parked', buildEndsAt: null } : x) });
          get().notify('truck', 'check-decagram', `${modelById(t.modelId).name} is ready to roll!`);
        }
      },

      repairTruck(truckId, withGold) {
        const s = get();
        const t = s.trucks.find(x => x.id === truckId);
        if (!t || t.status !== 'broken') return { ok: false, err: 'Truck is not broken' };
        // A mechanic on staff is required for a normal (cash) repair; Gold skips the need.
        const hasMechanic = s.staff.some(x => x.role === 'mechanic');
        if (withGold) {
          if (s.gold < 15) return { ok: false, err: 'Not enough Gold' };
          set({ gold: s.gold - 15, stats: { ...s.stats, goldSpent: (s.stats.goldSpent || 0) + 15 } });
        } else {
          if (!hasMechanic) return { ok: false, err: 'Hire a mechanic to repair trucks (or use 15 Gold)' };
          // Mechanic skill trims the bill (see mechDiscount).
          const fee = Math.round(modelById(t.modelId).price * 0.04 * (1 - get().mechDiscount()));
          if (s.balance < fee) return { ok: false, err: 'Insufficient funds for repair' };
          set({ balance: s.balance - fee });
          get().logLedger('repair', 'wrench-check', `Repair · ${t.customName || modelById(t.modelId).name}`, -fee);
        }
        set({ trucks: get().trucks.map(x => x.id === truckId ? { ...x, status: 'parked' } : x) });
        get().notify('truck', 'wrench-check', `${modelById(t.modelId).name} repaired and back in service.`);
        return { ok: true };
      },

      // Paid service that restores condition (engine/tyres/body wear, not the
      // same as repairTruck's 'broken' status) back to 100.
      serviceTruck(truckId) {
        const s = get();
        const t = s.trucks.find(x => x.id === truckId);
        if (!t) return { ok: false, err: 'Truck not found' };
        if (t.status === 'delivering') return { ok: false, err: 'Truck is out on delivery' };
        const cond = t.condition == null ? 100 : t.condition;
        if (cond >= 99) return { ok: false, err: 'Already in top condition' };
        // Realistic bill: proportional to the wear being fixed, capped at ₹5L
        // so servicing a premium rig never costs a fortune. Floor ₹15k.
        // Mechanic skill trims the bill (see mechDiscount).
        const cost = Math.max(15000, Math.min(500000,
          Math.round(modelById(t.modelId).price * SERVICE_COST_PCT * ((100 - cond) / 100) * (1 - get().mechDiscount()))));
        if (s.balance < cost) return { ok: false, err: 'Insufficient funds for service' };
        set({
          balance: s.balance - cost,
          trucks: s.trucks.map(x => x.id === truckId ? { ...x, condition: 100 } : x),
        });
        get().logLedger('repair', 'wrench', `Service · ${t.customName || modelById(t.modelId).name}`, -cost);
        get().notify('truck', 'wrench', `${t.customName || modelById(t.modelId).name} serviced — back to full condition.`);
        return { ok: true, cost };
      },

      // Resale value: depreciates with distance driven & deliveries (old age).
      truckResale(truckId) {
        const t = get().trucks.find(x => x.id === truckId);
        if (!t) return 0;
        const price = modelById(t.modelId).price;
        const wear = Math.min(0.45, (t.km / 200000) * 0.35 + (t.deliveries / 200) * 0.1);
        return Math.round(price * (0.7 - wear)); // 25%–70% of price back
      },
      sellTruck(truckId) {
        const s = get();
        const t = s.trucks.find(x => x.id === truckId);
        if (!t) return { ok: false, err: 'Truck not found' };
        if (t.status === 'delivering') return { ok: false, err: 'Finish the delivery before selling' };
        if (t.status === 'building') return { ok: false, err: 'Cannot sell a truck under construction' };
        if (s.trucks.length <= 1) return { ok: false, err: 'You must keep at least one truck' };
        const value = get().truckResale(truckId);
        set({
          balance: s.balance + value,
          trucks: s.trucks.filter(x => x.id !== truckId),
          // free the driver that was assigned to it
          staff: s.staff.map(x => x.truckId === truckId ? { ...x, truckId: null } : x),
        });
        get().logLedger('truck', 'cash-refund', `Sold ${t.customName || modelById(t.modelId).name}`, value);
        get().notify('system', 'cash-refund', `Sold ${t.customName || modelById(t.modelId).name} for ${inr(value)}.`);
        return { ok: true, value };
      },

      // Customize a truck's custom name only — free, applied instantly (the
      // paint job below is the paid part).
      customizeTruck(truckId, patch) {
        set({ trucks: get().trucks.map(t => t.id === truckId ? { ...t, ...patch } : t) });
      },

      // Repaint a truck's livery: body colour, trim/accent colour, emblem.
      // Costs a flat LIVERY_COST Gold per apply (not per swatch tap) — the
      // Livery modal lets the player freely preview combinations for free and
      // only spends Gold once they commit. Applies instantly everywhere the
      // truck is rendered (fleet list, truck detail, map body colour) since
      // it's just a store patch, same as every other live-reflected field.
      paintTruck(truckId, patch) {
        const s = get();
        const t = s.trucks.find(x => x.id === truckId);
        if (!t) return { ok: false, err: 'Truck not found' };
        const changed = ['color', 'accentColor', 'logoIcon'].some(k => patch[k] !== undefined && patch[k] !== (t[k] ?? null));
        if (!changed) return { ok: false, err: 'Nothing to apply' };
        if (s.gold < LIVERY_COST) return { ok: false, err: `Need ${LIVERY_COST} Gold to repaint` };
        set({
          gold: s.gold - LIVERY_COST,
          trucks: s.trucks.map(x => x.id === truckId ? { ...x, ...patch } : x),
          stats: { ...s.stats, repaints: (s.stats.repaints || 0) + 1 },
        });
        get().logLedger('truck', 'palette', `Repainted ${t.customName || modelById(t.modelId).name}`, 0);
        get().notify('truck', 'palette', `${t.customName || modelById(t.modelId).name} got a fresh new look!`);
        play('coin', 0.6);
        return { ok: true };
      },

      // Buy a regional garage in a city — price & upkeep depend on the city tier.
      buyHub(cityId) {
        const s = get();
        if (s.hubs.some(h => h.cityId === cityId)) return { ok: false, err: 'You already have a garage here' };
        const city = cityById(cityId);
        const cost = hubCostForCity(city);
        if (s.balance < cost) return { ok: false, err: `Insufficient funds (need ${inr(cost)})` };
        set({
          balance: s.balance - cost,
          hubs: [...s.hubs, {
            cityId, name: city.name + ' Garage', hq: false, since: Date.now(),
            tier: city.tier, cost, maint: hubMaintForCity(city),
          }],
        });
        get().logLedger('garage', 'garage-variant', `Garage opened in ${city.name}`, -cost);
        get().notify('system', 'garage', `New garage opened in ${city.name} for ${inr(cost)}! Free refuelling + fast-travel here.`);
        return { ok: true };
      },

      // Sell a purchased garage back for half its price. HQ can't be sold.
      sellHub(cityId) {
        const s = get();
        const hub = s.hubs.find(h => h.cityId === cityId);
        if (!hub) return { ok: false, err: 'No garage here' };
        if (hub.hq) return { ok: false, err: 'Your HQ can’t be sold' };
        const refund = Math.round((hub.cost || 0) * 0.5);
        set({ balance: s.balance + refund, hubs: s.hubs.filter(h => h.cityId !== cityId) });
        get().logLedger('garage', 'garage', `Sold garage · ${hub.name.replace(' Garage', '')}`, refund);
        get().notify('system', 'garage', `Garage in ${hub.name.replace(' Garage', '')} sold for ${inr(refund)}.`);
        return { ok: true, refund };
      },

      // Upgrade a building (HQ or garage) to its next tier — cash cost,
      // status/visual upgrade only (bigger building on the map, more window
      // rows / bay doors). Same tier ladder logic for both via hub.hq to pick
      // the right catalog, so one action covers the whole real-estate side.
      upgradeHub(cityId) {
        const s = get();
        const hub = s.hubs.find(h => h.cityId === cityId);
        if (!hub) return { ok: false, err: 'No building found here' };
        const tiers = hub.hq ? HQ_TIERS : GARAGE_TIERS;
        const cur = hub.tier || 0;
        const next = tiers[cur + 1];
        if (!next) return { ok: false, err: 'Already at the top tier' };
        if (s.balance < next.cost) return { ok: false, err: `Need ${inr(next.cost)} to upgrade` };
        set({
          balance: s.balance - next.cost,
          hubs: s.hubs.map(h => h.cityId === cityId ? { ...h, tier: next.id } : h),
        });
        const label = hub.hq ? 'Headquarters' : hub.name;
        get().logLedger(hub.hq ? 'hq' : 'garage', 'office-building-marker', `${label} upgraded — ${next.name}`, -next.cost);
        get().notify('system', 'office-building-marker', `${label} upgraded to ${next.name}!`);
        play('coin', 1);
        return { ok: true };
      },
      // Repaint a building's colour — same flat-Gold, apply-once model as
      // paintTruck() (see there for the free-preview rationale).
      paintHub(cityId, color) {
        const s = get();
        const hub = s.hubs.find(h => h.cityId === cityId);
        if (!hub) return { ok: false, err: 'No building found here' };
        if ((hub.color || null) === (color || null)) return { ok: false, err: 'Nothing to apply' };
        if (s.gold < LIVERY_COST) return { ok: false, err: `Need ${LIVERY_COST} Gold to repaint` };
        set({ gold: s.gold - LIVERY_COST, hubs: s.hubs.map(h => h.cityId === cityId ? { ...h, color } : h) });
        const label = hub.hq ? 'Headquarters' : hub.name;
        get().logLedger(hub.hq ? 'hq' : 'garage', 'palette', `${label} repainted`, 0);
        get().notify('system', 'palette', `${label} got a fresh new look!`);
        play('coin', 0.6);
        return { ok: true };
      },

      // Free refuel for a truck parked at any of your garages/HQ.
      refuelAtHub(truckId) {
        const s = get();
        const t = s.trucks.find(x => x.id === truckId);
        if (!t) return { ok: false, err: 'Truck not found' };
        if (t.status !== 'parked') return { ok: false, err: 'Truck must be parked to refuel' };
        if (!s.hubs.some(h => h.cityId === t.cityId)) return { ok: false, err: 'No garage in this city — free refuel only at your garages' };
        if ((t.fuelPct || 0) >= 100) return { ok: false, err: 'Tank is already full' };
        set({ trucks: s.trucks.map(x => x.id === truckId ? { ...x, fuelPct: 100 } : x) });
        get().notify('truck', 'gas-station', `${t.customName || modelById(t.modelId).name} refuelled free at your garage.`);
        return { ok: true };
      },

      // Instantly relocate a parked truck between two of your garages (small fee).
      fastTravel(truckId, toCityId) {
        const s = get();
        const t = s.trucks.find(x => x.id === truckId);
        if (!t) return { ok: false, err: 'Truck not found' };
        if (t.status !== 'parked') return { ok: false, err: 'Only a parked truck can fast-travel' };
        if (!s.hubs.some(h => h.cityId === t.cityId)) return { ok: false, err: 'Truck must be at one of your garages' };
        if (!s.hubs.some(h => h.cityId === toCityId)) return { ok: false, err: 'Destination must be one of your garages' };
        if (t.cityId === toCityId) return { ok: false, err: 'Truck is already here' };
        const from = cityById(t.cityId), to = cityById(toCityId);
        const km = Math.round(computeRoute(from.lat, from.lng, to.lat, to.lng)?.roadKm || 0);
        const fee = Math.max(2000, Math.round(km * 8)); // repositioning fee
        if (s.balance < fee) return { ok: false, err: `Need ${inr(fee)} for the transfer` };
        set({
          balance: s.balance - fee,
          stats: { ...s.stats, fastTravels: (s.stats.fastTravels || 0) + 1 },
          trucks: s.trucks.map(x => x.id === truckId ? { ...x, lat: to.lat, lng: to.lng, cityId: to.id } : x),
        });
        get().logLedger('transfer', 'transfer', `Fast-travel to ${to.name}`, -fee);
        get().notify('truck', 'transfer', `${t.customName || modelById(t.modelId).name} fast-travelled to ${to.name} for ${inr(fee)}.`);
        return { ok: true, fee, km };
      },

      // ---------- deliveries ----------
      previewDelivery(truckId, toCityId, cargoType, cargoTons) {
        const s = get();
        const t = s.trucks.find(x => x.id === truckId);
        if (!t) return { err: 'Truck not found' };
        const model = modelById(t.modelId);
        const to = cityById(toCityId);
        // Country gating: the destination's country must be unlocked.
        const destCountry = to.country || 'IN';
        const unlocked = s.unlockedCountries || ['IN'];
        if (!unlocked.includes(destCountry)) {
          const cn = COUNTRY_BY_CODE[destCountry];
          return { err: `Locked — unlock ${cn ? cn.name : destCountry} in the World map to deliver here.`, locked: destCountry };
        }
        const route = computeRoute(t.lat, t.lng, to.lat, to.lng);
        if (!route) return { err: 'No road or ferry connection reaches this destination yet. Island routes need a ferry link.' };
        // Cap only truly absurd sea distances; continental international hauls
        // (China, Malaysia) legitimately run long.
        if (route.usesFerry && route.roadKm > 8000) return { err: 'This route is beyond practical reach for now.' };
        const stops = planFuelStops(route, model);
        const cargo = cargoById(cargoType);
        const tons = Math.min(cargoTons, model.cargo);
        const rate = s.pricing[cargoType] != null ? s.pricing[cargoType] : cargo.rate;
        const econ0 = deliveryEconomics({
          model, distanceKm: route.roadKm, cargoTons: tons, rate,
          boosts: { marketing: get().marketingBoost(), doubleNext: s.boosts.doubleNext },
        });
        // International customs: each border crossing costs a fee (paperwork +
        // duty) and adds inspection time at the checkpoint.
        const borders = route.bordersCrossed || 0;
        const customs = borders > 0 ? Math.round(borders * (CUSTOMS_FEE_BASE + CUSTOMS_FEE_PER_TON * tons)) : 0;
        // v2.4.0 — daily fuel market: today's diesel index scales the fuel bill.
        const day = get().gameDay().day;
        const fuelFactor = fuelFactorForDay(day);
        // v2.4.0 — driver perks plug straight into the economics.
        const drvForPerks = s.staff.find(x => x.id === t.driverId && x.role === 'driver');
        const perks = drvForPerks ? driverPerkIds(drvForPerks) : [];
        const fuelPerk = perks.includes('fuel_saver') ? 0.95 : 1;
        const fuel = Math.round(econ0.fuel * fuelFactor * fuelPerk);
        const fuelDelta = fuel - econ0.fuel;
        const legendBonus = perks.includes('living_legend') ? Math.round(econ0.gross * 0.10) : 0;
        const econ = {
          ...econ0, customs, fuel, fuelFactor, legendBonus,
          gross: econ0.gross + legendBonus,
          net: econ0.net - customs - fuelDelta + legendBonus,
        };
        // ----- Fuel model: consume based on current tank; auto-refuel en route -----
        const R = model.range;
        const startFuel = t.fuelPct == null ? 100 : t.fuelPct;
        const startRangeKm = (startFuel / 100) * R;
        const usableLeg = R * 0.92;
        let refuelCount = 0, arriveFuelPct;
        if (route.roadKm <= startRangeKm) {
          arriveFuelPct = Math.max(4, Math.round(startFuel - (route.roadKm / R) * 100));
        } else {
          const after = route.roadKm - startRangeKm;
          refuelCount = Math.ceil(after / usableLeg);
          const lastLeg = after - (refuelCount - 1) * usableLeg;
          arriveFuelPct = Math.max(4, Math.round(100 - (lastLeg / R) * 100));
        }
        // A run-down truck (low condition) drives slower — folded into the
        // same speedBoost knob tripDurationSec already divides by, floored so
        // it never fully stalls.
        const condition = t.condition == null ? 100 : t.condition;
        const conditionFactor = CONDITION_MIN_SPEED_FACTOR + (1 - CONDITION_MIN_SPEED_FACTOR) * (condition / 100);
        // Driver skill matters: an assigned driver's skill adds up to +15%
        // pace, and a freshly promoted driver (3-day buzz) drives at 2×.
        const drv = s.staff.find(x => x.id === t.driverId && x.role === 'driver');
        const skillFactor = drv ? 1 + ((drv.skill || 0) / 100) * 0.15 : 1;
        const promoFactor = drv && (drv.promoBoostUntil || 0) > Date.now() ? 2 : 1;
        // v2.4.0 — Night Rider perk (+8% pace) and live weather on the route:
        // driving through an active rain/dust/snow zone slows the whole trip.
        const perkPace = perks.includes('night_rider') ? 1.08 : 1;
        const wx = weatherOnRoute(route.points, s.weather || []);
        const speedBoost = (s.boosts.speedUntil > Date.now() ? 2 : 1) * conditionFactor * skillFactor * promoFactor * perkPace * wx.factor;
        // ----- Driver fatigue: legally/physically a driver can't drive forever.
        // A sleep break (~2h) after every ~8.5h driving, plus short ~5min breaks
        // every ~2.5h. These pauses extend the real delivery time.
        const drivingHours = route.roadKm / model.speed;
        const sleepBreaks = Math.floor(drivingHours / 8.5);
        const shortBreaks = Math.floor(drivingHours / 2.5);
        const restHours = sleepBreaks * 2 + shortBreaks * (5 / 60);
        const restSec = Math.round((restHours * REAL_SEC_PER_GAME_HOUR) / speedBoost);
        // Each auto-refuel stop costs ~1 in-game hour of real time; each border
        // crossing adds customs/inspection time at the checkpoint.
        const borderSec = Math.round((borders * CUSTOMS_HOURS * REAL_SEC_PER_GAME_HOUR) / speedBoost)
          * (perks.includes('border_expert') ? 0.7 : 1);
        const durationSec = tripDurationSec(model, route.roadKm, speedBoost) + refuelCount * 60 + restSec + borderSec;
        return {
          route, stops, econ, durationSec, tons, model, to, arriveFuelPct, refuelCount,
          startRangeKm: Math.round(startRangeKm), fullRangeKm: R, startFuelPct: Math.round(startFuel),
          drivingHours: Math.round(drivingHours * 10) / 10, sleepBreaks, shortBreaks, restHours: Math.round(restHours * 10) / 10,
          borders, customs, borderNames: route.borderNames || [], destCountry,
          weatherZones: wx.hits.map(z => ({ name: z.name, kind: z.kind })), weatherFactor: wx.factor,
          perks, fuelFactor,
        };
      },

      startDelivery(truckId, toCityId, cargoType, cargoTons, contractId = null) {
        const s = get();
        const t = s.trucks.find(x => x.id === truckId);
        if (!t || t.status !== 'parked') return { ok: false, err: 'Truck is not available' };
        // A driver is required. Use the one already assigned, else grab any free driver.
        let driverId = t.driverId;
        if (!driverId || !s.staff.some(x => x.id === driverId && x.role === 'driver')) {
          const free = s.staff.find(x => x.role === 'driver' && (!x.truckId || x.truckId === truckId));
          if (!free) return { ok: false, err: 'No available driver — hire or free up a driver first' };
          driverId = free.id;
        }
        const p = get().previewDelivery(truckId, toCityId, cargoType, cargoTons);
        if (p.err) return { ok: false, err: p.err };
        const now = Date.now();
        // Real-time lifecycle phases layered around the drive: loading the
        // goods at origin, unloading at destination, and (for sea routes)
        // paperwork + rolling the truck on/off the ferry at each dock.
        const loadSec = Math.round(120 + Math.random() * 180);       // 2–5 min loading
        const unloadSec = Math.round(180 + Math.random() * 180);     // 3–6 min unloading
        const ferryHops = (p.route && (p.route.ferrySegments
          || (p.route.ferrySegment ? [p.route.ferrySegment] : [])).length) || 0;
        const ferryBoardSec = ferryHops ? Math.round(300 + Math.random() * 300) : 0;   // 5–10 min customs + roll-on, per hop
        const ferryUnboardSec = ferryHops ? Math.round(240 + Math.random() * 120) : 0; // 4–6 min roll-off + papers, per hop
        // Board/roll-off happens at EVERY port — matches deliveryPhase, which
        // deducts (board+unboard) once per sea hop when building the timeline.
        const extraSec = loadSec + unloadSec + (ferryBoardSec + ferryUnboardSec) * ferryHops;
        const d = {
          id: uid('d'), truckId, fromCityId: t.cityId, toCityId, cargoType,
          cargoTons: p.tons, route: p.route, stops: p.stops,
          startedAt: now, endsAt: now + (p.durationSec + extraSec) * 1000, econ: p.econ, contractId,
          arriveFuelPct: p.arriveFuelPct, startFuelPct: p.startFuelPct,
          sleepBreaks: p.sleepBreaks, shortBreaks: p.shortBreaks, restHours: p.restHours,
          loadSec, unloadSec, ferryBoardSec, ferryUnboardSec,
        };
        // Record the corridor so it stays highlighted on the map — permanently.
        // Every route ever driven remains visible (deduped per city pair), so
        // the map slowly fills with the empire's whole network over time.
        const corrId = [d.fromCityId, toCityId].sort().join('~');
        const corridors = [{ id: corrId, fromCityId: d.fromCityId, toCityId, points: p.route.points },
        ...s.corridors.filter(c => c.id !== corrId)];
        set({
          deliveries: [...s.deliveries, d],
          corridors,
          trucks: s.trucks.map(x => x.id === truckId ? { ...x, status: 'delivering', driverId } : x),
          staff: s.staff.map(x => x.id === driverId ? { ...x, truckId } : x),
          boosts: { ...s.boosts, doubleNext: false },
          contracts: contractId
            ? s.contracts.map(c => c.id === contractId ? { ...c, status: 'inprogress', deliveryId: d.id } : c)
            : s.contracts,
        });
        const to = cityById(toCityId);
        const truckName = t.customName || modelById(t.modelId).name;
        play('start', 0.7);
        get().notify('delivery', 'truck-fast', `Delivery started to ${to.name} — ${p.route.roadKm} km by road.`);
        // Real OS notifications, scheduled at each fuel stop's ETA and at the
        // final drop-off, so the player hears about it even with the app closed.
        const span = d.endsAt - d.startedAt;
        (p.stops || []).forEach((stop, i) => {
          const ts = d.startedAt + span * (Math.min(1, (stop.atKm || 0) / Math.max(1, p.route.roadKm)));
          const f = flavor('fuelStop', { truck: truckName, station: stop.station?.name });
          scheduleAt(ts, `${d.id}-fuel-${i}`, f.title, f.body);
        });
        {
          const f = flavor('deliveryDone', { truck: truckName, city: to.name });
          scheduleAt(d.endsAt, `${d.id}-done`, f.title, f.body);
        }
        return { ok: true, delivery: d };
      },

      // Dispatch every idle (parked) truck that has an available driver, each to
      // a sensible destination — an available contract's city if any, else a
      // random reachable tier-1/2 city. Powers the "Depart All" quick action.
      departAll() {
        const s = get();
        const parked = s.trucks.filter(t => t.status === 'parked');
        if (!parked.length) return { ok: false, err: 'No parked trucks to dispatch' };
        const freeDrivers = s.staff.filter(x => x.role === 'driver' && !x.truckId).length;
        const assignedDrivers = parked.filter(t => t.driverId && s.staff.some(x => x.id === t.driverId)).length;
        if (freeDrivers + assignedDrivers === 0) return { ok: false, err: 'No available drivers — hire drivers first' };
        const contractCities = s.contracts.filter(c => c.status === 'available' && c.expiresAt > Date.now()).map(c => c.destCityId);
        const pool = CITIES.filter(c => c.tier <= 2);
        let dispatched = 0;
        for (const t of parked) {
          // choose a destination that isn't the truck's current city
          let destId = contractCities[dispatched % Math.max(1, contractCities.length)];
          if (!destId || destId === t.cityId) {
            const cand = pool[Math.floor((dispatched + 1) * 37 % pool.length)];
            destId = cand && cand.id !== t.cityId ? cand.id : pool.find(c => c.id !== t.cityId)?.id;
          }
          if (!destId) continue;
          const model = modelById(t.modelId);
          const r = get().startDelivery(t.id, destId, 'general', model.cargo);
          if (r.ok) dispatched++;
        }
        if (dispatched === 0) return { ok: false, err: 'Could not dispatch — check drivers and routes' };
        get().notify('delivery', 'truck-fast', `Depart All: dispatched ${dispatched} truck${dispatched > 1 ? 's' : ''}.`);
        return { ok: true, dispatched };
      },

      completeDelivery(deliveryId, silentTime = false) {
        const s = get();
        const d = s.deliveries.find(x => x.id === deliveryId);
        if (!d) return;
        const t = s.trucks.find(x => x.id === d.truckId);
        const to = cityById(d.toCityId);
        const contract = d.contractId ? s.contracts.find(c => c.id === d.contractId) : null;
        let reward = 0;
        if (contract) {
          const flavor = CONTRACT_FLAVORS.find(f => f.id === contract.flavorId);
          reward = Math.round(d.econ.gross * (flavor.mult - 1));
        }
        const drivingHours = t ? d.route.roadKm / modelById(t.modelId).speed : 0;
        const sleepH = (d.sleepBreaks || 0) * 2;
        const drvName = (t && s.staff.find(m => m.id === t.driverId)?.name) || null;
        const logEntry = {
          id: d.id, fromCityId: d.fromCityId, toCityId: d.toCityId,
          km: d.route.roadKm, net: d.econ.net, gross: d.econ.gross, ts: Date.now(),
          hours: Math.round(drivingHours * 10) / 10,
          // Full trip insight (v3.1.0): who drove, what it cost, line by line.
          driver: drvName, cargoType: d.cargoType, cargoTons: d.cargoTons,
          fuel: d.econ.fuel || 0, maint: d.econ.maint || 0, tolls: d.econ.tolls || 0,
          customs: d.econ.customs || 0, reward,
          ferry: !!(d.route.ferrySegments || []).length || !!d.route.ferrySegment,
        };
        // Occasional client gold tip on a finished delivery (~1 in 7).
        const goldTip = Math.random() < 0.15 ? 2 + Math.floor(Math.random() * 4) : 0;
        set({
          deliveries: s.deliveries.filter(x => x.id !== deliveryId),
          balance: s.balance + d.econ.net + reward,
          gold: s.gold + goldTip,
          trucks: s.trucks.map(x => x.id === d.truckId ? {
            ...x, status: 'parked', lat: to.lat, lng: to.lng, cityId: to.id,
            fuelPct: d.arriveFuelPct != null ? d.arriveFuelPct : Math.max(4, (x.fuelPct || 100) - 15),
            km: x.km + d.route.roadKm, deliveries: x.deliveries + 1,
            condition: Math.max(5, (x.condition == null ? 100 : x.condition) - d.route.roadKm * CONDITION_WEAR_PER_KM),
            log: [{ ...logEntry, truckName: modelById(x.modelId).name }, ...(x.log || [])].slice(0, 100),
          } : x),
          // Accumulate the driver's career stats (hours driven, sleep, deliveries).
          staff: s.staff.map(m => m.id === (t && t.driverId) ? {
            ...m,
            // Driver XP: distance-weighted, powers levels & perks (v2.4.0).
            xp: (m.xp || 0) + Math.round(d.route.roadKm / 8 + 20),
            hoursDriven: Math.round(((m.hoursDriven || 0) + drivingHours) * 10) / 10,
            sleepHours: Math.round(((m.sleepHours || 0) + sleepH) * 10) / 10,
            deliveries: (m.deliveries || 0) + 1,
            kmDriven: Math.round((m.kmDriven || 0) + d.route.roadKm),
            lastTripEndAt: Date.now(), // drives the "Tired — resting" mood
          } : m),
          history: [{
            ...logEntry, truckName: t ? modelById(t.modelId).name : '',
          }, ...s.history].slice(0, 60),
          stats: {
            ...s.stats,
            revenue: s.stats.revenue + d.econ.gross + reward,
            fuelSpend: s.stats.fuelSpend + d.econ.fuel,
            deliveries: s.stats.deliveries + 1,
            contracts: (s.stats.contracts || 0) + (contract ? 1 : 0),
            km: s.stats.km + d.route.roadKm,
            // Achievement feed: sea hops sailed & borders crossed this trip.
            ferries: (s.stats.ferries || 0) + ((d.route.ferrySegments || (d.route.ferrySegment ? [d.route.ferrySegment] : [])).length),
            borders: (s.stats.borders || 0) + (d.route.bordersCrossed || 0),
          },
          contracts: contract
            ? s.contracts.map(c => c.id === contract.id ? { ...c, status: 'done', rewardPaid: reward } : c)
            : s.contracts,
        });
        // Announce driver level-ups (perk unlocks) after the XP grant above.
        {
          const drvMember = t && s.staff.find(m => m.id === t.driverId);
          if (drvMember) {
            const before = driverLevel(drvMember.xp);
            const after = driverLevel((drvMember.xp || 0) + Math.round(d.route.roadKm / 8 + 20));
            if (after > before) {
              const perk = DRIVER_PERKS.find(p => p.level === after);
              get().notify('system', 'star-shooting', `${drvMember.name} reached driver level ${after}!${perk ? ` Perk unlocked: ${perk.name} — ${perk.desc}.` : ''}`);
            }
          }
        }
        play('coin', 0.9);
        get().logLedger('delivery', 'truck-check', `Delivery to ${to.name} (${d.route.roadKm} km)`, d.econ.net);
        if (reward) get().logLedger('contract', 'file-check', `Contract bonus · ${to.name}`, reward);
        get().notify('delivery', 'cash-check', `Delivered to ${to.name}: ${inr(d.econ.net)} earned.`);
        if (goldTip) get().notify('delivery', 'gold', `Happy client at ${to.name} tipped the driver +${goldTip} Gold!`);
        if (contract) get().notify('delivery', 'file-check', `Contract complete! Bonus reward ${inr(reward)}.`);
      },

      // ---------- staff ----------
      refreshCandidates() { set({ candidates: randomCandidates() }); },

      // Best workshop discount your mechanics earn on repair/service bills:
      // up to 30% at skill 99, doubled (capped 60%) while a freshly promoted
      // mechanic's 3-day boost is running. This is the "skill" stat at work.
      mechDiscount() {
        const s = get();
        const mechs = s.staff.filter(x => x.role === 'mechanic');
        if (!mechs.length) return 0;
        const best = mechs.reduce((a, x) => Math.max(a, x.skill || 0), 0);
        const promo = mechs.some(x => (x.promoBoostUntil || 0) > Date.now());
        return Math.min(0.6, (best / 100) * 0.3 * (promo ? 2 : 1));
      },

      // Manual promotion: junior → senior → expert. Salary lands somewhere in
      // the next level's min–max band, skill jumps into its band, and the
      // fresh-promotion buzz gives 3 days of 2× output (driving pace for
      // drivers, workshop discount for mechanics). Costs a one-time package.
      promoteStaff(staffId) {
        const s = get();
        const m = s.staff.find(x => x.id === staffId);
        if (!m) return { ok: false, err: 'Staff member not found' };
        const order = ['junior', 'senior', 'expert'];
        const idx = order.indexOf(m.level);
        if (idx === -1 || idx >= order.length - 1) return { ok: false, err: `${m.name} is already at the top level` };
        const next = STAFF_LEVELS.find(l => l.id === order[idx + 1]);
        const newSalary = Math.round(Math.max(m.salary * 1.1,
          next.salary[0] + Math.random() * (next.salary[1] - next.salary[0])) / 500) * 500;
        const newSkill = Math.min(99, Math.max((m.skill || 0) + 5,
          Math.round(next.skill[0] + Math.random() * (next.skill[1] - next.skill[0]))));
        const fee = Math.max(25000, (newSalary - m.salary) * 3); // one-time promotion package
        if (s.balance < fee) return { ok: false, err: `Need ${inr(fee)} for the promotion package` };
        set({
          balance: s.balance - fee,
          stats: { ...s.stats, promotions: (s.stats.promotions || 0) + 1 },
          staff: s.staff.map(x => x.id === staffId
            ? { ...x, level: next.id, salary: newSalary, skill: newSkill, promoBoostUntil: Date.now() + 3 * 24 * 3600 * 1000 }
            : x),
        });
        get().logLedger('staff', 'account-arrow-up', `Promotion package · ${m.name}`, -fee);
        get().notify('system', 'account-arrow-up',
          `${m.name} promoted to ${next.name}! ${inr(newSalary)}/mo · skill ${newSkill} · 2× ${m.role === 'driver' ? 'driving pace' : 'workshop efficiency'} for 3 days!`);
        play('coin', 0.8);
        return { ok: true, fee, newSalary, newSkill, level: next.name };
      },
      hire(candId) {
        const s = get();
        const c = s.candidates.find(x => x.id === candId);
        if (!c) return { ok: false, err: 'Candidate gone' };
        if (s.balance < c.bonus) return { ok: false, err: 'Cannot afford hiring bonus' };
        set({
          balance: s.balance - c.bonus,
          staff: [...s.staff, { ...c, hiredAt: Date.now(), truckId: null }],
          candidates: s.candidates.filter(x => x.id !== candId),
        });
        get().logLedger('staff', 'account-plus', `Signing bonus · ${c.name}`, -c.bonus);
        get().notify('system', 'account-plus', `${c.name} joined as ${c.level} ${c.role}.`);
        return { ok: true };
      },
      fire(staffId) {
        const s = get();
        const m = s.staff.find(x => x.id === staffId);
        set({ staff: s.staff.filter(x => x.id !== staffId) });
        if (m) get().notify('system', 'account-minus', `${m.name} has left the company.`);
      },
      assignDriver(staffId, truckId) {
        const s = get();
        set({
          staff: s.staff.map(x => x.id === staffId ? { ...x, truckId } : x),
          trucks: s.trucks.map(t => t.id === truckId ? { ...t, driverId: staffId }
            : t.driverId === staffId ? { ...t, driverId: null } : t),
        });
      },

      // ---------- marketing ----------
      launchCampaign(campaignId) {
        const s = get();
        const def = CAMPAIGNS.find(c => c.id === campaignId);
        const active = s.campaigns.some(a => a.campaignId === campaignId && a.endsAt > Date.now());
        if (active) return { ok: false, err: 'Campaign already running' };
        if (s.balance < def.cost) return { ok: false, err: 'Insufficient funds' };
        const dayMs = 24 * GAME_HOUR_MS / s.settings.speed;
        set({
          balance: s.balance - def.cost,
          campaigns: [...s.campaigns.filter(a => a.endsAt > Date.now()), {
            id: uid('mk'), campaignId, startedAt: Date.now(), endsAt: Date.now() + def.days * dayMs,
          }],
        });
        set({ stats: { ...get().stats, campaigns: (get().stats.campaigns || 0) + 1 } });
        get().logLedger('marketing', 'bullhorn', `Campaign · ${def.name}`, -def.cost);
        get().notify('system', 'bullhorn', `${def.name} launched! +${Math.round(def.boost * 100)}% revenue for ${def.days} days.`);
        return { ok: true };
      },
      // Cancel a running campaign early — refunds the unused portion of what
      // it cost, prorated by time remaining, so ending one to switch to a
      // better one isn't just a sunk loss.
      cancelCampaign(activeId) {
        const s = get();
        const a = s.campaigns.find(x => x.id === activeId);
        if (!a || a.endsAt <= Date.now()) return { ok: false, err: 'Campaign not active' };
        const def = CAMPAIGNS.find(c => c.id === a.campaignId);
        if (!def) return { ok: false, err: 'Unknown campaign' };
        const totalMs = a.endsAt - a.startedAt;
        const remainingFrac = Math.max(0, Math.min(1, (a.endsAt - Date.now()) / totalMs));
        const refund = Math.round(def.cost * remainingFrac * 0.5); // 50% of the unused-time value back
        set({
          balance: s.balance + refund,
          campaigns: s.campaigns.filter(x => x.id !== activeId),
        });
        if (refund > 0) get().logLedger('marketing', 'bullhorn-off', `Cancelled · ${def.name}`, refund);
        get().notify('system', 'bullhorn-off', `${def.name} cancelled${refund > 0 ? ` — ${inr(refund)} refunded` : ''}.`);
        return { ok: true, refund };
      },

      // ---------- contracts ----------
      acceptContract(contractId) {
        const s = get();
        const c = s.contracts.find(x => x.id === contractId);
        if (!c || c.status !== 'available') return { ok: false, err: 'Contract unavailable' };
        if (c.expiresAt < Date.now()) return { ok: false, err: 'Contract expired' };
        if (!s.trucks.some(t => t.status === 'parked')) return { ok: false, err: 'You need a parked truck to accept a contract' };
        return { ok: true, contract: c };
      },

      // ---------- world expansion (v1.4.0) ----------
      unlockCountry(code) {
        const s = get();
        const def = COUNTRY_BY_CODE[code];
        if (!def) return { ok: false, err: 'Unknown country' };
        const unlocked = s.unlockedCountries || ['IN'];
        if (unlocked.includes(code)) return { ok: false, err: `${def.name} is already unlocked` };
        if (s.balance < def.unlockCost) return { ok: false, err: `Need ${inr(def.unlockCost)} to expand into ${def.name}` };
        // Pay the entry cost, then hand back a welcome bonus (cash + gold).
        set({
          balance: s.balance - def.unlockCost + (def.bonusCash || 0),
          gold: s.gold + (def.bonusGold || 0),
          unlockedCountries: [...unlocked, code],
        });
        get().logLedger('expansion', 'flag-checkered', `Expanded into ${def.name}`, -def.unlockCost);
        if (def.bonusCash) get().logLedger('bonus', 'gift', `${def.name} welcome bonus`, def.bonusCash);
        get().notify('system', 'flag-checkered',
          `${def.name} unlocked! Welcome bonus: ${inr(def.bonusCash || 0)} + ${def.bonusGold || 0} Gold. New cities are open for delivery.`);
        play('coin', 0.9);
        return { ok: true, bonusCash: def.bonusCash || 0, bonusGold: def.bonusGold || 0 };
      },

      // ---------- rewarded ads ----------
      // Gold reward for watching a rewarded ad. Payout tier scales with how many
      // ads the player has watched: 0–4 → 10–20, 5–9 → 20–30, 10+ → 30–40.
      // Call ONLY after the ad SDK confirms the reward was earned.
      grantAdGold() {
        const s = get();
        const n = s.adGoldCount || 0;
        let lo = 10, hi = 20;
        if (n >= 10) { lo = 30; hi = 40; }
        else if (n >= 5) { lo = 20; hi = 30; }
        const amount = lo + Math.floor(Math.random() * (hi - lo + 1));
        set({ gold: s.gold + amount, adGoldCount: n + 1 });
        get().notify('system', 'gold', `+${amount} Gold — thanks for watching!`);
        play('coin', 0.9);
        return { ok: true, amount, nextTierAt: n + 1 < 5 ? 5 : n + 1 < 10 ? 10 : null };
      },

      // Speed up an active delivery by 25% of its remaining time (rewarded ad).
      // Watch enough and it finishes instantly. Call after the ad is earned.
      boostDeliveryWithAd(deliveryId) {
        const s = get();
        const d = s.deliveries.find(x => x.id === deliveryId);
        if (!d) return { ok: false, err: 'Delivery not found' };
        const now = Date.now();
        const cut = (d.endsAt - d.startedAt) * 0.25;
        const newEnds = d.endsAt - cut;
        if (newEnds <= now + 1500) {
          get().completeDelivery(deliveryId);
          return { ok: true, completed: true };
        }
        set({ deliveries: s.deliveries.map(x => x.id === deliveryId ? { ...x, endsAt: newEnds, adBoosts: (x.adBoosts || 0) + 1 } : x) });
        get().notify('delivery', 'fast-forward', `${cityById(d.toCityId)?.name || 'Delivery'} sped up 25% — the road clears ahead!`);
        return { ok: true, completed: false };
      },

      // Instantly repair a broken truck by watching an ad (call after earned).
      adRepairTruck(truckId) {
        const s = get();
        const t = s.trucks.find(x => x.id === truckId);
        if (!t || t.status !== 'broken') return { ok: false, err: 'Truck is not broken' };
        set({ trucks: s.trucks.map(x => x.id === truckId ? { ...x, status: 'parked' } : x) });
        get().notify('truck', 'wrench-check', `${t.customName || modelById(t.modelId).name} repaired free — thanks for watching!`);
        return { ok: true };
      },
      // Instantly finish a building truck by watching an ad (call after earned).
      adSkipBuild(truckId) {
        const s = get();
        const t = s.trucks.find(x => x.id === truckId && x.status === 'building');
        if (!t) return { ok: false, err: 'No truck under construction' };
        set({ trucks: s.trucks.map(x => x.id === truckId ? { ...x, status: 'parked', buildEndsAt: null } : x) });
        get().notify('truck', 'fast-forward', `${modelById(t.modelId).name} build finished instantly!`);
        return { ok: true };
      },

      // ---------- daily free-gold mini-games ----------
      // Remaining plays today (auto-resets each in-game day).
      gamesToday() {
        const s = get();
        const day = get().gameDay().day;
        const g = s.games && s.games.day === day ? s.games : { day, scratchUsed: 0, spinUsed: 0, diceUsed: 0, slotUsed: 0 };
        return {
          day,
          scratchLeft: Math.max(0, DAILY_PLAYS - g.scratchUsed),
          spinLeft: Math.max(0, DAILY_PLAYS - g.spinUsed),
          diceLeft: Math.max(0, DAILY_PLAYS - (g.diceUsed || 0)),
          slotLeft: Math.max(0, DAILY_PLAYS - (g.slotUsed || 0)),
          convoyLeft: Math.max(0, DAILY_PLAYS - (g.convoyUsed || 0)),
          betLeft: Math.max(0, DAILY_PLAYS - (g.betUsed || 0)),
          plateLeft: Math.max(0, DAILY_PLAYS - (g.plateUsed || 0)),
          tollLeft: Math.max(0, DAILY_PLAYS - (g.tollUsed || 0)),
          scratchUsed: g.scratchUsed, spinUsed: g.spinUsed, diceUsed: g.diceUsed || 0, slotUsed: g.slotUsed || 0, convoyUsed: g.convoyUsed || 0,
        };
      },
      _bumpGame(kind) {
        const day = get().gameDay().day;
        const s = get();
        const g = s.games && s.games.day === day ? { ...s.games } : { day, scratchUsed: 0, spinUsed: 0, diceUsed: 0, slotUsed: 0 };
        g[kind] = (g[kind] || 0) + 1;
        set({ games: g, stats: { ...get().stats, gamesPlayed: (get().stats.gamesPlayed || 0) + 1 } });
      },

      // Scratch card: 6 tiles (0–5 gold), a random rule decides the payout (≤5).
      playScratch() {
        const t = get().gamesToday();
        if (t.scratchLeft <= 0) return { ok: false, err: 'No scratch cards left today — come back tomorrow!' };
        const tiles = Array.from({ length: 6 }, () => Math.floor(Math.random() * 6)); // 0..5 each
        const rule = SCRATCH_RULES[Math.floor(Math.random() * SCRATCH_RULES.length)];
        const reward = clampGold(rule.calc(tiles));
        get()._bumpGame('scratchUsed');
        if (reward > 0) { set({ gold: get().gold + reward }); play('coin', 0.8); }
        get().notify('system', 'ticket-confirmation', `Scratch card: ${rule.label} → +${reward} Gold.`);
        return { ok: true, tiles, ruleId: rule.id, ruleLabel: rule.label, reward, left: t.scratchLeft - 1 };
      },

      // Lucky spin: weighted roulette → gold / speed boost / 2× next / nothing.
      playRoulette() {
        const t = get().gamesToday();
        if (t.spinLeft <= 0) return { ok: false, err: 'No spins left today — come back tomorrow!' };
        const total = ROULETTE_SEGMENTS.reduce((a, x) => a + x.w, 0);
        let roll = Math.random() * total, index = 0;
        for (let i = 0; i < ROULETTE_SEGMENTS.length; i++) { roll -= ROULETTE_SEGMENTS[i].w; if (roll <= 0) { index = i; break; } }
        const seg = ROULETTE_SEGMENTS[index];
        get()._bumpGame('spinUsed');
        const now = Date.now();
        if (seg.type === 'gold') { set({ gold: get().gold + seg.amount }); play('coin', 0.8); }
        else if (seg.type === 'speed') {
          set({ boosts: { ...get().boosts, speedUntil: now + 3600 * 1000 } });
          set({ deliveries: rescaleDeliveriesFaster(get().deliveries, now) });
        } else if (seg.type === 'double') {
          set({ boosts: { ...get().boosts, doubleNext: true } });
        }
        // No notify() here — the toast/notification would spoil the prize
        // while the wheel is still spinning. The UI calls revealGameResult()
        // once the animation lands.
        return { ok: true, index, prize: seg.type, label: seg.label, left: t.spinLeft - 1 };
      },

      // Called by a mini-game's UI AFTER its reveal animation finishes, so the
      // notification never leaks the result early.
      revealGameResult(icon, message) { get().notify('system', icon, message); },

      // Golden Convoy: 9 sealed containers, pick 3. Matching symbols pay by
      // tier — three-of-a-kind pays triple the symbol value, a pair pays it
      // once, no match pays 1 consolation Gold. Board is generated up front;
      // the reveal (and notification) happens in the UI, tap by tap.
      playConvoy() {
        const t = get().gamesToday();
        if (t.convoyLeft <= 0) return { ok: false, err: 'No convoy picks left today — come back tomorrow!' };
        const bag = [];
        CONVOY_SYMBOLS.forEach(sym => { for (let i = 0; i < sym.count; i++) bag.push(sym.id); });
        for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[bag[i], bag[j]] = [bag[j], bag[i]]; }
        const board = bag.slice(0, 9);
        set({ _convoyBoard: board });
        get()._bumpGame('convoyUsed');
        return { ok: true, board, left: t.convoyLeft - 1 };
      },
      claimConvoy(indices) {
        const s = get();
        const board = s._convoyBoard;
        if (!board || !Array.isArray(indices) || new Set(indices).size !== 3) return { ok: false, err: 'Pick 3 containers first' };
        const picked = indices.map(i => board[i]).filter(Boolean);
        const counts = {};
        picked.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
        const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
        const sym = CONVOY_SYMBOLS.find(x => x.id === best[0]);
        const reward = best[1] >= 3 ? sym.value * 3 : best[1] === 2 ? sym.value : 1;
        set({ gold: s.gold + reward, _convoyBoard: null });
        if (reward > 1) play('coin', 0.9);
        return { ok: true, reward, matched: best[1], symbol: sym.id };
      },

      // Dice roll: roll two dice, doubles pay out big, otherwise sum → small Gold.
      playDice() {
        const t = get().gamesToday();
        if (t.diceLeft <= 0) return { ok: false, err: 'No dice rolls left today — come back tomorrow!' };
        const d1 = 1 + Math.floor(Math.random() * 6), d2 = 1 + Math.floor(Math.random() * 6);
        const doubles = d1 === d2;
        const reward = clampGold(doubles ? d1 * 3 : Math.floor((d1 + d2) / 2));
        get()._bumpGame('diceUsed');
        if (reward > 0) { set({ gold: get().gold + reward }); play('coin', 0.8); }
        get().notify('system', 'dice-multiple', `Dice roll: ${d1} & ${d2} → +${reward} Gold.`);
        return { ok: true, d1, d2, doubles, reward, left: t.diceLeft - 1 };
      },

      // Slot Machine: 3 independent reels — 3-of-a-kind is the jackpot (payout
      // depends on which symbol, rarer = richer), a pair pays a token amount.
      playSlot() {
        const t = get().gamesToday();
        if (t.slotLeft <= 0) return { ok: false, err: 'No slot spins left today — come back tomorrow!' };
        const reels = [rollSlotSymbol(), rollSlotSymbol(), rollSlotSymbol()].map(x => x.id);
        const isJackpot = reels[0] === reels[1] && reels[1] === reels[2];
        const pairId = !isJackpot ? reels.find((v, i) => reels.indexOf(v) !== i) : null;
        const reward = isJackpot ? clampSlot(SLOT_JACKPOT[reels[0]]) : pairId ? 1 : 0;
        get()._bumpGame('slotUsed');
        if (reward > 0) set({ gold: get().gold + reward });
        // Notification + coin sound fire from the UI after the reels stop
        // (revealGameResult) so the result isn't spoiled mid-animation.
        const message = isJackpot ? `Slot Machine JACKPOT! ${reels[0]} ×3 → +${reward} Gold!`
          : reward > 0 ? `Slot Machine: pair of ${pairId} → +${reward} Gold.`
            : 'Slot Machine: no match — try again!';
        return { ok: true, reels, isJackpot, reward, message, left: t.slotLeft - 1 };
      },

      // Toll Gate Pick (v3.8.0) — free daily game replacing Slot Machine +
      // Golden Convoy. Pick 1 of 4 lanes; the lane's reward is decided up
      // front (server-authoritative, like the other games) so the UI reveal
      // never spoils it early.
      playTollGate() {
        const t = get().gamesToday();
        if (t.tollLeft <= 0) return { ok: false, err: 'No toll lanes left today — come back tomorrow!' };
        const total = TOLL_LANES.reduce((a, x) => a + x.weight, 0);
        let roll = Math.random() * total, lane = TOLL_LANES[0];
        for (const l of TOLL_LANES) { roll -= l.weight; if (roll <= 0) { lane = l; break; } }
        get()._bumpGame('tollUsed');
        if (lane.type === 'gold') set({ gold: get().gold + lane.amount });
        else if (lane.type === 'cash') { set({ balance: get().balance + lane.amount }); get().logLedger('bonus', 'cash', 'Toll Gate refund', lane.amount); }
        const message = lane.type === 'nothing' ? 'Toll Gate: waved straight through — nothing this time!'
          : lane.type === 'cash' ? `Toll Gate: the operator hands back ${inr(lane.amount)}!`
            : `Toll Gate: friendly wave and ${lane.label}!`;
        return { ok: true, laneId: lane.id, lane, message, left: t.tollLeft - 1 };
      },

      // High-Stakes Slots: the player picks a CASH bet with a slider, then the
      // same weighted reels spin. Three-of-a-kind pays bet × symbol jackpot,
      // a pair pays the bet back ×1.5, anything else loses the stake.
      playSlotBet(bet) {
        const s = get();
        const t = get().gamesToday();
        if (t.betLeft <= 0) return { ok: false, err: 'No high-stakes spins left today — come back tomorrow!' };
        const stake = Math.round(bet);
        if (!stake || stake < 10000) return { ok: false, err: 'Minimum bet is ₹10,000' };
        if (s.balance < stake) return { ok: false, err: 'Insufficient funds for this bet' };
        const reels = [rollSlotSymbol(), rollSlotSymbol(), rollSlotSymbol()].map(x => x.id);
        const isJackpot = reels[0] === reels[1] && reels[1] === reels[2];
        const pairId = !isJackpot ? reels.find((v, i) => reels.indexOf(v) !== i) : null;
        const winnings = isJackpot ? stake * SLOT_JACKPOT[reels[0]] : pairId ? Math.round(stake * 1.5) : 0;
        const net = winnings - stake;
        get()._bumpGame('betUsed');
        set({ balance: get().balance + net });
        get().logLedger('gamble', 'slot-machine', isJackpot ? 'High-Stakes Slots — JACKPOT!' : winnings ? 'High-Stakes Slots — pair' : 'High-Stakes Slots — lost bet', net);
        const message = isJackpot ? `High-Stakes JACKPOT! ${reels[0]} ×3 → won ${inr(winnings)}!`
          : winnings ? `High-Stakes Slots: pair → ${inr(winnings)} back on a ${inr(stake)} bet.`
            : `High-Stakes Slots: no match — ${inr(stake)} lost.`;
        return { ok: true, reels, isJackpot, stake, winnings, net, message, left: t.betLeft - 1 };
      },

      // Lucky Plate: a truck number plate is shown with 4 digits visible and
      // the last digit hidden. Guess the hidden digit for +8 Gold. The "trick"
      // (shh): the hidden digit is always the SUM of the visible digits mod 10
      // — crack the pattern and it pays out every single time.
      startPlate() {
        const t = get().gamesToday();
        if (t.plateLeft <= 0) return { ok: false, err: 'No plates left today — come back tomorrow!' };
        const digits = Array.from({ length: 4 }, () => Math.floor(Math.random() * 10));
        const series = ['GJ', 'MH', 'DL', 'KA', 'TN', 'RJ', 'UP', 'PB'][Math.floor(Math.random() * 8)];
        set({ _plate: { digits, answer: digits.reduce((a, b) => a + b, 0) % 10 } });
        get()._bumpGame('plateUsed');
        return { ok: true, digits, series, left: t.plateLeft - 1 };
      },
      guessPlate(guess) {
        const s = get();
        const p = s._plate;
        if (!p) return { ok: false, err: 'Start a new plate first' };
        const win = Number(guess) === p.answer;
        set({ _plate: null, gold: s.gold + (win ? 8 : 0) });
        if (win) play('coin', 0.9);
        get().notify('system', 'card-text', win ? `Lucky Plate: dead right — +8 Gold!` : `Lucky Plate: it was ${p.answer}. Study the plates closely...`);
        return { ok: true, win, answer: p.answer, reward: win ? 8 : 0 };
      },

      // ---------- bank & loans ----------
      creditScore() { return creditScoreOf(get().credit); },
      // Validate a proposed collateral pledge: enough value to cover
      // COLLATERAL_COVERAGE of the amount, no double-pledging, no HQ.
      _validateCollateral(amount, collateral) {
        const s = get();
        const col = collateral || { truckIds: [], hubCityIds: [] };
        const pledgedTrucks = pledgedTruckIds(s);
        const pledgedHubs = pledgedHubCityIds(s);
        for (const id of col.truckIds || []) {
          if (pledgedTrucks.has(id)) return { ok: false, err: 'One of the pledged trucks is already pledged on another loan' };
        }
        for (const id of col.hubCityIds || []) {
          if (pledgedHubs.has(id)) return { ok: false, err: 'One of the pledged garages is already pledged on another loan' };
          const h = (s.hubs || []).find(x => x.cityId === id);
          if (h && h.hq) return { ok: false, err: 'Your HQ can’t be pledged as collateral' };
        }
        const value = collateralTotalValue(s, col);
        const required = amount * COLLATERAL_COVERAGE;
        if (value < required) {
          return { ok: false, err: `Pledge more collateral — needs at least ${inr(Math.ceil(required - value))} more value` };
        }
        return { ok: true };
      },
      takeLoan(productId, collateral) {
        const s = get();
        const p = LOAN_PRODUCTS.find(x => x.id === productId);
        if (!p) return { ok: false, err: 'Unknown loan product' };
        if ((s.loans || []).length >= 2) return { ok: false, err: 'Maximum 2 active loans — repay one first' };
        if ((s.loans || []).some(l => l.productId === productId)) return { ok: false, err: 'You already have this loan running' };
        const score = creditScoreOf(s.credit);
        if (score < p.minScore) return { ok: false, err: `Credit score too low — need ${p.minScore}, you have ${score}` };
        const check = get()._validateCollateral(p.amount, collateral);
        if (!check.ok) return check;
        const { day } = get().gameDay();
        const totalDue = Math.round(p.amount * (1 + p.apr));
        const loan = {
          id: uid('ln'), productId, name: p.name, principal: p.amount,
          remaining: totalDue, emi: Math.round(totalDue / p.months),
          months: p.months, paidMonths: 0, lastEmiDay: day, since: Date.now(),
          collateral: { truckIds: [...(collateral?.truckIds || [])], hubCityIds: [...(collateral?.hubCityIds || [])] },
          missedStreak: 0,
        };
        set({ balance: s.balance + p.amount, loans: [...(s.loans || []), loan], stats: { ...s.stats, loansTaken: (s.stats.loansTaken || 0) + 1 } });
        get().logLedger('loan', 'bank-plus', `Loan disbursed · ${p.name}`, p.amount);
        get().notify('system', 'bank-plus', `${p.name} approved! ${inr(p.amount)} credited. EMI ${inr(loan.emi)} every ${LOAN_EMI_INTERVAL_DAYS} days × ${p.months}.`);
        play('coin', 0.9);
        return { ok: true, loan };
      },
      // Custom Loan: any slider-picked amount, terms computed live from the
      // amount + credit score (customLoanTerms) — same 2-loan cap and ledger
      // trail as the fixed catalog products.
      takeCustomLoan(amount, collateral) {
        const s = get();
        const amt = Math.round(amount);
        if ((s.loans || []).length >= 2) return { ok: false, err: 'Maximum 2 active loans — repay one first' };
        const score = creditScoreOf(s.credit);
        const max = customLoanMax(score);
        if (!amt || amt < CUSTOM_LOAN_MIN) return { ok: false, err: `Minimum loan is ${inr(CUSTOM_LOAN_MIN)}` };
        if (amt > max) return { ok: false, err: `Your credit score (${score}) caps custom loans at ${inr(max)}` };
        const check = get()._validateCollateral(amt, collateral);
        if (!check.ok) return check;
        const { day } = get().gameDay();
        const { apr, months, totalDue, emi } = customLoanTerms(amt, score);
        const loan = {
          id: uid('ln'), productId: 'custom', name: `Custom Loan (${inr(amt)})`, principal: amt,
          remaining: totalDue, emi, months, paidMonths: 0, lastEmiDay: day, since: Date.now(), apr,
          collateral: { truckIds: [...(collateral?.truckIds || [])], hubCityIds: [...(collateral?.hubCityIds || [])] },
          missedStreak: 0,
        };
        set({ balance: s.balance + amt, loans: [...(s.loans || []), loan], stats: { ...s.stats, loansTaken: (s.stats.loansTaken || 0) + 1 } });
        get().logLedger('loan', 'bank-plus', `Loan disbursed · ${loan.name}`, amt);
        get().notify('system', 'bank-plus', `${loan.name} approved! ${inr(amt)} credited. EMI ${inr(emi)} every ${LOAN_EMI_INTERVAL_DAYS} days × ${months}.`);
        play('coin', 0.9);
        return { ok: true, loan };
      },
      // Partial repayment: pay down some of the remaining balance without
      // settling the whole loan — recomputes paidMonths from what's left.
      payLoanPartial(loanId, amount) {
        const s = get();
        const ln = (s.loans || []).find(x => x.id === loanId);
        if (!ln) return { ok: false, err: 'Loan not found' };
        const amt = Math.round(amount);
        if (!amt || amt <= 0) return { ok: false, err: 'Enter an amount to repay' };
        if (amt > s.balance) return { ok: false, err: `Need ${inr(amt)} in balance to repay this` };
        if (amt > ln.remaining) return { ok: false, err: `Only ${inr(ln.remaining)} left owed on this loan` };
        const remaining = ln.remaining - amt;
        if (remaining <= 0) {
          set({
            balance: s.balance - amt,
            loans: s.loans.filter(x => x.id !== loanId),
            credit: { ...s.credit, paid: (s.credit?.paid || 0) + 1 },
          });
          get().logLedger('loan', 'bank-check', `Loan paid off · ${ln.name}`, -amt);
          get().notify('system', 'bank-check', `${ln.name} fully repaid — credit score up!`);
          return { ok: true };
        }
        const paidMonths = Math.max(0, Math.min(ln.months, ln.months - Math.ceil(remaining / ln.emi)));
        set({
          balance: s.balance - amt,
          loans: s.loans.map(x => x.id === loanId ? { ...x, remaining, paidMonths } : x),
        });
        get().logLedger('loan', 'bank', `Partial repayment · ${ln.name}`, -amt);
        get().notify('system', 'bank', `Paid ${inr(amt)} toward ${ln.name} — ${inr(remaining)} left.`);
        return { ok: true };
      },
      // Early settlement: clear the outstanding balance at a 2% rebate.
      prepayLoan(loanId) {
        const s = get();
        const ln = (s.loans || []).find(x => x.id === loanId);
        if (!ln) return { ok: false, err: 'Loan not found' };
        const cost = Math.round(ln.remaining * 0.98);
        if (s.balance < cost) return { ok: false, err: `Need ${inr(cost)} to settle this loan` };
        set({
          balance: s.balance - cost,
          loans: s.loans.filter(x => x.id !== loanId),
          credit: { ...s.credit, paid: (s.credit?.paid || 0) + 2 },
        });
        get().logLedger('loan', 'bank-check', `Loan settled early · ${ln.name}`, -cost);
        get().notify('system', 'bank-check', `${ln.name} settled early for ${inr(cost)} (2% rebate). Credit score up!`);
        return { ok: true, cost };
      },

      // ---------- charity drive (a deliberate cash/gold sink) ----------
      // Some players just accumulate more money/gold than they'll ever
      // spend — this is a no-benefit way to get rid of the excess. On
      // purpose: no reward, no reputation bump, nothing bought. Just gone.
      donateMoney(amount) {
        const s = get();
        const amt = Math.round(amount);
        if (!amt || amt <= 0) return { ok: false, err: 'Enter an amount to donate' };
        if (amt > s.balance) return { ok: false, err: `You only have ${inr(s.balance)}` };
        set({ balance: s.balance - amt, stats: { ...s.stats, donated: (s.stats.donated || 0) + amt } });
        get().logLedger('donation', 'hand-heart', 'Charity donation', -amt);
        get().notify('system', 'hand-heart', `Donated ${inr(amt)} to charity — no strings attached.`);
        return { ok: true };
      },
      donateGold(amount) {
        const s = get();
        const amt = Math.round(amount);
        if (!amt || amt <= 0) return { ok: false, err: 'Enter an amount to donate' };
        if (amt > s.gold) return { ok: false, err: `You only have ${s.gold} Gold` };
        set({ gold: s.gold - amt });
        get().logLedger('donation', 'hand-heart', 'Gold donated to charity', 0);
        get().notify('system', 'hand-heart', `Donated ${amt} Gold to charity.`);
        return { ok: true };
      },

      // ---------- fuel market ----------
      fuelToday() {
        const { day } = get().gameDay();
        const factor = fuelFactorForDay(day);
        const history = Array.from({ length: 7 }, (_, i) => fuelFactorForDay(Math.max(1, day - 6 + i)));
        return { day, factor, price: Math.round(ECON.dieselPrice * factor), base: ECON.dieselPrice, history };
      },

      // ---------- weekly challenges ----------
      // LIVE stat: lifetime stat + the in-flight share of every truck
      // currently on the road — km and revenue tick up in real time across
      // the whole fleet, not just when a delivery completes.
      _liveStat(key) {
        const s = get();
        let v = s.stats[key] || 0;
        if (key === 'km' || key === 'revenue') {
          const now = Date.now();
          for (const d of s.deliveries) {
            const prog = Math.max(0, Math.min(1, (now - d.startedAt) / (d.endsAt - d.startedAt)));
            if (key === 'km') v += d.route.roadKm * prog;
            else v += (d.econ.gross || 0) * prog;
          }
        }
        return Math.floor(v);
      },
      weeklyProgress() {
        const s = get();
        const w = s.weekly;
        if (!w) return [];
        return w.challenges.map(ch => ({
          ...ch,
          progress: Math.max(0, get()._liveStat(ch.key) - (w.snapshot[ch.key] || 0)),
          claimed: w.claimed.includes(ch.key),
        }));
      },
      claimWeekly(key) {
        const s = get();
        const w = s.weekly;
        if (!w) return { ok: false, err: 'No weekly challenges yet' };
        const ch = w.challenges.find(x => x.key === key);
        if (!ch) return { ok: false, err: 'Unknown challenge' };
        if (w.claimed.includes(key)) return { ok: false, err: 'Already claimed' };
        const progress = get()._liveStat(key) - (w.snapshot[key] || 0);
        if (progress < ch.target) return { ok: false, err: 'Not complete yet' };
        const claimed = [...w.claimed, key];
        const sweep = claimed.length === w.challenges.length && !w.jackpotPaid;
        set({
          gold: s.gold + ch.gold + (sweep ? WEEKLY_JACKPOT.gold : 0),
          balance: s.balance + ch.cash + (sweep ? WEEKLY_JACKPOT.cash : 0),
          weekly: { ...w, claimed, jackpotPaid: w.jackpotPaid || sweep },
        });
        get().logLedger('bonus', 'calendar-star', `Weekly challenge — ${ch.label}`, ch.cash);
        if (sweep) {
          get().logLedger('bonus', 'trophy-award', 'WEEKLY JACKPOT — clean sweep!', WEEKLY_JACKPOT.cash);
          get().notify('system', 'trophy-award', `CLEAN SWEEP! All weekly challenges done: jackpot +${WEEKLY_JACKPOT.gold} Gold + ${inr(WEEKLY_JACKPOT.cash)}!`);
        } else {
          get().notify('system', 'calendar-star', `Weekly challenge complete: +${ch.gold} Gold + ${inr(ch.cash)}.`);
        }
        play('coin', 1);
        return { ok: true, sweep };
      },
      dailyProgress() {
        const s = get();
        const d = s.daily;
        if (!d) return [];
        return d.challenges.map(ch => ({
          ...ch,
          progress: Math.max(0, get()._liveStat(ch.key) - (d.snapshot[ch.key] || 0)),
          claimed: d.claimed.includes(ch.key),
        }));
      },
      claimDaily(key) {
        const s = get();
        const d = s.daily;
        if (!d) return { ok: false, err: 'No daily challenges yet' };
        const ch = d.challenges.find(x => x.key === key);
        if (!ch) return { ok: false, err: 'Unknown challenge' };
        if (d.claimed.includes(key)) return { ok: false, err: 'Already claimed' };
        const progress = get()._liveStat(key) - (d.snapshot[key] || 0);
        if (progress < ch.target) return { ok: false, err: 'Not complete yet' };
        const claimed = [...d.claimed, key];
        const sweep = claimed.length === d.challenges.length && !d.jackpotPaid;
        set({
          gold: s.gold + ch.gold + (sweep ? DAILY_JACKPOT.gold : 0),
          balance: s.balance + ch.cash + (sweep ? DAILY_JACKPOT.cash : 0),
          daily: { ...d, claimed, jackpotPaid: d.jackpotPaid || sweep },
        });
        get().logLedger('bonus', 'calendar-today', `Daily challenge — ${ch.label}`, ch.cash);
        if (sweep) {
          get().logLedger('bonus', 'trophy-award', 'DAILY SWEEP — all challenges done!', DAILY_JACKPOT.cash);
          get().notify('system', 'trophy-award', `DAILY SWEEP! All today's challenges done: bonus +${DAILY_JACKPOT.gold} Gold + ${inr(DAILY_JACKPOT.cash)}!`);
        } else {
          get().notify('system', 'calendar-today', `Daily challenge complete: +${ch.gold} Gold + ${inr(ch.cash)}.`);
        }
        play('coin', 1);
        return { ok: true, sweep };
      },

      // One-time thank-you gift for removing the Stock Market feature —
      // claimed manually from the Rewards tab, not auto-granted, so the
      // player sees exactly why they got it.
      claimStockRemovalGift() {
        const s = get();
        if (s.settings?.stockRemovalGiftClaimed) return { ok: false, err: 'Already claimed' };
        const cashGift = 20000000, goldGift = 123;
        set({
          gold: s.gold + goldGift,
          balance: s.balance + cashGift,
          settings: { ...s.settings, stockRemovalGiftClaimed: true },
        });
        get().logLedger('bonus', 'gift', 'Stock Market removal — thank-you gift', cashGift);
        get().notify('system', 'gift', `Thanks for bearing with us — the Stock Market has been removed. +${inr(cashGift)} + ${goldGift} Gold credited!`);
        play('coin', 1);
        return { ok: true };
      },

      // ---------- gold exchange ----------
      // Cash out premium Gold into spendable ₹ (₹50,000 per Gold).
      convertGoldToCash(goldAmount) {
        const s = get();
        const amt = Math.floor(goldAmount);
        if (!amt || amt <= 0) return { ok: false, err: 'Choose how much Gold to exchange' };
        if (s.gold < amt) return { ok: false, err: 'Not enough Gold' };
        const cash = amt * GOLD_TO_CASH;
        set({ gold: s.gold - amt, balance: s.balance + cash });
        get().logLedger('gold', 'cash-plus', `Exchanged ${amt} Gold`, cash);
        get().notify('system', 'cash-plus', `Exchanged ${amt} Gold for ${inr(cash)} cash.`);
        return { ok: true, cash };
      },

      // ---------- power-ups ----------
      buyPowerup(pid, truckId) {
        const s = get();
        const p = POWERUPS.find(x => x.id === pid);
        if (p.cash) {
          if (s.balance < p.cash) return { ok: false, err: 'Insufficient funds' };
          set({ balance: s.balance - p.cash, gold: s.gold + p.goldGain });
          get().notify('system', 'gold', `+${p.goldGain} Gold purchased.`);
          return { ok: true };
        }
        if (s.gold < p.gold) return { ok: false, err: 'Not enough Gold — buy a Gold Pack' };
        set({ stats: { ...s.stats, goldSpent: (s.stats.goldSpent || 0) + p.gold } });
        if (pid === 'refuel') {
          if (!truckId) return { ok: false, err: 'Pick a truck first' };
          set({ gold: s.gold - p.gold, trucks: s.trucks.map(t => t.id === truckId ? { ...t, fuelPct: 100 } : t) });
        } else if (pid === 'speed') {
          set({ gold: s.gold - p.gold, boosts: { ...s.boosts, speedUntil: Date.now() + 3600 * 1000 } });
          // Retime active deliveries 2x faster — truck visibly speeds up
          // along the same path, no jump-ahead (rescaleDeliveriesFaster).
          set({ deliveries: rescaleDeliveriesFaster(get().deliveries, Date.now()) });
        } else if (pid === 'repair') {
          const r = get().repairTruck(truckId, true);
          if (!r.ok) return r;
        } else if (pid === 'double') {
          set({ gold: s.gold - p.gold, boosts: { ...s.boosts, doubleNext: true } });
        } else if (pid === 'skipbuild') {
          const t = s.trucks.find(x => x.id === truckId && x.status === 'building');
          if (!t) return { ok: false, err: 'No truck under construction selected' };
          set({ gold: s.gold - p.gold, trucks: s.trucks.map(x => x.id === truckId ? { ...x, status: 'parked', buildEndsAt: null } : x) });
          get().notify('truck', 'fast-forward', `${modelById(t.modelId).name} build skipped — ready now!`);
        } else if (pid === 'contracts') {
          // Reroll the board: fresh offers replace unclaimed ones; in-progress stay.
          const { day } = get().gameDay();
          set({ gold: s.gold - p.gold, contracts: [...s.contracts.filter(c => c.status !== 'available'), ...randomContracts(day)] });
        } else if (pid === 'shield') {
          set({ gold: s.gold - p.gold, boosts: { ...s.boosts, shieldUntil: Date.now() + 24 * 3600 * 1000 } });
        } else if (pid === 'refuel_all') {
          set({ gold: s.gold - p.gold, trucks: s.trucks.map(t => ({ ...t, fuelPct: 100 })) });
        } else if (pid === 'service_all') {
          set({ gold: s.gold - p.gold, trucks: s.trucks.map(t => ({ ...t, condition: 100 })) });
        }
        get().notify('system', 'star-four-points', `${p.name} activated.`);
        return { ok: true };
      },

      // ---------- notifications / settings ----------
      markRead(id) { set({ notifications: get().notifications.map(n => n.id === id ? { ...n, read: true } : n) }); },
      markAllRead() { set({ notifications: get().notifications.map(n => ({ ...n, read: true })) }); },
      saveSettings(patch) {
        set({ settings: { ...get().settings, ...patch } });
        if ('sound' in patch) setSoundEnabled(patch.sound !== false);
        if ('haptics' in patch) setHapticsEnabled(patch.haptics !== false);
        if ('musicVolume' in patch) setMusicVolume(patch.musicVolume);
        if ('sfxVolume' in patch) setSfxVolume(patch.sfxVolume);
        if ('hapticIntensity' in patch) setHapticsIntensity(patch.hapticIntensity);
        if ('notif' in patch) {
          const n = get().settings.notif || {};
          setNotificationsEnabled(n.delivery !== false || n.truck !== false);
        }
      },
      savePricing(patch) { set({ pricing: { ...get().pricing, ...patch } }); },
      saveCompany(patch) { set({ company: { ...get().company, ...patch } }); },

      // Hidden gem discovered — one-time only, big cash + gold reward.
      findEasterEgg(id) {
        const s = get();
        const egg = EASTER_EGGS.find(e => e.id === id);
        if (!egg) return { ok: false, err: 'Unknown easter egg' };
        const found = s.easterEggs?.found || [];
        if (found.includes(id)) return { ok: false, already: true };
        set({
          easterEggs: { found: [...found, id] },
          balance: s.balance + EASTER_EGG_REWARD.cash,
          gold: s.gold + EASTER_EGG_REWARD.gold,
        });
        get().logLedger('bonus', 'diamond-stone', `Hidden gem — "${egg.title}"`, EASTER_EGG_REWARD.cash);
        get().notify('system', 'diamond-stone', `Hidden gem found — "${egg.title}"! +₹1,00,00,00 & +${EASTER_EGG_REWARD.gold} Gold.`);
        play('coin', 1);
        return { ok: true, egg, reward: EASTER_EGG_REWARD, foundCount: found.length + 1, total: EASTER_EGGS.length };
      },

      setPhase(phase) { set({ phase }); },

      // ---------- cloud sync ----------
      // Replace local state with the authoritative copy loaded from the server.
      applyCloudState(data) {
        if (!data || typeof data !== 'object') return;
        const out = {};
        for (const k in data) if (typeof data[k] !== 'function') out[k] = data[k];
        set(out);
      },
      // Plain, function-free snapshot of current state for pushing to the server.
      cloudSnapshot() {
        const s = get();
        const out = {};
        for (const k in s) if (typeof s[k] !== 'function') out[k] = s[k];
        return out;
      },
    }),
    {
      name: 'truck-empire-save-v2',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => {
        // persist everything except transient function-free copies are automatic;
        // zustand persists only state, not actions.
        const { ...rest } = s;
        return rest;
      },
    }
  )
);
