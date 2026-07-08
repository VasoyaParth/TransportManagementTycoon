// Game store — single source of truth. Zustand + AsyncStorage persistence.
// Offline-first: everything is timestamp-based so elapsed real time while the
// app was closed is settled on load (deliveries complete, builds finish,
// campaigns expire, salaries get paid) — no backend, ever.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TRUCK_MODELS, CARGO_TYPES, CAMPAIGNS, POWERUPS, CONTRACT_FLAVORS } from '../data/trucks';
import { STAFF_NAMES, STAFF_LEVELS } from '../data/staffNames';
import { CITIES } from '../data/cities';
import { computeRoute, planFuelStops, cityById } from '../engine/routing';
import { deliveryEconomics, tripDurationSec, inr } from '../engine/economy';
import { play, setSoundEnabled } from '../engine/sound';
import { setHapticsEnabled } from '../engine/haptics';

export const GAME_HOUR_MS = 3600000; // 1 in-game hour = 1 real minute -> 1 day = 24 min
const SALARY_EVERY_DAYS = 30;
const CONTRACTS_PER_DAY = 6;

let idSeq = 1;
const uid = p => `${p}-${Date.now().toString(36)}-${(idSeq++).toString(36)}`;

export const modelById = id => TRUCK_MODELS.find(m => m.id === id);
export const cargoById = id => CARGO_TYPES.find(c => c.id === id);

function makeNotification(type, icon, message) {
  return { id: uid('n'), type, icon, message, ts: Date.now(), read: false };
}

function randomContracts(dayNumber, count = CONTRACTS_PER_DAY) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const flavor = CONTRACT_FLAVORS[Math.floor(Math.random() * CONTRACT_FLAVORS.length)];
    const pool = flavor.id === 'longhaul' ? CITIES.filter(c => c.tier === 1)
      : flavor.id === 'island' ? CITIES.filter(c => c.state.includes('Andaman') || c.state === 'Lakshadweep')
        : CITIES.filter(c => c.tier <= 2);
    const dest = pool[Math.floor(Math.random() * pool.length)];
    const cargoTons = 5 + Math.floor(Math.random() * 16);
    const expiresAt = Date.now() + (12 + Math.random() * 36) * 3600 * 1000;
    out.push({
      id: uid('c'), flavorId: flavor.id, day: dayNumber,
      destCityId: dest.id, cargoTons, mult: flavor.mult,
      expiresAt, status: 'available', deliveryId: null, rewardPaid: 0,
    });
  }
  return out;
}

function randomCandidates() {
  const out = [];
  for (let i = 0; i < 8; i++) {
    const role = ['driver', 'mechanic', 'manager'][Math.floor(Math.random() * 3)];
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
  trucks: [], // {id, modelId, status, lat, lng, cityId, fuelPct, buildEndsAt, buildTotalSec, km, deliveries, driverId, brokenSince}
  deliveries: [], // active: {id, truckId, fromCityId, toCityId, cargoType, cargoTons, route:{points,cum,roadKm,usesFerry}, stops, startedAt, endsAt, econ, contractId}
  history: [], // completed deliveries (most recent first, capped)
  staff: [],
  candidates: [],
  hubs: [], // {cityId, name, hq, since} — HQ + purchased garages/hubs
  corridors: [], // {id, fromCityId, toCityId, points} — unlocked/highlighted routes
  contracts: [],
  campaigns: [], // {id, campaignId, startedAt, endsAt}
  notifications: [],
  boosts: { speedUntil: 0, doubleNext: false },
  stats: { revenue: 0, fuelSpend: 0, deliveries: 0, km: 0 },
  clockStart: 0, // real ms when day 1 hour 0 began
  lastSalaryDay: 0,
  lastContractDay: 0,
  pricing: {}, // per-cargo ₹/km/t overrides; empty => each cargo uses its own default rate
  settings: {
    speed: 1, autosave: true, sound: true, haptics: true, showStations: true,
    difficulty: 'normal', events: 'rare', tutorialSeen: false,
    notif: { delivery: true, truck: true, fuel: true, collab: true, daily: true },
  },
  partners: [], // {code, name, since}
};

export const useGame = create(
  persist(
    (set, get) => ({
      ...initialState,

      // ---------- helpers ----------
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
          km: 0, deliveries: 0, driverId: null,
        };
        set({
          phase: 'game',
          company: { name, ceo, logo, avatar, hqCityId, code, createdAt: Date.now() },
          balance: startCapital - model.price,
          gold: 100,
          trucks: [truck],
          staff: [starterDriver()],
          hubs: [{ cityId: hq.id, name: hq.name + ' HQ', hq: true, since: Date.now() }],
          corridors: [],
          clockStart: Date.now(),
          lastSalaryDay: 0, lastContractDay: 0,
          contracts: randomContracts(1),
          candidates: randomCandidates(),
          notifications: [makeNotification('system', 'rocket-launch',
            `${name} is live! Your first ${model.name} is being built at ${hq.name}.`)],
        });
      },

      resetGame() {
        set({ ...initialState, phase: 'splash' });
      },

      // Settle everything that finished while app was closed (offline progress)
      settleOffline() {
        const s = get();
        if (s.phase !== 'game') return;
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

      // Runs every second from the game loop; also on load.
      dailyTick() {
        const s = get();
        if (s.phase !== 'game') return;
        const { day } = get().gameDay();
        // salaries every 30 in-game days
        if (day - s.lastSalaryDay >= SALARY_EVERY_DAYS && s.staff.length) {
          const total = s.staff.reduce((a, x) => a + x.salary, 0);
          set({ balance: s.balance - total, lastSalaryDay: day });
          get().notify('system', 'cash-minus', `Monthly salaries paid: ${inr(total)} to ${s.staff.length} staff.`);
        } else if (day - s.lastSalaryDay >= SALARY_EVERY_DAYS) {
          set({ lastSalaryDay: day });
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
            // Rare, impactful random events — frequency configurable in Settings.
            get().rollRandomEvent();
          }
        }
      },

      // Rare world events (goods stolen, accident, fuel spike, windfall).
      // settings.events: 'off' | 'rare' (~5%) | 'sometimes' (~12%).
      rollRandomEvent() {
        const s = get();
        const freq = s.settings.events || 'rare';
        const chance = freq === 'off' ? 0 : freq === 'sometimes' ? 0.12 : 0.05;
        if (Math.random() > chance) return;
        const pool = [];
        // Goods stolen — lose a small sum if you have cash.
        if (s.balance > 100000) pool.push(() => {
          const loss = Math.min(s.balance, Math.round(50000 + Math.random() * 200000));
          set({ balance: s.balance - loss });
          get().notify('system', 'shield-alert', `Cargo theft! Bandits stole goods worth ${inr(loss)} from a depot.`);
        });
        // Accident — a random on-road truck breaks down.
        const onRoad = s.trucks.filter(t => t.status === 'delivering' || t.status === 'parked');
        if (onRoad.length) pool.push(() => {
          const t = onRoad[Math.floor(Math.random() * onRoad.length)];
          // cancel its delivery if any, then mark broken
          const d = s.deliveries.find(x => x.truckId === t.id);
          set({
            deliveries: d ? s.deliveries.filter(x => x.id !== d.id) : s.deliveries,
            trucks: get().trucks.map(x => x.id === t.id ? { ...x, status: 'broken' } : x),
          });
          get().notify('truck', 'car-brake-alert', `Accident! ${modelById(t.modelId).name} broke down and needs repair.`);
        });
        // Fuel price spike — informational.
        pool.push(() => get().notify('system', 'gas-station', 'Fuel prices spiked nationwide — watch your margins today.'));
        // Windfall — small bonus.
        pool.push(() => {
          const bonus = Math.round(40000 + Math.random() * 120000);
          set({ balance: get().balance + bonus });
          get().notify('system', 'gift', `Loyal client bonus! You received ${inr(bonus)}.`);
        });
        pool[Math.floor(Math.random() * pool.length)]();
      },

      // ---------- fleet ----------
      buyTruck(modelId) {
        const s = get();
        const model = modelById(modelId);
        if (!model || s.balance < model.price) return { ok: false, err: 'Insufficient funds' };
        const hq = cityById(s.company.hqCityId);
        const truck = {
          id: uid('t'), modelId, status: 'building',
          lat: hq.lat, lng: hq.lng, cityId: hq.id, fuelPct: 100,
          buildEndsAt: Date.now() + model.build * 1000, buildTotalSec: model.build,
          km: 0, deliveries: 0, driverId: null,
        };
        set({ balance: s.balance - model.price, trucks: [...s.trucks, truck] });
        get().notify('truck', 'factory', `${model.name} ordered — building at HQ (${model.build}s).`);
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
          set({ gold: s.gold - 15 });
        } else {
          if (!hasMechanic) return { ok: false, err: 'Hire a mechanic to repair trucks (or use 15 Gold)' };
          const fee = Math.round(modelById(t.modelId).price * 0.04);
          if (s.balance < fee) return { ok: false, err: 'Insufficient funds for repair' };
          set({ balance: s.balance - fee });
        }
        set({ trucks: get().trucks.map(x => x.id === truckId ? { ...x, status: 'parked' } : x) });
        get().notify('truck', 'wrench-check', `${modelById(t.modelId).name} repaired and back in service.`);
        return { ok: true };
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
        get().notify('system', 'cash-refund', `Sold ${t.customName || modelById(t.modelId).name} for ${inr(value)}.`);
        return { ok: true, value };
      },

      // Customize a truck's livery: colour (hex), custom name, emblem icon.
      customizeTruck(truckId, patch) {
        set({ trucks: get().trucks.map(t => t.id === truckId ? { ...t, ...patch } : t) });
      },

      // Buy a regional hub/garage in a city — a new base for your operations.
      HUB_COST: 1500000,
      buyHub(cityId) {
        const s = get();
        if (s.hubs.some(h => h.cityId === cityId)) return { ok: false, err: 'You already have a hub here' };
        if (s.balance < 1500000) return { ok: false, err: 'Insufficient funds (need ₹15,00,000)' };
        const city = cityById(cityId);
        set({
          balance: s.balance - 1500000,
          hubs: [...s.hubs, { cityId, name: city.name + ' Hub', hq: false, since: Date.now() }],
        });
        get().notify('system', 'garage', `New hub opened in ${city.name}! Your network is growing.`);
        return { ok: true };
      },

      // ---------- deliveries ----------
      previewDelivery(truckId, toCityId, cargoType, cargoTons) {
        const s = get();
        const t = s.trucks.find(x => x.id === truckId);
        if (!t) return { err: 'Truck not found' };
        const model = modelById(t.modelId);
        const to = cityById(toCityId);
        const route = computeRoute(t.lat, t.lng, to.lat, to.lng);
        if (!route) return { err: 'No road or ferry connection reaches this destination yet. Island routes need a ferry link.' };
        if (route.usesFerry && route.roadKm > 3500) return { err: 'This route is beyond practical reach for now.' };
        const stops = planFuelStops(route, model);
        const cargo = cargoById(cargoType);
        const tons = Math.min(cargoTons, model.cargo);
        const rate = s.pricing[cargoType] != null ? s.pricing[cargoType] : cargo.rate;
        const econ = deliveryEconomics({
          model, distanceKm: route.roadKm, cargoTons: tons, rate,
          boosts: { marketing: get().marketingBoost(), doubleNext: s.boosts.doubleNext },
        });
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
        const speedBoost = s.boosts.speedUntil > Date.now() ? 2 : 1;
        // Each auto-refuel stop costs ~1 in-game hour of real time.
        const durationSec = tripDurationSec(model, route.roadKm, speedBoost) + refuelCount * 60;
        return { route, stops, econ, durationSec, tons, model, to, arriveFuelPct, refuelCount };
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
        const d = {
          id: uid('d'), truckId, fromCityId: t.cityId, toCityId, cargoType,
          cargoTons: p.tons, route: p.route, stops: p.stops,
          startedAt: now, endsAt: now + p.durationSec * 1000, econ: p.econ, contractId,
          arriveFuelPct: p.arriveFuelPct,
        };
        // Record the corridor so it stays highlighted on the map (cap 8, dedup).
        const corrId = [d.fromCityId, toCityId].sort().join('~');
        const corridors = [{ id: corrId, fromCityId: d.fromCityId, toCityId, points: p.route.points },
        ...s.corridors.filter(c => c.id !== corrId)].slice(0, 8);
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
        play('start', 0.7);
        get().notify('delivery', 'truck-fast', `Delivery started to ${to.name} — ${p.route.roadKm} km by road.`);
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
        set({
          deliveries: s.deliveries.filter(x => x.id !== deliveryId),
          balance: s.balance + d.econ.net + reward,
          trucks: s.trucks.map(x => x.id === d.truckId ? {
            ...x, status: 'parked', lat: to.lat, lng: to.lng, cityId: to.id,
            fuelPct: d.arriveFuelPct != null ? d.arriveFuelPct : Math.max(4, (x.fuelPct || 100) - 15),
            km: x.km + d.route.roadKm, deliveries: x.deliveries + 1,
          } : x),
          history: [{
            id: d.id, fromCityId: d.fromCityId, toCityId: d.toCityId,
            km: d.route.roadKm, net: d.econ.net, gross: d.econ.gross, ts: Date.now(),
            truckName: t ? modelById(t.modelId).name : '',
          }, ...s.history].slice(0, 30),
          stats: {
            revenue: s.stats.revenue + d.econ.gross + reward,
            fuelSpend: s.stats.fuelSpend + d.econ.fuel,
            deliveries: s.stats.deliveries + 1,
            km: s.stats.km + d.route.roadKm,
          },
          contracts: contract
            ? s.contracts.map(c => c.id === contract.id ? { ...c, status: 'done', rewardPaid: reward } : c)
            : s.contracts,
        });
        play('coin', 0.9);
        get().notify('delivery', 'cash-check', `Delivered to ${to.name}: ${inr(d.econ.net)} earned.`);
        if (contract) get().notify('delivery', 'file-check', `Contract complete! Bonus reward ${inr(reward)}.`);
      },

      // ---------- staff ----------
      refreshCandidates() { set({ candidates: randomCandidates() }); },
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
        get().notify('system', 'bullhorn', `${def.name} launched! +${Math.round(def.boost * 100)}% revenue for ${def.days} days.`);
        return { ok: true };
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
        if (pid === 'refuel') {
          if (!truckId) return { ok: false, err: 'Pick a truck first' };
          set({ gold: s.gold - p.gold, trucks: s.trucks.map(t => t.id === truckId ? { ...t, fuelPct: 100 } : t) });
        } else if (pid === 'speed') {
          set({ gold: s.gold - p.gold, boosts: { ...s.boosts, speedUntil: Date.now() + 3600 * 1000 } });
          // retime active deliveries 2x faster for remaining distance
          const now = Date.now();
          set({ deliveries: get().deliveries.map(d => ({ ...d, endsAt: now + (d.endsAt - now) / 2 })) });
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
      },
      savePricing(patch) { set({ pricing: { ...get().pricing, ...patch } }); },
      saveCompany(patch) { set({ company: { ...get().company, ...patch } }); },

      // ---------- collaboration (offline-stub: local partners registry) ----------
      addPartner(code) {
        const s = get();
        if (!code || code === s.company.code) return { ok: false, err: 'Enter a valid partner code' };
        if (s.partners.some(p => p.code === code)) return { ok: false, err: 'Already partnered' };
        set({ partners: [...s.partners, { code, name: 'Partner ' + code, since: Date.now() }] });
        get().notify('system', 'handshake', `Collaboration request sent to ${code}. Partnership active locally; syncs when online play arrives.`);
        return { ok: true };
      },
      endPartner(code) { set({ partners: get().partners.filter(p => p.code !== code) }); },

      setPhase(phase) { set({ phase }); },
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
