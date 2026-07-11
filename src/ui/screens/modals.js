// Modal flows — all rendered inside the shared <Sheet>. New delivery, truck
// detail, buy truck, contracts, power-ups, notifications, settings.
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, ScrollView, FlatList, Pressable, TextInput, StyleSheet, Switch, Animated, Easing, Linking, Share, Platform, PermissionsAndroid } from 'react-native';
import ViewShot from 'react-native-view-shot';
import RNShare from 'react-native-share';
import QRCode from 'react-native-qrcode-svg';
import { Camera } from 'react-native-camera-kit';
import { buildQrFrames, createQrReceiver } from '../../net/qrBackup';
import Svg, { Polyline, Circle, Path, G, Text as SvgText } from 'react-native-svg';
import { C, FONT, RADIUS } from '../theme';
import { Card, Btn, IconBtn, Pill, Progress, Money, Stat, Row, Icon, useToast, relTime, Sheet, statusMeta, Skeleton, useEasterEggTap, GameSlider } from '../components';
import { useGame, modelById, cargoById, hubCostForCity, hubMaintForCity, GAME_HOUR_MS, GOLD_TO_CASH, ROULETTE_SEGMENTS, DAILY_PLAYS, SLOT_SYMBOLS, TOLL_LANES, EASTER_EGGS, incidentMeta, deliveryPhase, PHASE_LABELS, ACHIEVEMENTS, ACHIEVEMENT_TIERS, ACHIEVEMENT_TIER_GOLD, achievementValue, staffMood, WEATHER_KINDS, weatherRadiusAt, fuelFactorForDay, companyXP, companyLevelOf, companyXpForLevel, companyTitleOf, creditScoreOf, driverLevel, truckDealFor, dealPriceFor, pledgedHubCityIds, stockYearReturn, stockReturnOverDays, STOCK_TIMEFRAMES,
  liveStockPrice, isMarketOpen, fakeTradeFor, STARTUP_SOUNDS, stockFundamentals } from '../../store/gameStore';
import { haptic } from '../../engine/haptics';
import { play } from '../../engine/sound';
import { cityById, suggestDestinations, routeCities } from '../../engine/routing';
import { CITIES } from '../../data/cities';
import { STAFF_ROLES, STAFF_LEVELS, STAFF_AVATAR } from '../../data/staffNames';
import { TRUCK_MODELS, CARGO_TYPES, POWERUPS, CONTRACT_FLAVORS, LOGOS, AVATARS, TRUCK_COLORS, TRUCK_LOGOS, CAMPAIGNS } from '../../data/trucks';
import { inr, inrShort } from '../../engine/economy';
import { APP_VERSION, checkForUpdate, fmtMB, cmpVer } from '../../net/updates';
import { exportBackup, parseBackup, readAutoBackup, pickBackupFile } from '../../engine/backup';
import { COUNTRIES, COUNTRY_BY_CODE } from '../../data/expansion';
import { TruckTopShapes, truckShapes, bodyTypeFor, defaultBodyColor } from '../truckArt';
import { BrandEmblem } from '../BrandLogo';

// Same top-down truck artwork as the map, framed for list/detail cards.
function TruckArtBadge({ model, color, size = 56, bg }) {
  const bt = bodyTypeFor(model);
  const body = color || defaultBodyColor(model);
  const { w, h } = truckShapes(bt, body, '#9DB2D6');
  const scale = (size - 8) / h;
  return (
    <View style={{ width: size, height: size, borderRadius: 14, backgroundColor: bg || C.bgSoft,
      alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={w * scale} height={size - 8} viewBox={`0 0 ${w} ${h}`}>
        <TruckTopShapes type={bt} body={body} accent="#9DB2D6" />
      </Svg>
    </View>
  );
}

const propMeta = {
  diesel: { color: C.amber, bg: C.amberSoft, icon: 'gas-station', label: 'Diesel' },
  electric: { color: C.green, bg: C.greenSoft, icon: 'lightning-bolt', label: 'Electric' },
  hybrid: { color: C.blue, bg: C.blueSoft, icon: 'leaf', label: 'Hybrid' },
};

function Stars({ rating, size = 13 }) {
  return (
    <Row>
      {[1, 2, 3, 4, 5].map(i => (
        <Icon key={i} name={rating >= i ? 'star' : rating >= i - 0.5 ? 'star-half-full' : 'star-outline'}
          size={size} color={C.amber} />
      ))}
    </Row>
  );
}

function useTick(active, ms = 1000) {
  const [, set] = useState(0);
  useEffect(() => {
    if (!active) return;
    const iv = setInterval(() => set(x => x + 1), ms);
    return () => clearInterval(iv);
  }, [active]);
}

// Human-readable duration: "2h 21m", "34m 10s", "45s".
function fmtDur(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// Absolute clock time for a timestamp, e.g. "14:32" (adds the date if not today).
function fmtWhen(ts) {
  const dt = new Date(ts), now = new Date();
  const time = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
  return dt.toDateString() === now.toDateString() ? time
    : `${dt.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} ${time}`;
}

// hh:mm:ss duration, e.g. 4200 -> "01:10:00".
function fmtClock(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const pad = n => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

// Pseudo-random live driving speed around the model's top speed, changing
// every ~1.5s so the gauge feels alive (e.g. 60 then 45 then 72 km/h) — but
// smoothed as a damped random walk (keyed by truck id) so it never jumps more
// than ~8% of base per tick, instead of picking a fresh independent value.
const _speedCache = {};
function liveSpeed(base, key) {
  const t = Math.floor(Date.now() / 1500);
  const c = _speedCache[key];
  if (c && c.t === t) return c.v;
  const prev = c ? c.v : base;
  const n = Math.sin(t * 12.9898) * 43758.5453;
  const rnd = n - Math.floor(n);
  const target = base * (0.62 + rnd * 0.5);
  const step = base * 0.08;
  const v = Math.max(20, Math.round(prev + Math.max(-step, Math.min(step, target - prev))));
  _speedCache[key] = { v, t };
  return v;
}

// While a delivery is paused — loading/unloading, ferry legs, an incident, an
// auto-refuel halt, or a driver break — the truck is physically parked, so the
// speed gauge must read 0 instead of pretending it's still cruising. Break and
// fuel windows are approximated from the journey waypoints' clock times plus
// each stop's dwell duration (fuel stops cost 60 real seconds in startDelivery;
// rest breaks are game-hours long).
// `atKm` (when non-null) is where the odometer must FREEZE while stopped —
// so the trip readout stops counting km during a halt instead of creeping up.
const STOP_LABELS = { fuel: 'Refuelling at a fuel stop', sleep: 'Driver on a sleep break', short: 'Driver on a short break' };
function deliveryStop(d, model, now = Date.now()) {
  const total = d.route.roadKm;
  const ph = deliveryPhase(d, now);
  if (d.incident && d.incident.resolveAt > now) {
    return { stopped: true, label: incidentMeta(d.incident.type).title, atKm: Math.round(total * ph.frac) };
  }
  if (ph.phase !== 'driving' && ph.phase !== 'done') {
    // Ferry sailing still covers distance (the boat moves); everything else
    // is pinned to the phase's fixed route position.
    const atKm = ph.phase === 'ferry' ? null : Math.round(total * ph.frac);
    return { stopped: true, label: PHASE_LABELS[ph.phase], atKm };
  }
  const DWELL = { fuel: 60 * 1000, sleep: 2 * GAME_HOUR_MS, short: (5 / 60) * GAME_HOUR_MS };
  // CRITICAL: pass [] so buildJourney skips the expensive per-city route scan
  // — deliveryStop only needs fuel/sleep/short waypoints (never city ones),
  // but this call runs every second from the live panel, so it silently
  // re-triggered the same lag JourneyTracker had, on every tick, on every
  // truck, even when the timeline was never opened.
  const j = buildJourney(d, model, now, []);
  for (const w of j.waypoints) {
    const dwell = DWELL[w.type];
    if (dwell && now >= w.ts && now < w.ts + dwell) {
      return { stopped: true, label: STOP_LABELS[w.type], atKm: w.atKm };
    }
  }
  return { stopped: false, label: null, atKm: null };
}

// Semicircular gauge (speed / fuel) — pure SVG.
function Gauge({ value, max, label, unit, color = C.blue }) {
  const W = 120, H = 74, cx = W / 2, cy = 66, R = 48;
  const f = Math.max(0, Math.min(1, value / max));
  const pt = (frac) => {
    const th = Math.PI * (1 - frac);
    return [cx + R * Math.cos(th), cy - R * Math.sin(th)];
  };
  const [bx0, by0] = pt(0), [bx1, by1] = pt(1);
  const [vx, vy] = pt(f);
  const bg = `M ${bx0} ${by0} A ${R} ${R} 0 0 1 ${bx1} ${by1}`;
  const val = `M ${bx0} ${by0} A ${R} ${R} 0 0 1 ${vx} ${vy}`;
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Svg width={W} height={H}>
        <Path d={bg} stroke={C.border} strokeWidth={9} fill="none" strokeLinecap="round" />
        <Path d={val} stroke={color} strokeWidth={9} fill="none" strokeLinecap="round" />
      </Svg>
      <View style={{ position: 'absolute', top: 30, alignItems: 'center' }}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: C.text }}>{Math.round(value)}</Text>
        <Text style={FONT.tiny}>{unit}</Text>
      </View>
      <Text style={[FONT.sub, { fontWeight: '700', marginTop: 2 }]}>{label}</Text>
    </View>
  );
}

// One step in the Amazon-style shipment tracker (vertical timeline).
function TrackerStep({ icon, color, title, sub, done, active, line }) {
  return (
    <Row style={{ alignItems: 'flex-start' }}>
      <View style={{ alignItems: 'center', width: 30 }}>
        <View style={{
          width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
          backgroundColor: (done || active) ? color : C.bgSoft,
          borderWidth: active ? 2 : 0, borderColor: '#fff',
        }}>
          <Icon name={done ? 'check' : icon} size={15} color={(done || active) ? '#fff' : C.faint} />
        </View>
        {line && <View style={{ width: 2, flex: 1, minHeight: 22, backgroundColor: done ? color : C.border, marginVertical: 2 }} />}
      </View>
      <View style={{ flex: 1, marginLeft: 10, paddingBottom: line ? 8 : 0 }}>
        <Text style={[FONT.body, { fontWeight: active ? '800' : '600', color: (done || active) ? C.text : C.sub }]}>{title}</Text>
        {sub ? <Text style={FONT.tiny}>{sub}</Text> : null}
      </View>
    </Row>
  );
}

// Build the full A→Z journey for a live delivery: origin, every city the
// corridor passes through, fuel/charge halts, sleep breaks (~2h) and short
// breaks (~5m) — all placed at their real distance-along-route and marked
// reached / current / upcoming against how far the truck has actually driven.
// Funny warehouse-crew lines for the pre-departure loading step — picked
// deterministically per delivery so the line doesn't change every second.
const LOADING_GAGS = [
  'Bubble-wrapping everything. Even the driver.',
  'Duct tape: applied generously and with confidence.',
  'Playing real-life Tetris with the crates…',
  'Forklift driver showing off again.',
  'Triple-checking the manifest over a cutting chai.',
  'That one box that just won’t fit… making it fit.',
  'Strapping it down like it owes us money.',
];
const gagFor = (id) => { let h = 0; for (let i = 0; i < (id || '').length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0; return LOADING_GAGS[h % LOADING_GAGS.length]; };

// EXPENSIVE part isolated: routeCities() scans every city in the game
// against every point of the route (can be O(cities × route points) — huge
// on a long haul). Callers MUST memoize this per delivery id so it runs
// once, not on every 1s tick (that was the "opens after 3s then lags" bug).
function journeyRouteCities(d) {
  try { return routeCities(d.route); } catch (e) { return []; }
}
function buildJourney(d, model, now = Date.now(), cachedCities = null) {
  const total = d.route.roadKm;
  const dur = d.endsAt - d.startedAt;
  const prog = dur > 0 ? Math.min(1, Math.max(0, (now - d.startedAt) / dur)) : 0;
  // Route position is PHASE-aware (frozen at 0 while loading, at 1 while
  // unloading, pinned at each dock) — not raw elapsed time — so the km
  // readout never creeps while the truck is stood still.
  const kmNow = total * deliveryPhase(d, now).frac;
  const speed = model.speed || 60;
  const loadDoneTs = d.startedAt + (d.loadSec || 0) * 1000;
  const wp = [];
  // Step 0: loading & packing at the warehouse — before pickup/departure.
  wp.push({ type: 'loadprep', atKm: 0, title: `Loading goods · ${cityById(d.fromCityId)?.name || 'Origin'}`,
    sub: gagFor(d.id), icon: 'package-variant', color: C.amber,
    tsOverride: d.startedAt, passedOverride: now >= loadDoneTs });
  wp.push({ type: 'origin', atKm: 0, title: `Picked up · ${cityById(d.fromCityId)?.name || 'Origin'}`, sub: 'Departed origin', icon: 'package-variant-closed', color: C.green,
    tsOverride: loadDoneTs, passedOverride: now >= loadDoneTs });
  for (const rc of (cachedCities || journeyRouteCities(d))) {
    wp.push({ type: 'city', atKm: rc.atKm, title: rc.city.name, sub: `${rc.city.state} · on route`, icon: 'map-marker', color: C.blue });
  }
  (d.stops || []).forEach((s, i) => {
    wp.push({ type: 'fuel', atKm: s.atKm, title: s.station?.name || `Fuel stop ${i + 1}`,
      sub: model.propulsion === 'electric' ? 'Charging halt' : 'Refuel halt', icon: 'gas-station', color: C.amber });
  });
  for (let i = 1; i <= (d.sleepBreaks || 0); i++) {
    wp.push({ type: 'sleep', atKm: Math.round(i * 8.5 * speed), title: `Sleep break ${i}`, sub: '~2h mandatory rest', icon: 'sleep', color: C.blue });
  }
  for (let j = 1; j <= (d.shortBreaks || 0); j++) {
    const atKm = Math.round(j * 2.5 * speed);
    if (wp.some(w => w.type === 'sleep' && Math.abs(w.atKm - atKm) < speed * 0.6)) continue;
    wp.push({ type: 'short', atKm, title: `Short break ${j}`, sub: '~5 min stop', icon: 'coffee-outline', color: C.sub });
  }
  // Ferry crossings: a board + roll-off waypoint per sea hop, named after the
  // actual port nodes the route passes through (in order).
  const ferrySegs = d.route.ferrySegments || (d.route.ferrySegment ? [d.route.ferrySegment] : []);
  if (ferrySegs.length) {
    const portName = id => id ? id.replace(/-port$/, '').split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : null;
    const portIds = (d.route.nodeIds || []).filter(id => /-port$/.test(id) || id === 'port-blair' || id === 'kavaratti' || id === 'rameswaram');
    ferrySegs.forEach((fs, i) => {
      const a = portName(portIds[2 * i]), b = portName(portIds[2 * i + 1]);
      wp.push({ type: 'port', atKm: Math.round(fs.startFrac * total), title: `Board ferry${a ? ` · ${a} Port` : ''}`, sub: 'Roll-on at the dock', icon: 'ferry', color: '#0E4C7A' });
      wp.push({ type: 'port', atKm: Math.round(fs.endFrac * total), title: `Leave ferry${b ? ` · ${b} Port` : ''}`, sub: 'Roll-off — back on the road', icon: 'anchor', color: '#0E4C7A' });
    });
  }
  wp.push({ type: 'dest', atKm: total, title: `Deliver to ${cityById(d.toCityId)?.name || 'Destination'}`, sub: prog >= 1 ? 'Arrived' : 'Pending arrival', icon: 'map-marker-check', color: C.green });

  const waypoints = wp.filter(w => w.atKm >= 0 && w.atKm <= total).sort((a, b) => a.atKm - b.atKm);
  // Every waypoint gets a clock time — proportional along the trip's real-time
  // span, same time-compression model the progress bar already uses. Passed
  // stops show when they were actually/estimated reached; the upcoming one
  // shows its estimated arrival.
  waypoints.forEach(w => {
    w.passed = w.passedOverride != null ? w.passedOverride : w.atKm <= kmNow + 0.5;
    w.ts = w.tsOverride != null ? w.tsOverride : d.startedAt + (total > 0 ? (w.atKm / total) * dur : 0);
  });
  const nextIdx = waypoints.findIndex(w => !w.passed);
  const lastReached = [...waypoints].reverse().find(w => w.passed);
  const nextBreak = waypoints.find(w => !w.passed && (w.type === 'sleep' || w.type === 'short' || w.type === 'fuel'));
  return { total, prog, kmNow: Math.round(kmNow), waypoints, nextIdx, lastReached, nextBreak, speed };
}

// Renders the buildJourney() waypoints as the vertical shipment timeline, with
// the truck's live position highlighted between reached and upcoming stops.
// Long routes can carry dozens of waypoints (every city + every fuel/sleep/
// short stop) — rendering them all inline made the modal heavy and laggy.
// Collapsed by default to just the reached-so-far + next stop; "Show full
// timeline" expands the rest inside its own bounded, internally-scrolling
// box instead of growing the whole sheet.
const TIMELINE_COLLAPSED_COUNT = 3;
function JourneyTracker({ delivery, model }) {
  // Memoized per delivery id — the expensive city scan runs ONCE for this
  // trip, not on every re-render/tick. Route is fixed for the life of a
  // delivery, so this is always safe to cache.
  const cachedCities = useMemo(() => journeyRouteCities(delivery), [delivery.id]);
  const j = buildJourney(delivery, model, Date.now(), cachedCities);
  const eta = fmtDur((delivery.endsAt - Date.now()) / 1000);
  const phase = deliveryPhase(delivery);
  const [expanded, setExpanded] = useState(false);
  const collapsedStart = Math.max(0, j.nextIdx - 1);
  const collapsedEnd = Math.min(j.waypoints.length, collapsedStart + TIMELINE_COLLAPSED_COUNT);
  const shown = expanded ? j.waypoints : j.waypoints.slice(collapsedStart, collapsedEnd);
  const hiddenCount = j.waypoints.length - shown.length;
  const renderStep = (w, i, arr) => (
    <TrackerStep
      key={`${w.type}-${w.atKm}-${i}`}
      icon={w.icon}
      color={w.color}
      done={w.passed}
      active={j.waypoints.indexOf(w) === j.nextIdx}
      title={w.title}
      sub={`${w.sub || ''}${w.type !== 'origin' && w.type !== 'dest' && w.type !== 'loadprep' ? ` · ${w.atKm} km` : ''} · ${w.passed ? 'Reached' : j.waypoints.indexOf(w) === j.nextIdx ? 'ETA' : '~'} ${fmtWhen(w.ts)}`.replace(/^ · /, '')}
      line={i < arr.length - 1}
    />
  );
  return (
    <View>
      {/* Live "where is it now" banner */}
      <Row style={{ backgroundColor: C.blueSoft, borderRadius: RADIUS.md, padding: 10, marginBottom: 10 }}>
        <Icon name="truck-fast" size={18} color={C.blue} />
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={[FONT.sub, { fontWeight: '800', color: C.text }]}>
            {j.kmNow} / {j.total} km · {Math.round(j.prog * 100)}%
          </Text>
          {/* Current lifecycle phase (loading / ferry paperwork / sailing / unloading…) */}
          {phase.phase !== 'driving' && (
            <Text style={[FONT.tiny, { color: C.blue, fontWeight: '700' }]}>{PHASE_LABELS[phase.phase] || ''}</Text>
          )}
          <Text style={FONT.tiny}>
            {j.lastReached ? `Last reached ${j.lastReached.title.replace(/^Picked up · /, '')}` : 'Just departed'}
            {j.nextBreak ? ` · next ${j.nextBreak.type === 'fuel' ? 'fuel stop' : j.nextBreak.type === 'sleep' ? 'sleep break' : 'short break'} in ${Math.max(0, j.nextBreak.atKm - j.kmNow)} km (${fmtWhen(j.nextBreak.ts)})` : ` · ETA ${eta}`}
          </Text>
        </View>
      </Row>
      {expanded ? (
        <ScrollView style={{ maxHeight: 320 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
          {shown.map(renderStep)}
        </ScrollView>
      ) : shown.map(renderStep)}
      {j.waypoints.length > TIMELINE_COLLAPSED_COUNT && (
        <Pressable onPress={() => setExpanded(e => !e)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10 }}>
          <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={C.blue} />
          <Text style={{ color: C.blue, fontWeight: '700', marginLeft: 4 }}>
            {expanded ? 'Collapse timeline' : `Show full timeline (${hiddenCount} more stop${hiddenCount === 1 ? '' : 's'})`}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function SectionTitle({ icon, text, right }) {
  return (
    <Row style={{ justifyContent: 'space-between', marginBottom: 10, marginTop: 4 }}>
      <Row>
        {icon ? <Icon name={icon} size={17} color={C.sub} style={{ marginRight: 6 }} /> : null}
        <Text style={FONT.h3}>{text}</Text>
      </Row>
      {right || null}
    </Row>
  );
}

function SpecRow({ icon, label, value }) {
  return (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 5 }}>
      <Row><Icon name={icon} size={14} color={C.sub} /><Text style={[FONT.sub, { marginLeft: 6 }]}>{label}</Text></Row>
      <Text style={[FONT.body, { fontWeight: '700' }]}>{value}</Text>
    </Row>
  );
}

function Chip({ label, active, onPress, icon, color = C.blue }) {
  return (
    <Pressable onPress={onPress} style={[cs.chip, active && { backgroundColor: color, borderColor: color }]}>
      {icon ? <Icon name={icon} size={13} color={active ? '#fff' : C.sub} style={{ marginRight: 4 }} /> : null}
      <Text style={{ fontSize: 12.5, fontWeight: '700', color: active ? '#fff' : C.sub }} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

// ============ New Delivery ============
export function NewDeliveryModal({ visible, onClose, presetTruckId, presetDest, contract, onPickOnMap }) {
  const toast = useToast();
  const trucks = useGame(s => s.trucks);
  const startDelivery = useGame(s => s.startDelivery);
  const previewDelivery = useGame(s => s.previewDelivery);
  const pricing = useGame(s => s.pricing);
  const unlockedCountries = useGame(s => s.unlockedCountries || ['IN']);
  const parked = trucks.filter(t => t.status === 'parked');
  const [truckId, setTruckId] = useState(presetTruckId);
  const [dest, setDest] = useState(presetDest);
  const [query, setQuery] = useState('');
  const [cargo, setCargo] = useState('general');
  const [tons, setTons] = useState(null);
  const tapKalavadEgg = useEasterEggTap('kalavad_roots', 3);

  useEffect(() => {
    if (!visible) return;
    const tid = presetTruckId || (parked[0] && parked[0].id);
    setTruckId(tid);
    setDest(presetDest);
    setQuery('');
    setCargo(contract?.cargoType || 'general');
    const m = tid ? modelById(trucks.find(t => t.id === tid)?.modelId) : null;
    setTons(contract?.cargoTons || (m ? Math.round(m.cargo / 2) : 5));
  }, [visible, presetTruckId, presetDest]);

  const truck = trucks.find(t => t.id === truckId);
  const model = truck ? modelById(truck.modelId) : null;
  const maxTons = model ? model.cargo : 20;
  // A contract fixes the destination, cargo weight and type — you can't tweak
  // them to inflate the bonus. Only the truck is yours to choose.
  const locked = !!contract;
  const clampTons = locked ? Math.min(contract.cargoTons, maxTons) : Math.min(tons || 1, maxTons);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return CITIES.filter(c => {
      if (c.name.toLowerCase().includes(q) || c.state.toLowerCase().includes(q)) return true;
      const country = COUNTRY_BY_CODE[c.country || 'IN'];
      return !!country && (country.name.toLowerCase().includes(q) || (c.country || 'IN').toLowerCase() === q);
    }).slice(0, 8);
  }, [query]);

  const suggestions = useMemo(() => {
    if (!truck || query.trim() || dest) return [];
    try { return suggestDestinations(truck.lat, truck.lng, 5, unlockedCountries); } catch { return []; }
  }, [truckId, dest, query, visible]);

  const preview = useMemo(() => {
    if (!truck || !dest) return null;
    return previewDelivery(truckId, dest, cargo, clampTons);
  }, [truckId, dest, cargo, clampTons]);

  const destCity = dest ? cityById(dest) : null;

  const confirm = () => {
    const r = startDelivery(truckId, dest, cargo, clampTons, contract?.id);
    if (r.ok) { toast('Delivery started!', 'success'); onClose(); }
    else toast(r.err, 'error');
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="New Delivery" height="88%">
      <ScrollView showsVerticalScrollIndicator={false}>
        {parked.length === 0 ? (
          <Card style={{ alignItems: 'center', padding: 24 }}>
            <Icon name="truck-alert-outline" size={34} color={C.amber} />
            <Text style={[FONT.body, { marginTop: 8, textAlign: 'center' }]}>No parked trucks available. Wait for a build to finish or a delivery to complete.</Text>
          </Card>
        ) : (
          <>
            {/* Truck picker */}
            <Text style={cs.section}>Choose truck</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {parked.map(t => {
                const m = modelById(t.modelId);
                const sel = t.id === truckId;
                return (
                  <Pressable key={t.id} onPress={() => setTruckId(t.id)}
                    style={[cs.truckCard, sel && { borderColor: C.blue, backgroundColor: C.blueSoft }]}>
                    <Icon name={m.icon} size={22} color={sel ? C.blue : C.text} />
                    <Text style={[FONT.sub, { fontWeight: '700', marginTop: 4 }]} numberOfLines={1}>{m.name}</Text>
                    <Text style={FONT.tiny}>{m.cargo}t · {m.range}km</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Destination */}
            <Text style={cs.section}>Destination</Text>
            {locked ? (
              <Row style={{ backgroundColor: C.greenSoft, borderRadius: RADIUS.md, padding: 10 }}>
                <Icon name="file-lock" size={16} color={C.green} />
                <Text style={[FONT.sub, { marginLeft: 8, flex: 1, color: C.text }]}>
                  Contract destination: <Text style={{ fontWeight: '800' }}>{destCity ? `${destCity.name}, ${destCity.state}` : '—'}</Text> · locked
                </Text>
              </Row>
            ) : (
            <Row style={{ gap: 8 }}>
              <View style={{ flex: 1 }}>
                <TextInput value={query} onChangeText={t => { setQuery(t); setDest(null); }}
                  placeholder="Search city or state..." placeholderTextColor={C.faint} style={cs.input} />
              </View>
              <Btn title="Map" icon="map-marker" kind="soft" small onPress={onPickOnMap} />
            </Row>
            )}
            {!locked && results.map(c => (
              <Pressable key={c.id} onPress={() => { setDest(c.id); setQuery(c.name); if (c.id === 'kalavad') tapKalavadEgg(); }} style={cs.resRow}>
                <Icon name="map-marker" size={16} color={(c.country || 'IN') === 'IN' ? C.blue : C.amber} />
                <View style={{ marginLeft: 8, flex: 1 }}>
                  <Text style={[FONT.body, { fontWeight: '600' }]}>{c.name}</Text>
                  <Text style={FONT.tiny}>{c.state} · Tier {c.tier}{(c.country || 'IN') !== 'IN' ? ` · ${COUNTRY_BY_CODE[c.country]?.name || c.country}` : ''}</Text>
                </View>
                {(c.country || 'IN') !== 'IN' ? <Icon name="earth" size={14} color={C.amber} /> : null}
              </Pressable>
            ))}
            {suggestions.length > 0 && (
              <>
                <Text style={[FONT.tiny, { marginTop: 8, marginBottom: 4 }]}>SUGGESTED FOR THIS TRUCK</Text>
                <Row style={{ flexWrap: 'wrap', gap: 6 }}>
                  {suggestions.map(s => (
                    <Pressable key={s.city.id} onPress={() => { setDest(s.city.id); setQuery(s.city.name); }} style={cs.suggChip}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: C.text }}>{s.city.name}</Text>
                      <Text style={FONT.tiny}>{s.route.roadKm} km</Text>
                    </Pressable>
                  ))}
                </Row>
              </>
            )}
            {!locked && destCity && <Text style={[FONT.sub, { marginTop: 6 }]}>To: <Text style={{ fontWeight: '800' }}>{destCity.name}, {destCity.state}</Text></Text>}

            {/* Cargo */}
            <Text style={cs.section}>Cargo type{locked ? ' · fixed by contract' : ''}</Text>
            <Row style={{ flexWrap: 'wrap', gap: 6 }}>
              {CARGO_TYPES.map(ct => (
                <Chip key={ct.id} label={ct.name} icon={ct.icon} active={cargo === ct.id} onPress={() => { if (!locked) setCargo(ct.id); }} />
              ))}
            </Row>
            {(() => {
              const ct = cargoById(cargo);
              if (!ct) return null;
              const effRate = pricing[ct.id] != null ? pricing[ct.id] : ct.rate;
              const custom = pricing[ct.id] != null && pricing[ct.id] !== ct.rate;
              return (
                <Row style={{ marginTop: 8, backgroundColor: C.bgSoft, borderRadius: RADIUS.md, padding: 10 }}>
                  <Icon name={ct.icon} size={18} color={C.blue} />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Row style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                      <Text style={[FONT.sub, { fontWeight: '700' }]}>{ct.name} · ₹{effRate}/km per ton</Text>
                      {custom ? <View style={{ marginLeft: 6 }}><Pill text="Your price" icon="tune" color={C.green} bg={C.greenSoft} /></View> : null}
                    </Row>
                    <Text style={FONT.tiny}>{custom ? `Custom rate applied (default ₹${ct.rate}). ` : ''}{ct.desc}</Text>
                  </View>
                </Row>
              );
            })()}
            <Row style={{ marginTop: 12, justifyContent: 'space-between' }}>
              <Text style={FONT.sub}>Cargo weight{locked ? ' · fixed by contract' : ''}</Text>
              <Text style={[FONT.h3, { width: 90, textAlign: 'right' }]}>{clampTons} t</Text>
            </Row>
            {!locked && (
              <GameSlider min={1} max={maxTons} step={1} value={clampTons} onChange={setTons}
                minLabel="1 t" maxLabel={`${maxTons} t max`} />
            )}
            {locked && contract.cargoTons > maxTons && (
              <Row style={{ marginTop: 6, backgroundColor: C.amberSoft, borderRadius: RADIUS.md, padding: 8 }}>
                <Icon name="weight" size={14} color={C.amber} />
                <Text style={[FONT.tiny, { marginLeft: 6, flex: 1, color: C.text }]}>
                  This truck can only carry {maxTons}t of the contract's {contract.cargoTons}t — pick a bigger truck to haul it all in one trip, or accept the reduced load.
                </Text>
              </Row>
            )}

            {/* Preview */}
            {preview?.err ? (
              <Card style={{ marginTop: 12, borderColor: C.red, backgroundColor: C.redSoft }}>
                <Row><Icon name="alert-circle" size={16} color={C.red} /><Text style={[FONT.sub, { color: C.red, marginLeft: 6, flex: 1 }]}>{preview.err}</Text></Row>
              </Card>
            ) : preview ? (
              <Card style={{ marginTop: 12 }}>
                {/* mini route preview */}
                <RoutePreview points={preview.route.points} />
                <Row style={{ justifyContent: 'space-between', marginTop: 8 }}>
                  <PreviewStat icon="highway" label="Distance" value={`${preview.route.roadKm} km`} />
                  <PreviewStat icon="clock-outline" label="Duration" value={fmtDur(preview.durationSec)} />
                  <PreviewStat icon="gas-station" label="Refuels" value={preview.refuelCount || 0} />
                </Row>
                {/* Fuel range check — warn if the trip is longer than the current tank */}
                {preview.refuelCount > 0 ? (
                  <Row style={{ marginTop: 10, backgroundColor: C.amberSoft, borderRadius: RADIUS.md, padding: 10 }}>
                    <Icon name="fuel" size={16} color={C.amber} />
                    <Text style={[FONT.tiny, { marginLeft: 8, flex: 1, color: C.text }]}>
                      Trip is {preview.route.roadKm} km but your fuel only lasts ~{preview.startRangeKm} km ({preview.startFuelPct}% tank). The truck will auto-refuel {preview.refuelCount}× en route (+{preview.refuelCount}h). It will not get stranded.
                    </Text>
                  </Row>
                ) : (
                  <Row style={{ marginTop: 10, backgroundColor: C.greenSoft, borderRadius: RADIUS.md, padding: 10 }}>
                    <Icon name="check-circle" size={16} color={C.green} />
                    <Text style={[FONT.tiny, { marginLeft: 8, flex: 1, color: C.text }]}>
                      In range — reaches {preview.to.name} on the current tank (~{preview.startRangeKm} km) with no refuel stop.
                    </Text>
                  </Row>
                )}
                <View style={{ height: 1, backgroundColor: C.border, marginVertical: 10 }} />
                <Row style={{ justifyContent: 'space-between' }}><Text style={FONT.sub}>Freight revenue</Text><Text style={FONT.mono}>{inr(preview.econ.gross)}</Text></Row>
                <Row style={{ justifyContent: 'space-between' }}><Text style={FONT.sub}>Fuel / charge</Text><Text style={[FONT.mono, { color: C.red }]}>-{inr(preview.econ.fuel)}</Text></Row>
                <Row style={{ justifyContent: 'space-between' }}><Text style={FONT.sub}>Maintenance</Text><Text style={[FONT.mono, { color: C.red }]}>-{inr(preview.econ.maint)}</Text></Row>
                <Row style={{ justifyContent: 'space-between' }}><Text style={FONT.sub}>Highway tolls</Text><Text style={[FONT.mono, { color: C.red }]}>-{inr(preview.econ.tolls || 0)}</Text></Row>
                {preview.customs > 0 && (
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Text style={FONT.sub}>Customs ({preview.borders} border{preview.borders === 1 ? '' : 's'})</Text>
                    <Text style={[FONT.mono, { color: C.red }]}>-{inr(preview.econ.customs || 0)}</Text>
                  </Row>
                )}
                <Row style={{ justifyContent: 'space-between', marginTop: 6 }}>
                  <Text style={[FONT.h3]}>Net profit</Text>
                  <Text style={[FONT.h2, { color: preview.econ.net >= 0 ? C.green : C.red }]}>{inr(preview.econ.net)}</Text>
                </Row>
                {preview.borders > 0 && (
                  <Row style={{ marginTop: 8, backgroundColor: C.amberSoft, borderRadius: RADIUS.md, padding: 10 }}>
                    <Icon name="passport" size={16} color={C.amber} />
                    <Text style={[FONT.tiny, { marginLeft: 8, flex: 1, color: C.text }]}>
                      International haul — crosses {preview.borders} border{preview.borders === 1 ? '' : 's'}
                      {preview.borderNames?.length ? ` (${preview.borderNames.join(', ')})` : ''}. Adds customs time & a {inr(preview.econ.customs || 0)} fee.
                    </Text>
                  </Row>
                )}
                {preview.route.usesFerry && <View style={{ marginTop: 8 }}><Pill text="Uses Ferry" icon="ferry" color={C.amber} bg={C.amberSoft} /></View>}
                {contract && <View style={{ marginTop: 8 }}><Pill text="Contract delivery — bonus on completion" icon="file-check" color={C.green} bg={C.greenSoft} /></View>}
              </Card>
            ) : (
              <Card style={{ marginTop: 12, alignItems: 'center', padding: 18 }}>
                <Icon name="map-search-outline" size={26} color={C.faint} />
                <Text style={[FONT.sub, { marginTop: 6 }]}>Pick a destination to see the profit preview.</Text>
              </Card>
            )}

            <Btn title="Start Delivery" kind="green" icon="truck-fast" style={{ marginTop: 14, marginBottom: 30 }}
              disabled={!preview || !!preview.err} onPress={confirm} />
          </>
        )}
      </ScrollView>
    </Sheet>
  );
}

function PreviewStat({ icon, label, value }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Icon name={icon} size={16} color={C.sub} />
      <Text style={[FONT.h3, { fontSize: 14, marginTop: 2 }]}>{value}</Text>
      <Text style={FONT.tiny}>{label}</Text>
    </View>
  );
}

function RoutePreview({ points }) {
  const W = 300, H = 110, pad = 10;
  if (!points || points.length < 2) return null;
  const lats = points.map(p => p.lat), lngs = points.map(p => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const spanLat = maxLat - minLat || 1, spanLng = maxLng - minLng || 1;
  const norm = points.map(p => ({
    x: pad + ((p.lng - minLng) / spanLng) * (W - 2 * pad),
    y: pad + ((maxLat - p.lat) / spanLat) * (H - 2 * pad),
  }));
  const str = norm.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  return (
    <View style={{ backgroundColor: C.mapLand, borderRadius: RADIUS.md, overflow: 'hidden' }}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Polyline points={str} fill="none" stroke={C.route} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={norm[0].x} cy={norm[0].y} r={5} fill={C.blue} stroke="#fff" strokeWidth={2} />
        <Circle cx={norm[norm.length - 1].x} cy={norm[norm.length - 1].y} r={5} fill={C.green} stroke="#fff" strokeWidth={2} />
      </Svg>
    </View>
  );
}

// ============ Truck Detail ============
// Live portion of the truck modal, ISOLATED: only this panel re-renders on
// the 1s tick. The old design ticked the entire modal — every card, SVG and
// button rebuilt each second, which lagged the sheet and (worse) replaced
// Pressables mid-touch after scrolling, leaving every button dead until an
// app restart. Now the static 90% of the modal renders once per open.
const TruckLivePanel = React.memo(function TruckLivePanel({ truckId }) {
  const toast = useToast();
  const trucks = useGame(s => s.trucks);
  const deliveries = useGame(s => s.deliveries);
  const callMechanic = useGame(s => s.callMechanic);
  const truck = trucks.find(t => t.id === truckId);
  const d = truck ? deliveries.find(x => x.truckId === truck.id) : null;
  useTick(!!truck && (truck.status === 'delivering' || truck.status === 'building'));
  if (!truck) return null;
  const m = modelById(truck.modelId);
  const now = Date.now();
  const eta = d ? fmtDur((d.endsAt - now) / 1000) : null;
  const stopInfo = d ? deliveryStop(d, m, now) : null;
  const totalKm = d ? d.route.roadKm : 0;
  const kmCovered = d
    ? (stopInfo?.stopped && stopInfo.atKm != null ? stopInfo.atKm : Math.round(totalKm * deliveryPhase(d, now).frac))
    : 0;
  const prog = d && totalKm > 0 ? Math.min(100, (kmCovered / totalKm) * 100) : 0;
  const startFuel = d && d.startFuelPct != null ? d.startFuelPct : truck.fuelPct;
  const arriveFuel = d && d.arriveFuelPct != null ? d.arriveFuelPct : startFuel;
  const curFuel = d ? Math.max(3, Math.round(startFuel + (arriveFuel - startFuel) * (prog / 100))) : Math.round(truck.fuelPct);
  const buildLeft = truck.status === 'building' ? Math.max(0, (truck.buildEndsAt - now) / 1000) : 0;
  const buildPct = truck.status === 'building' ? 100 * (1 - buildLeft / truck.buildTotalSec) : 0;
  const incident = d && d.incident;
  const incidentLeft = incident ? Math.max(0, (incident.resolveAt - now) / 1000) : 0;
  const doCallMechanic = () => { const r = callMechanic(d.id); toast(r.ok ? 'Mechanic on the way — delay cut short.' : r.err, r.ok ? 'success' : 'error'); };
  const [timelineOpen, setTimelineOpen] = useState(false);
  // Cheap "what's happening / what's next" line — no route/city scanning at
  // all, safe to recompute every tick even on the longest haul in the game.
  const nextAction = d ? (
    stopInfo?.stopped ? stopInfo.label
      : `En route to ${cityById(d.toCityId)?.name || 'destination'} · arrives in ${eta}`
  ) : null;

  return (
    <>
      {truck.status === 'delivering' && d && (
        <Card style={{ marginBottom: 12 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={FONT.h3}>{cityById(d.fromCityId)?.name} → {cityById(d.toCityId)?.name}</Text>
            <Text style={[FONT.mono, { color: C.blue }]}>ETA {eta}</Text>
          </Row>
          <Progress pct={prog} color={C.green} style={{ marginTop: 8 }} />
          <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
            <Text style={FONT.tiny}>{kmCovered} / {totalKm} km</Text>
            <Text style={FONT.tiny}>{Math.round(prog)}%</Text>
          </Row>
          <Row style={{ marginTop: 10 }}>
            <Gauge value={stopInfo.stopped ? 0 : liveSpeed(m.speed, truck.id)} max={Math.round(m.speed * 1.15)}
              label="Speed" unit="km/h" color={stopInfo.stopped ? C.amber : C.green} />
            <Gauge value={curFuel} max={100} label={m.propulsion === 'electric' ? 'Charge' : 'Fuel'} unit="%"
              color={curFuel > 50 ? C.green : curFuel > 20 ? C.amber : C.red} />
          </Row>
          {stopInfo.stopped && (
            <Row style={{ marginTop: 8, backgroundColor: C.amberSoft, borderRadius: RADIUS.md, padding: 8 }}>
              <Icon name="pause-circle-outline" size={14} color={C.amber} />
              <Text style={[FONT.tiny, { marginLeft: 6, flex: 1, color: C.text }]}>Truck halted — {stopInfo.label}.</Text>
            </Row>
          )}
        </Card>
      )}

      {/* Default view: cheap current-status card only — no route/city scan.
          The full stop-by-stop timeline (which scans every city against the
          route) now loads ONLY when explicitly opened, in its own sheet. */}
      {truck.status === 'delivering' && d && (
        <Card style={{ marginBottom: 12 }}>
          <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={FONT.h3}>Current Status</Text>
            <Row style={{ gap: 10 }}>
              <Row><Icon name="sleep" size={13} color={C.blue} /><Text style={[FONT.tiny, { marginLeft: 3 }]}>{d.sleepBreaks || 0} sleep</Text></Row>
              <Row><Icon name="coffee-outline" size={13} color={C.sub} /><Text style={[FONT.tiny, { marginLeft: 3 }]}>{d.shortBreaks || 0} short</Text></Row>
              <Row><Icon name="gas-station" size={13} color={C.amber} /><Text style={[FONT.tiny, { marginLeft: 3 }]}>{d.refuelCount || (d.stops || []).length || 0} fuel</Text></Row>
            </Row>
          </Row>
          <Row style={{ backgroundColor: C.blueSoft, borderRadius: RADIUS.md, padding: 10 }}>
            <Icon name={stopInfo?.stopped ? 'pause-circle-outline' : 'truck-fast'} size={18} color={C.blue} />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={[FONT.sub, { fontWeight: '800', color: C.text }]}>Next: {nextAction}</Text>
            </View>
          </Row>
          <Btn title="View Full Timeline" kind="soft" icon="map-marker-path" small style={{ marginTop: 10 }}
            onPress={() => setTimelineOpen(true)} />
        </Card>
      )}
      {/* Mounted only while open — buildJourney's city scan runs once here,
          never inside the always-on live panel above. */}
      {timelineOpen && (
        <Sheet visible={timelineOpen} onClose={() => setTimelineOpen(false)} title="Full Shipment Timeline" height="80%">
          <ScrollView showsVerticalScrollIndicator={false}>
            {d && <JourneyTracker delivery={d} model={m} />}
          </ScrollView>
        </Sheet>
      )}

      {truck.status === 'building' && (
        <Card style={{ marginBottom: 12 }}>
          <Row style={{ justifyContent: 'space-between' }}><Text style={FONT.h3}>Building...</Text><Text style={FONT.mono}>{fmtClock(buildLeft)}</Text></Row>
          <Progress pct={buildPct} color={C.amber} style={{ marginTop: 8 }} />
        </Card>
      )}

      {incident && (() => {
        const im = incidentMeta(incident.type);
        return (
          <Card style={{ marginBottom: 12, borderColor: im.color }}>
            <Row>
              <Icon name={im.icon} size={16} color={im.color} />
              <Text style={[FONT.body, { color: im.color, marginLeft: 6, fontWeight: '700' }]}>{im.title}</Text>
            </Row>
            <Text style={[FONT.tiny, { marginTop: 6 }]}>
              {incident.penalty > 0 ? `Lost ${inr(incident.penalty)} already. ` : ''}
              {incident.mechanicCalled ? 'Mechanic dispatched — ' : ''}Back on the road in ~{fmtDur(incidentLeft)}.
            </Text>
            {im.mechanic && !incident.mechanicCalled ? (
              <Btn title="Call Mechanic" kind="blue" small icon="wrench" onPress={doCallMechanic} style={{ marginTop: 10 }} />
            ) : !im.mechanic ? (
              <Row style={{ marginTop: 8 }}>
                <Icon name="information-outline" size={12} color={C.sub} />
                <Text style={[FONT.tiny, { marginLeft: 4, flex: 1 }]}>Nothing to repair — the delivery continues automatically after the delay.</Text>
              </Row>
            ) : null}
          </Card>
        );
      })()}
    </>
  );
});

// Route History — its own on-demand sheet (mounts only when opened). Shows
// 3 trips at a time with a "Show more" footer; each trip expands in place to
// its own mini-timeline: the same fuel/maintenance/tolls/customs/driver
// breakdown the Routes tab shows, scoped to this one truck's log.
const HIST_PAGE = 3;
function TruckHistorySheet({ visible, onClose, log }) {
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(null);
  useEffect(() => { if (visible) { setPage(1); setOpenId(null); } }, [visible]);
  const shown = log.slice(0, page * HIST_PAGE);
  return (
    <Sheet visible={visible} onClose={onClose} title="Route History" height="80%">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
        {log.length === 0 ? (
          <Text style={[FONT.sub, { textAlign: 'center', paddingVertical: 20 }]}>No completed trips yet.</Text>
        ) : shown.map(h => {
          const f = cityById(h.fromCityId), t2 = cityById(h.toCityId);
          const expanded = openId === h.id;
          const hasDetail = h.fuel != null;
          const costs = (h.fuel || 0) + (h.maint || 0) + (h.tolls || 0) + (h.customs || 0);
          return (
            <Card key={h.id} style={{ marginBottom: 8, padding: 12 }}>
              <Pressable onPress={() => setOpenId(expanded ? null : h.id)}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Row><Text style={FONT.body} numberOfLines={1}>{f?.name || '?'}</Text>
                      <Icon name={h.ferry ? 'ferry' : 'arrow-right'} size={12} color={h.ferry ? C.blue : C.faint} style={{ marginHorizontal: 4 }} />
                      <Text style={FONT.body} numberOfLines={1}>{t2?.name || '?'}</Text>
                    </Row>
                    <Text style={FONT.tiny}>{h.km} km{h.driver ? ` · ${h.driver}` : ''} · {relTime(h.ts)}</Text>
                  </View>
                  <Row>
                    <Text style={[FONT.mono, { fontWeight: '700', color: h.net >= 0 ? C.green : C.red }]}>{inr(h.net)}</Text>
                    <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={15} color={C.faint} style={{ marginLeft: 6 }} />
                  </Row>
                </Row>
              </Pressable>
              {expanded && (
                <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10 }}>
                  {hasDetail ? (
                    <>
                      <Row style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
                        <Text style={FONT.sub}>Freight earned (gross)</Text>
                        <Text style={[FONT.mono, { fontWeight: '700', color: C.green }]}>+{inr(h.gross)}</Text>
                      </Row>
                      {h.reward ? (
                        <Row style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
                          <Text style={FONT.sub}>Contract bonus</Text>
                          <Text style={[FONT.mono, { fontWeight: '700', color: C.green }]}>+{inr(h.reward)}</Text>
                        </Row>
                      ) : null}
                      <Row style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
                        <Text style={FONT.sub}>Fuel</Text><Text style={[FONT.mono, { color: C.red }]}>−{inr(h.fuel)}</Text>
                      </Row>
                      <Row style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
                        <Text style={FONT.sub}>Maintenance</Text><Text style={[FONT.mono, { color: C.red }]}>−{inr(h.maint)}</Text>
                      </Row>
                      <Row style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
                        <Text style={FONT.sub}>Tolls</Text><Text style={[FONT.mono, { color: C.red }]}>−{inr(h.tolls)}</Text>
                      </Row>
                      {h.customs ? (
                        <Row style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
                          <Text style={FONT.sub}>Customs (borders)</Text><Text style={[FONT.mono, { color: C.red }]}>−{inr(h.customs)}</Text>
                        </Row>
                      ) : null}
                      <Row style={{ justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.border, marginTop: 2 }}>
                        <Text style={[FONT.body, { fontWeight: '800' }]}>Net profit</Text>
                        <Text style={[FONT.mono, { fontWeight: '800', color: h.net >= 0 ? C.green : C.red }]}>{inr(h.net)}</Text>
                      </Row>
                      <Text style={[FONT.tiny, { marginTop: 4 }]}>Cost per km: ₹{h.km ? (costs / h.km).toFixed(1) : '—'} · margin {h.gross ? Math.round((h.net / h.gross) * 100) : 0}%</Text>
                    </>
                  ) : (
                    <Text style={FONT.tiny}>Older trip — full expense breakdown is recorded for every new delivery from v3.1.0 onward.</Text>
                  )}
                </View>
              )}
            </Card>
          );
        })}
        {shown.length < log.length && (
          <Btn title={`Show more (${log.length - shown.length})`} kind="soft" icon="chevron-down" onPress={() => setPage(p => p + 1)} />
        )}
      </ScrollView>
    </Sheet>
  );
}

export function TruckDetailModal({ visible, onClose, truckId, onNewDelivery, onShowOnMap }) {
  const toast = useToast();
  const trucks = useGame(s => s.trucks);
  const repairTruck = useGame(s => s.repairTruck);
  const serviceTruck = useGame(s => s.serviceTruck);
  const customizeTruck = useGame(s => s.customizeTruck);
  const sellTruck = useGame(s => s.sellTruck);
  const truckResale = useGame(s => s.truckResale);
  const [confirmSell, setConfirmSell] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  useEffect(() => { if (!visible) { setConfirmSell(false); setHistoryOpen(false); } }, [visible]);
  const truck = trucks.find(t => t.id === truckId);
  if (!visible || !truck) return <Sheet visible={visible && !!truck} onClose={onClose} title="Truck" height="50%"><View /></Sheet>;
  // Everything below renders ONCE per open (plus on real state changes) —
  // no per-second tick here; live data lives inside <TruckLivePanel/>.
  const m = modelById(truck.modelId);
  const meta = statusMeta[truck.status];
  const mechDisc = useGame.getState().mechDiscount();
  const fee = Math.round(m.price * 0.04 * (1 - mechDisc));
  const condition = Math.round(truck.condition == null ? 100 : truck.condition);
  const conditionColor = condition >= 70 ? C.green : condition >= 40 ? C.amber : C.red;
  const serviceCost = Math.round(m.price * 0.05 * (1 - mechDisc));
  const fuelNow = Math.round(truck.fuelPct);

  const doRepair = (gold) => { const r = repairTruck(truck.id, gold); toast(r.ok ? 'Repaired!' : r.err, r.ok ? 'success' : 'error'); };
  const doService = () => { const r = serviceTruck(truck.id); toast(r.ok ? 'Serviced — condition restored!' : r.err, r.ok ? 'success' : 'error'); };

  return (
    <Sheet visible={visible} onClose={onClose} title={truck.customName || m.name} height="86%">
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" removeClippedSubviews={false}>
        <Row style={{ marginBottom: 12 }}>
          <TruckArtBadge model={m} color={truck.color} size={60} bg={meta.bg} />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={FONT.h2}>{truck.customName || m.name}</Text>
            <Text style={FONT.sub}>{m.brand}</Text>
            <Row style={{ marginTop: 4 }}><Stars rating={m.rating} /><View style={{ marginLeft: 8 }}><Pill text={meta.label} icon={meta.icon} color={meta.color} bg={meta.bg} /></View></Row>
          </View>
        </Row>

        {/* Live trip / build / incident — the ONLY part that ticks */}
        <TruckLivePanel truckId={truck.id} />

        {truck.status === 'broken' && (
          <Card style={{ marginBottom: 12, borderColor: C.red }}>
            <Row><Icon name="alert" size={16} color={C.red} /><Text style={[FONT.body, { color: C.red, marginLeft: 6, fontWeight: '700' }]}>This truck needs repair.</Text></Row>
            <Row style={{ marginTop: 10, gap: 8 }}>
              <Btn title={`Repair ${inr(fee)}`} kind="soft" small onPress={() => doRepair(false)} style={{ flex: 1 }} />
              <Btn title="Repair · 15 Gold" kind="blue" small onPress={() => doRepair(true)} style={{ flex: 1 }} />
            </Row>
          </Card>
        )}

        <Card>
          <Row style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Row><Icon name="heart-pulse" size={15} color={conditionColor} />
              <Text style={[FONT.body, { fontWeight: '700', marginLeft: 6 }]}>Condition</Text></Row>
            <Text style={[FONT.body, { color: conditionColor, fontWeight: '700' }]}>{condition}%</Text>
          </Row>
          <Progress pct={condition} color={conditionColor} style={{ marginBottom: condition < 55 ? 8 : 0 }} />
          {condition < 55 && truck.status !== 'delivering' && (
            <Btn title={`Service · ${inr(serviceCost)}`} kind="soft" small icon="wrench" onPress={doService} style={{ marginTop: 4 }} />
          )}
        </Card>

        <Card style={{ marginTop: 10 }}>
          <Text style={[FONT.h3, { marginBottom: 4 }]}>Specifications</Text>
          <SpecRow icon="speedometer" label="Top speed" value={`${m.speed} km/h`} />
          <SpecRow icon="weight" label="Cargo capacity" value={`${m.cargo} t`} />
          {m.propulsion === 'electric'
            ? <SpecRow icon="battery-high" label="Battery" value={`${m.battery} kWh`} />
            : <SpecRow icon="fuel" label="Fuel tank" value={`${m.tank} L`} />}
          <SpecRow icon="map-marker-distance" label="Full range" value={`${m.range} km`} />
          <SpecRow icon="fuel" label={m.propulsion === 'electric' ? 'Charge (at last stop)' : 'Fuel (at last stop)'}
            value={`${fuelNow}% · ~${Math.round((fuelNow / 100) * m.range)} km`} />
          <SpecRow icon="wrench" label="Maintenance" value={`${inr(m.maint)}/km`} />
          <SpecRow icon="cash" label="Purchase price" value={inr(m.price)} />
        </Card>

        <Card style={{ marginTop: 10 }}>
          <Text style={[FONT.h3, { marginBottom: 4 }]}>Lifetime</Text>
          <SpecRow icon="map-marker-path" label="Distance driven" value={`${Math.round(truck.km).toLocaleString()} km`} />
          <SpecRow icon="package-variant-closed-check" label="Deliveries" value={truck.deliveries} />
          <SpecRow icon="map-marker" label="Location" value={cityById(truck.cityId)?.name || '—'} />
        </Card>

        {/* Route History lives in its own on-demand sheet now — nothing here
            renders or computes until the button is tapped. */}
        {(truck.log || []).length > 0 && (
          <Btn title={`Route History · ${(truck.log || []).length} trip${(truck.log || []).length === 1 ? '' : 's'}`}
            kind="soft" icon="history" style={{ marginTop: 10 }} onPress={() => setHistoryOpen(true)} />
        )}
        {historyOpen && <TruckHistorySheet visible={historyOpen} onClose={() => setHistoryOpen(false)} log={truck.log || []} />}

        <Card style={{ marginTop: 10 }}>
          <Text style={[FONT.h3, { marginBottom: 8 }]}>Customize</Text>
          <Text style={FONT.tiny}>NAME</Text>
          <TextInput
            defaultValue={truck.customName || m.name} maxLength={28}
            placeholder={m.name} placeholderTextColor={C.faint}
            onEndEditing={e => customizeTruck(truck.id, { customName: e.nativeEvent.text.trim() || null })}
            style={cs.input}
          />
          <Text style={[FONT.tiny, { marginTop: 10 }]}>LIVERY COLOUR</Text>
          <Row style={{ flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
            {TRUCK_COLORS.map(c => {
              const sel = (truck.color || TRUCK_COLORS[0].hex) === c.hex;
              return (
                <Pressable key={c.id} onPress={() => customizeTruck(truck.id, { color: c.hex })}
                  style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: c.hex,
                    borderWidth: sel ? 3 : 1, borderColor: sel ? C.text : C.border, alignItems: 'center', justifyContent: 'center' }}>
                  {sel ? <Icon name="check" size={16} color="#fff" /> : null}
                </Pressable>
              );
            })}
          </Row>
          <Text style={[FONT.tiny, { marginTop: 10 }]}>EMBLEM</Text>
          <Row style={{ flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
            {TRUCK_LOGOS.map(l => {
              const sel = truck.logoIcon === l;
              return (
                <Pressable key={l} onPress={() => customizeTruck(truck.id, { logoIcon: sel ? null : l })}
                  style={{ width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
                    borderWidth: 1, borderColor: sel ? C.blue : C.border, backgroundColor: sel ? C.blueSoft : '#fff' }}>
                  <Icon name={l} size={20} color={sel ? C.blue : C.sub} />
                </Pressable>
              );
            })}
          </Row>
        </Card>

        <Row style={{ marginTop: 14, gap: 8 }}>
          {truck.status === 'parked' && <Btn title="New Delivery" kind="green" icon="truck-fast" style={{ flex: 1 }} onPress={() => { onClose(); onNewDelivery(truck.id); }} />}
          <Btn title="Show on Map" kind="soft" icon="crosshairs-gps" style={{ flex: 1 }} onPress={() => onShowOnMap(truck)} />
        </Row>
        {(truck.status === 'parked' || truck.status === 'broken') && (
          <Btn
            title={confirmSell ? `Confirm sell for ${inr(truckResale(truck.id))}?` : `Sell Truck · ${inr(truckResale(truck.id))}`}
            kind="danger" icon="cash-refund" style={{ marginTop: 8, marginBottom: 30 }}
            onPress={() => {
              if (!confirmSell) { setConfirmSell(true); return; }
              const r = sellTruck(truck.id);
              toast(r.ok ? `Sold for ${inr(r.value)}` : r.err, r.ok ? 'success' : 'error');
              if (r.ok) onClose();
            }}
          />
        )}
      </ScrollView>
    </Sheet>
  );
}

// ============ Buy Truck ============
export function BuyTruckModal({ visible, onClose }) {
  const toast = useToast();
  const balance = useGame(s => s.balance);
  const buyTruck = useGame(s => s.buyTruck);
  const [tier, setTier] = useState(0);
  const [sort, setSort] = useState('default');
  const [page, setPage] = useState(1); // showroom loads 10 trucks at a time
  const [confirmModel, setConfirmModel] = useState(null); // full-detail confirm sheet before buying
  const gameDay = useGame(st => st.gameDay);
  const day = gameDay().day;
  useEffect(() => { setPage(1); }, [tier, sort]);
  useEffect(() => { if (!visible) setConfirmModel(null); }, [visible]);
  const tapWindowShopperEgg = useEasterEggTap('window_shopper', 8);
  const SORTS = [
    ['default', 'Default'],
    ['name-asc', 'Name A-Z'],
    ['name-desc', 'Name Z-A'],
    ['price-asc', 'Price Low-High'],
    ['price-desc', 'Price High-Low'],
  ];
  const list = useMemo(() => {
    const filtered = TRUCK_MODELS.filter(m => tier === 0 || m.tier === tier);
    const sorted = [...filtered];
    if (sort === 'name-asc') sorted.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === 'name-desc') sorted.sort((a, b) => b.name.localeCompare(a.name));
    else if (sort === 'price-asc') sorted.sort((a, b) => a.price - b.price);
    else if (sort === 'price-desc') sorted.sort((a, b) => b.price - a.price);
    return sorted;
  }, [tier, sort]);
  const buy = (m) => {
    const r = buyTruck(m.id);
    if (r.ok) { toast(`${m.name} ordered — building at HQ`, 'success'); setConfirmModel(null); }
    else toast(r.err, 'error');
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="Truck Showroom" height="86%">
      <Row style={{ gap: 6, marginBottom: 10 }}>
        {[[0, 'All'], [1, 'Starter'], [2, 'Advanced'], [3, 'Premium']].map(([t, l]) => (
          <Chip key={t} label={l} active={tier === t} onPress={() => { if (t === 0 && tier === 0) tapWindowShopperEgg(); setTier(t); }} />
        ))}
      </Row>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
        <Row style={{ gap: 6 }}>
          <Row style={{ marginRight: 2 }}><Icon name="sort" size={14} color={C.sub} /></Row>
          {SORTS.map(([k, l]) => (
            <Chip key={k} label={l} active={sort === k} onPress={() => setSort(k)} />
          ))}
        </Row>
      </ScrollView>
      <FlatList
        data={list.slice(0, page * 10)} keyExtractor={m => m.id} showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 30 }}
        ListFooterComponent={page * 10 < list.length ? (
          <Btn title={`Show more trucks (${list.length - page * 10})`} kind="soft" icon="chevron-down"
            onPress={() => setPage(pg => pg + 1)} style={{ marginTop: 4 }} />
        ) : null}
        renderItem={({ item: m }) => {
          const pm = propMeta[m.propulsion];
          const deal = truckDealFor(m.id, day);
          const price = dealPriceFor(m, day);
          const afford = balance >= price;
          return (
            <Card style={{ marginBottom: 10, borderColor: deal > 0 ? C.green : C.border }}>
              {deal > 0 && (
                <View style={{ position: 'absolute', top: -1, right: 12, backgroundColor: C.red, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ color: '#fff', fontWeight: '900', fontSize: 10 }}>{Math.round(deal * 100)}% OFF</Text>
                </View>
              )}
              <Row>
                <TruckArtBadge model={m} size={52} bg={pm.bg} />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={FONT.h3}>{m.name}</Text>
                  <Text style={FONT.tiny}>{m.brand}</Text>
                  <Row style={{ marginTop: 4, gap: 6 }}><Pill text={pm.label} icon={pm.icon} color={pm.color} bg={pm.bg} /><Stars rating={m.rating} size={11} /></Row>
                </View>
              </Row>
              <Row style={{ justifyContent: 'space-between', marginTop: 10 }}>
                <MiniSpec icon="speedometer" v={`${m.speed}`} />
                <MiniSpec icon="weight" v={`${m.cargo}t`} />
                <MiniSpec icon="map-marker-distance" v={`${m.range}`} />
                <MiniSpec icon="wrench" v={`${m.maint}/km`} />
              </Row>
              <Row style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                <View>
                  {deal > 0 ? (
                    <Row style={{ gap: 6, alignItems: 'center' }}>
                      <Text style={[FONT.tiny, { textDecorationLine: 'line-through', color: C.faint }]}>{inrShort(m.price)}</Text>
                      <Text style={[FONT.h3, { color: C.green }]}>{inr(price)}</Text>
                    </Row>
                  ) : <Text style={[FONT.h3, { color: C.text }]}>{inr(price)}</Text>}
                </View>
                <Btn title={afford ? 'View & Buy' : 'Insufficient funds'} kind={afford ? 'primary' : 'soft'} small disabled={!afford} onPress={() => setConfirmModel(m)} />
              </Row>
            </Card>
          );
        }}
      />

      {/* ---- Confirm sheet: the full picture before money leaves the account ---- */}
      <Sheet visible={!!confirmModel} onClose={() => setConfirmModel(null)} title="Confirm Purchase" height="72%">
        {confirmModel && (() => {
          const m = confirmModel;
          const deal = truckDealFor(m.id, day);
          const price = dealPriceFor(m, day);
          const pm = propMeta[m.propulsion];
          const afford = balance >= price;
          return (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
              <Card style={{ alignItems: 'center', paddingVertical: 18, marginBottom: 12 }}>
                <TruckArtBadge model={m} size={84} bg={pm.bg} />
                <Text style={[FONT.h2, { marginTop: 8 }]}>{m.name}</Text>
                <Text style={FONT.tiny}>{m.brand}</Text>
                <Row style={{ marginTop: 6, gap: 6 }}>
                  <Pill text={pm.label} icon={pm.icon} color={pm.color} bg={pm.bg} />
                  <Stars rating={m.rating} size={12} />
                  {deal > 0 ? <Pill text={`${Math.round(deal * 100)}% OFF today`} icon="tag" color="#fff" bg={C.red} /> : null}
                </Row>
                <Text style={[FONT.sub, { textAlign: 'center', marginTop: 8 }]}>{m.desc}</Text>
              </Card>
              <SectionTitle icon="clipboard-list-outline" text="Full Specifications" />
              <Card style={{ marginBottom: 12 }}>
                <SpecRow icon="speedometer" label="Top speed" value={`${m.speed} km/h`} />
                <SpecRow icon="weight" label="Cargo capacity" value={`${m.cargo} tons`} />
                <SpecRow icon="map-marker-distance" label="Range (full tank)" value={`${m.range} km`} />
                {m.propulsion === 'electric'
                  ? <SpecRow icon="battery-charging" label="Battery" value={`${m.battery} kWh`} />
                  : <SpecRow icon="gas-station" label="Fuel tank" value={`${m.tank} L (${m.eff} km/L)`} />}
                <SpecRow icon="wrench" label="Maintenance" value={`₹${m.maint}/km`} />
                <SpecRow icon="factory" label="Build time" value={`${Math.round(m.build / 60)} min at HQ`} />
              </Card>
              <Card style={{ marginBottom: 12, backgroundColor: C.bgSoft }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={FONT.body}>Price today</Text>
                  <Row style={{ gap: 8, alignItems: 'center' }}>
                    {deal > 0 ? <Text style={[FONT.tiny, { textDecorationLine: 'line-through', color: C.faint }]}>{inr(m.price)}</Text> : null}
                    <Text style={[FONT.h3, { color: deal > 0 ? C.green : C.text }]}>{inr(price)}</Text>
                  </Row>
                </Row>
                <Row style={{ justifyContent: 'space-between', marginTop: 6 }}>
                  <Text style={FONT.tiny}>Balance after purchase</Text>
                  <Text style={[FONT.tiny, { fontWeight: '800', color: afford ? C.text : C.red }]}>{inrShort(balance - price)}</Text>
                </Row>
                {deal > 0 ? <Text style={[FONT.tiny, { marginTop: 6, color: C.green }]}>Deals rotate every game day — this one is gone tomorrow.</Text> : null}
              </Card>
              <Btn title={afford ? `Confirm — buy for ${inrShort(price)}` : 'Insufficient funds'} kind={afford ? 'green' : 'soft'}
                icon="cart-check" disabled={!afford} onPress={() => buy(m)} />
              <Btn title="Cancel" kind="ghost" style={{ marginTop: 8 }} onPress={() => setConfirmModel(null)} />
            </ScrollView>
          );
        })()}
      </Sheet>
    </Sheet>
  );
}

function MiniSpec({ icon, v }) {
  return <Row><Icon name={icon} size={13} color={C.sub} /><Text style={[FONT.sub, { marginLeft: 3, fontWeight: '700' }]}>{v}</Text></Row>;
}

// Rough great-circle distance (km) — for contract payout estimates only.
function haversineKm(a, b) {
  if (!a || !b) return 0;
  const R = 6371, toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// ============ Contracts ============
export function ContractsModal({ visible, onClose, onAccept }) {
  const toast = useToast();
  const contracts = useGame(s => s.contracts);
  const company = useGame(s => s.company);
  const acceptContract = useGame(s => s.acceptContract);
  useTick(visible);
  const now = Date.now();
  const hq = company ? cityById(company.hqCityId) : null;
  const rank = c => c.status === 'available' && c.expiresAt > now ? 0 : c.status === 'inprogress' ? 1 : c.status === 'done' ? 2 : 3;
  const sorted = [...contracts].sort((a, b) => rank(a) - rank(b));
  const accept = (c) => {
    const r = acceptContract(c.id);
    if (r.ok) { onClose(); onAccept(r.contract); }
    else toast(r.err, 'error');
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="Contracts" height="86%">
      <FlatList
        data={sorted} keyExtractor={c => c.id} showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 30 }}
        ListHeaderComponent={
          <Text style={[FONT.sub, { marginBottom: 10 }]}>
            Contracts pay a <Text style={{ fontWeight: '800', color: C.green }}>bonus on top</Text> of normal delivery profit. Accept one, then dispatch a parked truck to fulfil it before it expires.
          </Text>
        }
        renderItem={({ item: c }) => {
          const fl = CONTRACT_FLAVORS.find(f => f.id === c.flavorId);
          const dest = cityById(c.destCityId);
          const expired = c.status === 'available' && c.expiresAt <= now;
          const done = c.status === 'done';
          const left = c.expiresAt - now;
          const hh = Math.floor(left / 3600000), mm = Math.floor((left % 3600000) / 60000);
          const bonusPct = Math.round((c.mult - 1) * 100);
          // Estimated base freight (avg ₹5/km/t over road-adjusted distance) and bonus on top.
          const estKm = Math.round(haversineKm(hq, dest) * 1.3);
          const estBase = estKm * c.cargoTons * 5;
          const estBonus = Math.round(estBase * (c.mult - 1));
          const estTotal = Math.round(estBase * c.mult);
          return (
            <Card style={{ marginBottom: 10, opacity: expired ? 0.5 : 1 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Row style={{ flex: 1 }}>
                  <View style={[cs.heroIcon, { width: 44, height: 44, backgroundColor: C.greenSoft }]}><Icon name={fl.icon} size={22} color={C.green} /></View>
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={FONT.h3}>{fl.name}</Text>
                    <Row style={{ marginTop: 2 }}>
                      <Icon name="map-marker" size={12} color={C.sub} />
                      <Text style={[FONT.tiny, { marginLeft: 2 }]}>{dest?.name}, {dest?.state}</Text>
                    </Row>
                  </View>
                </Row>
                <Pill text={`+${bonusPct}% bonus`} icon="trending-up" color={C.green} bg={C.greenSoft} />
              </Row>
              <Text style={[FONT.sub, { marginTop: 6 }]}>{fl.desc}</Text>

              {/* Clear info grid — money & logistics at a glance */}
              <Row style={{ marginTop: 10, backgroundColor: C.bgSoft, borderRadius: RADIUS.md, paddingVertical: 10 }}>
                <ContractStat icon="weight" label="Cargo" value={`${c.cargoTons} t`} />
                <ContractStat icon="map-marker-distance" label="Approx." value={estKm ? `${estKm} km` : '—'} />
                <ContractStat icon="cash-plus" label="Est. bonus" value={inrShort(estBonus)} color={C.green} />
              </Row>
              <Row style={{ justifyContent: 'space-between', marginTop: 8 }}>
                <Text style={FONT.tiny}>Est. total payout (freight + bonus)</Text>
                <Text style={[FONT.mono, { fontWeight: '800', color: C.text }]}>≈ {inr(estTotal)}</Text>
              </Row>
              {fl.evOnly && (
                <View style={{ marginTop: 8 }}><Pill text="Electric trucks only" icon="lightning-bolt" color={C.blue} bg={C.blueSoft} /></View>
              )}

              <Row style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                {done ? (
                  <Row><Icon name="check-circle" size={15} color={C.green} /><Text style={[FONT.sub, { color: C.green, marginLeft: 4 }]}>Completed · +{inr(c.rewardPaid)}</Text></Row>
                ) : c.status === 'inprogress' ? (
                  <Pill text="In Progress" icon="truck-fast" />
                ) : expired ? (
                  <Text style={[FONT.sub, { color: C.faint }]}>Expired</Text>
                ) : (
                  <Row><Icon name="clock-outline" size={14} color={C.amber} /><Text style={[FONT.sub, { marginLeft: 4, color: C.amber }]}>{hh}h {mm}m left to accept</Text></Row>
                )}
                {c.status === 'available' && !expired && <Btn title="Accept" small kind="green" icon="check" onPress={() => accept(c)} />}
              </Row>
            </Card>
          );
        }}
      />
    </Sheet>
  );
}

function ContractStat({ icon, label, value, color = C.text }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Icon name={icon} size={16} color={C.sub} />
      <Text style={[FONT.body, { fontWeight: '800', marginTop: 2, color }]}>{value}</Text>
      <Text style={FONT.tiny}>{label}</Text>
    </View>
  );
}

// ============ Power-Ups ============
// Ways to earn gold — shown on the Gold Wallet page so players always know
// where the next gold is coming from.
const GOLD_EARN_WAYS = [
  { icon: 'dice-multiple', title: 'Daily mini-games', desc: 'Scratch cards, lucky spin, dice & slots — free plays every day.' },
  { icon: 'calendar-star', title: 'Daily login streak', desc: 'Open the game daily: +2 gold per streak day, up to +14/day.' },
  { icon: 'trophy', title: 'Achievements', desc: 'Every level of every track pays 5–80 gold, one time.' },
  { icon: 'diamond-stone', title: 'Hidden easter eggs', desc: 'Each gem found pays +15 gold (and ₹10 lakhs).' },
  { icon: 'hand-coin', title: 'Client tips', desc: 'Happy clients randomly tip 2–5 gold on finished deliveries.' },
];

export function PowerupsModal({ visible, onClose, onOpenGames }) {
  const toast = useToast();
  const gold = useGame(s => s.gold);
  const trucks = useGame(s => s.trucks);
  const buyPowerup = useGame(s => s.buyPowerup);
  const convertGoldToCash = useGame(s => s.convertGoldToCash);
  const [page, setPage] = useState('store'); // store | wallet
  const [expand, setExpand] = useState(null);
  const [xGold, setXGold] = useState(5);
  const tapGoldDiggerEgg = useEasterEggTap('gold_digger', 10);
  useEffect(() => { if (visible) { setPage('store'); setExpand(null); setXGold(g => Math.min(Math.max(1, g), Math.max(1, gold))); } }, [visible]);
  useEffect(() => { setXGold(g => Math.min(Math.max(1, g), Math.max(1, gold))); }, [gold]);
  const xClamp = Math.min(Math.max(1, xGold), Math.max(1, gold));
  const exchange = () => {
    const r = convertGoldToCash(xClamp);
    toast(r.ok ? `Exchanged for ${inr(r.cash)}` : r.err, r.ok ? 'success' : 'error');
  };

  const eligible = (pid) => {
    if (pid === 'refuel') return trucks;
    if (pid === 'repair') return trucks.filter(t => t.status === 'broken');
    if (pid === 'skipbuild') return trucks.filter(t => t.status === 'building');
    return [];
  };
  const activate = (p, truckId) => {
    const r = buyPowerup(p.id, truckId);
    toast(r.ok ? `${p.name} activated` : r.err, r.ok ? 'success' : 'error');
    if (r.ok) setExpand(null);
  };
  const onBuy = (p) => {
    if (['refuel', 'repair', 'skipbuild'].includes(p.id)) {
      const el = eligible(p.id);
      if (el.length === 0) { toast(p.id === 'repair' ? 'No broken trucks to repair' : p.id === 'skipbuild' ? 'No trucks under construction' : 'No trucks to refuel', 'warn'); return; }
      setExpand(expand === p.id ? null : p.id);
    } else activate(p);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={page === 'store' ? 'Power-Ups Store' : 'Gold Wallet'} height="86%">
      {/* Two pages: the power-up store scrolls freely on its own, and the
          wallet (balance / earn / exchange) lives on its own page instead of
          pinned cards eating the store's scroll space. */}
      <Row style={{ gap: 6, marginBottom: 12 }}>
        <Chip label="Power-Ups" icon="star-four-points" active={page === 'store'} onPress={() => setPage('store')} />
        <Chip label={`Gold Wallet · ${gold}`} icon="gold" color={C.gold} active={page === 'wallet'} onPress={() => { tapGoldDiggerEgg(); setPage('wallet'); }} />
      </Row>

      {page === 'wallet' && (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
        <Card style={{ marginBottom: 12, backgroundColor: C.bgSoft }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row><Icon name="gold" size={20} color={C.gold} /><Text style={[FONT.h3, { marginLeft: 6 }]}>Your Gold</Text></Row>
            <Text style={[FONT.h2, { color: C.gold }]}>{gold}</Text>
          </Row>
          {/* Earn free Gold by playing the daily mini-games (scratch + roulette). */}
          <Btn title="Play for free Gold" kind="green" icon="dice-multiple" small={false}
            style={{ marginTop: 10 }} onPress={() => { onClose(); onOpenGames && onOpenGames(); }} />
          <Row style={{ marginTop: 6 }}>
            <Icon name="information-outline" size={12} color={C.sub} />
            <Text style={[FONT.tiny, { marginLeft: 4, flex: 1 }]}>Scratch cards & lucky spin — 10 free plays of each, every day.</Text>
          </Row>
        </Card>

        {/* Gold → Cash exchange */}
        <Card style={{ marginBottom: 12 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row style={{ flex: 1 }}>
              <View style={[cs.heroIcon, { width: 44, height: 44, backgroundColor: C.greenSoft }]}><Icon name="cash-sync" size={22} color={C.green} /></View>
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={FONT.h3}>Exchange Gold for Cash</Text>
                <Text style={FONT.tiny}>Convert premium Gold into spendable ₹ at {inrShort(GOLD_TO_CASH)} per Gold.</Text>
              </View>
            </Row>
          </Row>
          <Row style={{ justifyContent: 'space-between', marginTop: 10 }}>
            <Row><Icon name="gold" size={16} color={C.gold} /><Text style={[FONT.h3, { color: C.gold, marginLeft: 4 }]}>{xClamp}</Text></Row>
            <Text style={[FONT.body, { fontWeight: '700', color: C.green }]}>= {inr(xClamp * GOLD_TO_CASH)}</Text>
          </Row>
          <GameSlider min={1} max={Math.max(1, gold)} step={1} value={xClamp} color={C.gold}
            onChange={setXGold} minLabel="1" maxLabel={`${Math.max(1, gold)} gold`} />
          <Btn title="Exchange" kind="green" icon="cash-plus" disabled={gold < 1} onPress={exchange} style={{ marginTop: 8 }} />
        </Card>

        {/* All the ways gold flows in */}
        <Card>
          <Text style={[FONT.h3, { marginBottom: 6 }]}>Ways to earn Gold</Text>
          {GOLD_EARN_WAYS.map((w, i) => (
            <Row key={w.title} style={[{ paddingVertical: 8 }, i > 0 && { borderTopWidth: 1, borderTopColor: C.border }]}>
              <View style={[cs.heroIcon, { width: 36, height: 36, backgroundColor: C.amberSoft }]}><Icon name={w.icon} size={19} color={C.gold} /></View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[FONT.body, { fontWeight: '700' }]}>{w.title}</Text>
                <Text style={FONT.tiny}>{w.desc}</Text>
              </View>
            </Row>
          ))}
        </Card>
      </ScrollView>
      )}

      {page === 'store' && (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
        {POWERUPS.map(p => {
          const isCash = !!p.cash;
          const afford = isCash ? true : gold >= p.gold;
          return (
            <Card key={p.id} style={{ marginBottom: 10 }}>
              <Row>
                <View style={[cs.heroIcon, { width: 44, height: 44, backgroundColor: C.blueSoft }]}><Icon name={p.icon} size={22} color={C.blue} /></View>
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={FONT.h3}>{p.name}</Text>
                  <Text style={FONT.tiny}>{p.desc}</Text>
                </View>
              </Row>
              <Row style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                {isCash
                  ? <Text style={[FONT.h3, { color: C.text }]}>{inr(p.cash)}</Text>
                  : <Row><Icon name="gold" size={16} color={C.gold} /><Text style={[FONT.h3, { color: C.gold, marginLeft: 4 }]}>{p.gold} Gold</Text></Row>}
                <Btn title={isCash ? 'Buy' : afford ? 'Activate' : 'Not enough Gold'} kind={afford ? 'blue' : 'soft'} small disabled={!afford} onPress={() => onBuy(p)} />
              </Row>
              {expand === p.id && (
                <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10 }}>
                  <Text style={[FONT.tiny, { marginBottom: 6 }]}>SELECT TRUCK</Text>
                  {eligible(p.id).map(t => (
                    <Pressable key={t.id} onPress={() => activate(p, t.id)} style={cs.resRow}>
                      <Icon name={modelById(t.modelId).icon} size={16} color={C.text} />
                      <Text style={[FONT.body, { marginLeft: 8, flex: 1 }]}>{modelById(t.modelId).name}</Text>
                      <Icon name="chevron-right" size={18} color={C.faint} />
                    </Pressable>
                  ))}
                </View>
              )}
            </Card>
          );
        })}
      </ScrollView>
      )}
    </Sheet>
  );
}

// ============ Free-Gold Mini-Games (scratch + lucky spin) ============
function polar(cx, cy, r, deg) { const a = (deg - 90) * Math.PI / 180; return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }; }
function slicePath(cx, cy, r, a0, a1) {
  const s = polar(cx, cy, r, a0), e = polar(cx, cy, r, a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${cx},${cy} L${s.x},${s.y} A${r},${r} 0 ${large} 1 ${e.x},${e.y} Z`;
}

function ScratchGame({ toast }) {
  const playScratch = useGame(s => s.playScratch);
  const games = useGame(s => s.games); // re-render on play
  const gamesToday = useGame(s => s.gamesToday);
  const left = gamesToday().scratchLeft;
  const [card, setCard] = useState(null);
  const [revealed, setRevealed] = useState([]);

  const newCard = () => {
    const r = playScratch();
    if (!r.ok) { toast(r.err, 'warn'); return; }
    setCard(r); setRevealed([false, false, false, false, false, false]);
  };
  const reveal = i => setRevealed(rv => rv.map((v, k) => (k === i ? true : v)));
  const allRevealed = card && revealed.every(Boolean);

  return (
    <View>
      <Text style={[FONT.sub, { textAlign: 'center', marginBottom: 4 }]}>Scratch all 6 tiles — a lucky rule decides your Gold (max 5).</Text>
      <Text style={[FONT.tiny, { textAlign: 'center', marginBottom: 10 }]}>{left} of {DAILY_PLAYS} free cards left today</Text>
      {card ? (
        <>
          <Row style={{ flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
            {card.tiles.map((v, i) => (
              <Pressable key={i} onPress={() => reveal(i)} style={[cs.scratchTile, revealed[i] && { backgroundColor: C.greenSoft, borderColor: C.green }]}>
                {revealed[i]
                  ? <><Icon name="gold" size={16} color={C.gold} /><Text style={[FONT.h3, { color: C.text }]}>{v}</Text></>
                  : <Icon name="help" size={22} color={C.faint} />}
              </Pressable>
            ))}
          </Row>
          <View style={{ alignItems: 'center', marginTop: 12, minHeight: 46 }}>
            {allRevealed ? (
              <>
                <Text style={[FONT.sub, { fontWeight: '700' }]}>{card.ruleLabel}</Text>
                <Text style={[FONT.h2, { color: card.reward > 0 ? C.green : C.sub }]}>{card.reward > 0 ? `+${card.reward} Gold` : 'No Gold — try again!'}</Text>
              </>
            ) : <Btn title="Reveal all" kind="soft" small onPress={() => setRevealed([true, true, true, true, true, true])} />}
          </View>
        </>
      ) : (
        <View style={{ alignItems: 'center', paddingVertical: 20 }}>
          <Icon name="ticket-confirmation-outline" size={40} color={C.faint} />
          <Text style={[FONT.sub, { marginTop: 8 }]}>Tap below to get a fresh scratch card.</Text>
        </View>
      )}
      <Btn title={card && !allRevealed ? 'Scratch it!' : 'New scratch card'} kind="green" icon="ticket-confirmation"
        style={{ marginTop: 16 }} disabled={left <= 0 && (!card || allRevealed)} onPress={newCard} />
      {left <= 0 ? <Text style={[FONT.tiny, { textAlign: 'center', marginTop: 6 }]}>Come back tomorrow for 10 more.</Text> : null}
    </View>
  );
}

function SpinGame({ toast }) {
  const playRoulette = useGame(s => s.playRoulette);
  const revealGameResult = useGame(s => s.revealGameResult);
  const games = useGame(s => s.games);
  const gamesToday = useGame(s => s.gamesToday);
  const left = gamesToday().spinLeft;
  const spin = useRef(new Animated.Value(0)).current;
  const angleRef = useRef(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);

  const W = 264, cx = W / 2, cy = W / 2, r = W / 2 - 14, n = ROULETTE_SEGMENTS.length, seg = 360 / n;

  const doSpin = () => {
    if (spinning) return;
    const res = playRoulette();
    if (!res.ok) { toast(res.err, 'warn'); return; }
    setSpinning(true); setResult(null);
    haptic('medium'); play('start', 0.4);
    const target = 360 * 5 + (360 - (res.index * seg + seg / 2)); // land segment center at top
    const start = angleRef.current;
    const end = start + (target - (start % 360) + 360) % 360 + 360 * 5;
    Animated.timing(spin, { toValue: end, duration: 4200, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => {
      angleRef.current = end; setSpinning(false); setResult(res);
      // Result revealed only NOW — the store stays silent during the spin.
      revealGameResult('diamond-stone', `Lucky spin: ${res.label}!`);
      haptic(res.prize === 'nothing' ? 'light' : 'success');
      if (res.prize !== 'nothing') play('coin', 0.8);
      toast(res.prize === 'nothing' ? 'No luck this time!' : `Won: ${res.label}`, res.prize === 'nothing' ? 'info' : 'success');
    });
  };
  const rotate = spin.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] });

  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={[FONT.tiny, { marginBottom: 8 }]}>{left} of {DAILY_PLAYS} free spins left today</Text>
      <View style={{ width: W, height: W }}>
        {/* pointer */}
        <View style={{ position: 'absolute', top: -6, left: cx - 14, zIndex: 2, alignItems: 'center' }}>
          <Icon name="menu-down" size={38} color={C.gold} style={{ textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } }} />
        </View>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Svg width={W} height={W}>
            <G>
              {/* outer casino rim + inner track ring */}
              <Circle cx={cx} cy={cy} r={r + 12} fill="#1D2530" />
              <Circle cx={cx} cy={cy} r={r + 12} fill="none" stroke="#0B0F14" strokeWidth={1.5} />
              <Circle cx={cx} cy={cy} r={r + 5} fill="none" stroke="#C9A227" strokeWidth={2.4} />
              {ROULETTE_SEGMENTS.map((sgm, i) => {
                const mid = polar(cx, cy, r * 0.62, i * seg + seg / 2);
                return (
                  <G key={i}>
                    <Path d={slicePath(cx, cy, r, i * seg, (i + 1) * seg)} fill={sgm.color} stroke="#fff" strokeWidth={1.6} />
                    <SvgText x={mid.x} y={mid.y} fill="#fff" fontSize="11" fontWeight="bold" textAnchor="middle">{sgm.label}</SvgText>
                  </G>
                );
              })}
              {/* gold studs on every slice boundary, like a real prize wheel */}
              {ROULETTE_SEGMENTS.map((_, i) => {
                const p = polar(cx, cy, r + 5, i * seg);
                return <Circle key={`stud-${i}`} cx={p.x} cy={p.y} r={3} fill="#F4D35E" stroke="#8C6D1F" strokeWidth={0.8} />;
              })}
              {/* premium hub */}
              <Circle cx={cx} cy={cy} r={24} fill="#1D2530" />
              <Circle cx={cx} cy={cy} r={20} fill="#fff" stroke="#C9A227" strokeWidth={2.5} />
              <SvgText x={cx} y={cy + 4.5} fill={C.text} fontSize="13" fontWeight="800" textAnchor="middle">SPIN</SvgText>
            </G>
          </Svg>
        </Animated.View>
      </View>
      <View style={{ minHeight: 30, marginTop: 10, alignItems: 'center' }}>
        {result ? <Text style={[FONT.h3, { color: result.prize === 'nothing' ? C.sub : C.green }]}>{result.prize === 'nothing' ? 'Try again!' : `Won ${result.label}!`}</Text> : null}
      </View>
      <Btn title={spinning ? 'Spinning…' : 'Spin the wheel'} kind="green" icon="rotate-right" style={{ marginTop: 8, alignSelf: 'stretch' }}
        disabled={spinning || left <= 0} onPress={doSpin} />
      {left <= 0 ? <Text style={[FONT.tiny, { textAlign: 'center', marginTop: 6 }]}>Come back tomorrow for 10 more.</Text> : null}
    </View>
  );
}

function DiceGame({ toast }) {
  const playDice = useGame(s => s.playDice);
  const games = useGame(s => s.games); // re-render on play
  const gamesToday = useGame(s => s.gamesToday);
  const left = gamesToday().diceLeft;
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState(null);

  const doRoll = () => {
    if (rolling) return;
    const r = playDice();
    if (!r.ok) { toast(r.err, 'warn'); return; }
    setRolling(true); setResult(null);
    setTimeout(() => { setRolling(false); setResult(r); }, 500);
  };

  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={[FONT.sub, { textAlign: 'center', marginBottom: 4 }]}>Roll two dice — doubles pay big, any other roll pays the average.</Text>
      <Text style={[FONT.tiny, { marginBottom: 14 }]}>{left} of {DAILY_PLAYS} free rolls left today</Text>
      <Row style={{ gap: 16, marginBottom: 16 }}>
        {[0, 1].map(i => {
          const v = result ? (i === 0 ? result.d1 : result.d2) : null;
          return (
            <View key={i} style={{
              width: 64, height: 64, borderRadius: 12, borderWidth: 2, borderColor: C.border,
              alignItems: 'center', justifyContent: 'center', backgroundColor: C.bgSoft,
            }}>
              {rolling
                ? <Icon name="dice-multiple" size={28} color={C.faint} />
                : <Icon name={`dice-${v || 1}`} size={34} color={v ? C.text : C.faint} />}
            </View>
          );
        })}
      </Row>
      <View style={{ minHeight: 30, alignItems: 'center' }}>
        {result ? (
          <Text style={[FONT.h3, { color: result.reward > 0 ? C.green : C.sub }]}>
            {result.doubles ? 'Doubles! ' : ''}{result.reward > 0 ? `+${result.reward} Gold` : 'No Gold — try again!'}
          </Text>
        ) : null}
      </View>
      <Btn title={rolling ? 'Rolling…' : 'Roll the dice'} kind="green" icon="dice-multiple" style={{ marginTop: 12, alignSelf: 'stretch' }}
        disabled={rolling || left <= 0} onPress={doRoll} />
      {left <= 0 ? <Text style={[FONT.tiny, { textAlign: 'center', marginTop: 6 }]}>Come back tomorrow for 10 more.</Text> : null}
    </View>
  );
}

function TollGateGame({ toast }) {
  const playTollGate = useGame(s => s.playTollGate);
  const revealGameResult = useGame(s => s.revealGameResult);
  const games = useGame(s => s.games); // re-render on play
  const gamesToday = useGame(s => s.gamesToday);
  const left = gamesToday().tollLeft;
  const [picking, setPicking] = useState(false);
  const [chosen, setChosen] = useState(null); // lane index tapped
  const [result, setResult] = useState(null);

  const pick = (i) => {
    if (picking || result) return;
    const r = playTollGate();
    if (!r.ok) { toast(r.err, 'warn'); return; }
    setPicking(true); setChosen(i);
    setTimeout(() => {
      setPicking(false); setResult(r);
      revealGameResult(r.lane.icon, r.message);
      haptic(r.lane.type === 'nothing' ? 'light' : r.lane.type === 'cash' ? 'success' : 'medium');
      if (r.lane.type !== 'nothing') play('coin', 0.8);
      toast(r.message, r.lane.type === 'nothing' ? 'info' : 'success');
    }, 500);
  };
  const again = () => { setChosen(null); setResult(null); };

  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={[FONT.sub, { textAlign: 'center', marginBottom: 4 }]}>
        Pick a lane at the toll gate — most pay a little Gold, one lane waves you through empty, and rarely the operator hands back real cash.
      </Text>
      <Text style={[FONT.tiny, { marginBottom: 16 }]}>{left} of {DAILY_PLAYS} free lanes left today</Text>
      <Row style={{ gap: 10, marginBottom: 16 }}>
        {[0, 1, 2, 3].map(i => {
          const isChosen = chosen === i;
          const showResult = isChosen && result;
          return (
            <Pressable key={i} onPress={() => pick(i)} disabled={picking || !!result || left <= 0}
              style={{
                width: 58, height: 74, borderRadius: 12, borderWidth: 2,
                borderColor: showResult ? (result.lane.type === 'nothing' ? C.border : C.green) : C.border,
                backgroundColor: showResult ? (result.lane.type === 'nothing' ? C.bgSoft : C.greenSoft) : C.bgSoft,
                alignItems: 'center', justifyContent: 'center', opacity: (result && !isChosen) ? 0.4 : 1,
              }}>
              <Icon name={isChosen && picking ? 'timer-sand' : showResult ? result.lane.icon : 'car-side'}
                size={26} color={showResult ? (result.lane.type === 'nothing' ? C.faint : C.green) : C.sub} />
              <Text style={[FONT.tiny, { marginTop: 4, fontWeight: '700' }]}>Lane {i + 1}</Text>
            </Pressable>
          );
        })}
      </Row>
      <View style={{ minHeight: 30, alignItems: 'center' }}>
        {result ? (
          <Text style={[FONT.h3, { color: result.lane.type === 'nothing' ? C.sub : C.green }]}>{result.lane.label}</Text>
        ) : null}
      </View>
      {result ? (
        <Btn title="Try another lane" kind="soft" icon="highway" style={{ marginTop: 8, alignSelf: 'stretch' }}
          disabled={left <= 0} onPress={again} />
      ) : null}
      {left <= 0 ? <Text style={[FONT.tiny, { textAlign: 'center', marginTop: 6 }]}>Come back tomorrow for 10 more.</Text> : null}
    </View>
  );
}


// High-Stakes Slots — pick your CASH bet with a slider, spin the same weighted
// reels. Three-of-a-kind pays bet × symbol multiplier (cherry ×2 … seven ×20),
// a pair returns 1.5×, anything else burns the stake. Real gambling economics.
function BetSlotGame({ toast }) {
  const playSlotBet = useGame(s => s.playSlotBet);
  const balance = useGame(s => s.balance);
  const games = useGame(s => s.games); // re-render on play
  const gamesToday = useGame(s => s.gamesToday);
  const left = gamesToday().betLeft;
  const maxBet = Math.max(10000, Math.min(1000000, Math.floor(balance / 1000) * 1000));
  const [bet, setBet] = useState(50000);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [display, setDisplay] = useState(['help', 'help', 'help']);
  const betClamped = Math.min(bet, maxBet);

  const doSpin = () => {
    if (spinning) return;
    const r = playSlotBet(betClamped);
    if (!r.ok) { toast(r.err, 'warn'); return; }
    setSpinning(true); setResult(null);
    haptic('medium');
    let ticks = 0;
    const iv = setInterval(() => {
      ticks++;
      setDisplay([0, 1, 2].map(() => SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)].icon));
      if (ticks > 10) {
        clearInterval(iv);
        setDisplay(r.reels.map(id => (SLOT_SYMBOLS.find(s => s.id === id) || {}).icon));
        setSpinning(false); setResult(r);
        haptic(r.isJackpot ? 'success' : r.winnings > 0 ? 'medium' : 'warn');
        if (r.winnings > 0) play('coin', 0.9);
        toast(r.message, r.net > 0 ? 'success' : r.winnings > 0 ? 'info' : 'error');
      }
    }, 90);
  };

  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={[FONT.sub, { textAlign: 'center', marginBottom: 4 }]}>
        Bet your own cash. Three of a kind pays 2×–20× the bet, a pair returns 1.5× — miss and the stake is gone.
      </Text>
      <Text style={[FONT.tiny, { marginBottom: 12 }]}>{left} of {DAILY_PLAYS} high-stakes spins left today</Text>
      <Row style={{ gap: 12, marginBottom: 14 }}>
        {[0, 1, 2].map(i => (
          <View key={i} style={{
            width: 60, height: 60, borderRadius: 12, borderWidth: 2,
            borderColor: result && result.isJackpot ? C.gold : C.border,
            alignItems: 'center', justifyContent: 'center', backgroundColor: C.bgSoft,
          }}>
            <Icon name={display[i] || 'help'} size={30} color={spinning ? C.faint : C.text} />
          </View>
        ))}
      </Row>
      <View style={{ alignSelf: 'stretch', marginBottom: 6 }}>
        <Row style={{ justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={FONT.tiny}>YOUR BET</Text>
          <Text style={[FONT.mono, { fontWeight: '800', color: C.blue }]}>{inr(betClamped)}</Text>
        </Row>
        <GameSlider min={10000} max={maxBet} step={10000} value={betClamped} onChange={setBet}
          minLabel="₹10K" maxLabel={inrShort(maxBet)} />
      </View>
      <View style={{ minHeight: 30, alignItems: 'center' }}>
        {result ? (
          <Text style={[FONT.h3, { color: result.net > 0 ? C.green : result.winnings > 0 ? C.sub : C.red }]}>
            {result.isJackpot ? 'JACKPOT! ' : ''}{result.net > 0 ? `+${inr(result.net)}` : result.winnings > 0 ? `${inr(result.net)} net` : `−${inr(result.stake)}`}
          </Text>
        ) : null}
      </View>
      <Btn title={spinning ? 'Spinning…' : `Bet ${inrShort(betClamped)} & spin`} kind="primary" icon="slot-machine-outline"
        style={{ marginTop: 8, alignSelf: 'stretch' }} disabled={spinning || left <= 0 || balance < 10000} onPress={doSpin} />
      {balance < 10000 ? <Text style={[FONT.tiny, { textAlign: 'center', marginTop: 6 }]}>Need at least ₹10,000 to play.</Text>
        : left <= 0 ? <Text style={[FONT.tiny, { textAlign: 'center', marginTop: 6 }]}>Come back tomorrow for 10 more.</Text> : null}
    </View>
  );
}

// Lucky Plate — a truck number plate rolls in with its last digit smudged.
// Guess it for +8 Gold. There IS a pattern hiding in plain sight; players who
// crack it win every time (and honestly, they've earned it).
function PlateGame({ toast }) {
  const startPlate = useGame(s => s.startPlate);
  const guessPlate = useGame(s => s.guessPlate);
  const games = useGame(s => s.games); // re-render on play
  const gamesToday = useGame(s => s.gamesToday);
  const left = gamesToday().plateLeft;
  const [plate, setPlate] = useState(null);
  const [result, setResult] = useState(null);

  const start = () => {
    const r = startPlate();
    if (!r.ok) { toast(r.err, 'warn'); return; }
    haptic('medium');
    setPlate(r); setResult(null);
  };
  const guess = (d) => {
    if (!plate || result) return;
    haptic('light'); play('tap', 0.4);
    const r = guessPlate(d);
    if (!r.ok) { toast(r.err, 'error'); return; }
    setResult(r);
    haptic(r.win ? 'success' : 'warn');
    toast(r.win ? '+8 Gold — dead right!' : `It was ${r.answer}. Look closer at the plate...`, r.win ? 'success' : 'info');
  };

  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={[FONT.sub, { textAlign: 'center', marginBottom: 4 }]}>
        The last digit of this plate is smudged. Guess it right for +8 Gold. Rumour says the digits aren't as random as they look…
      </Text>
      <Text style={[FONT.tiny, { marginBottom: 12 }]}>{left} of {DAILY_PLAYS} plates left today</Text>
      {plate ? (
        <View style={{
          flexDirection: 'row', alignItems: 'center', backgroundColor: '#FDF3C7', borderWidth: 2.5,
          borderColor: '#0B0F14', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14,
        }}>
          <Text style={{ fontSize: 22, fontWeight: '900', color: '#0B0F14', letterSpacing: 2 }}>
            {plate.series}-{String(plate.digits[0])}{String(plate.digits[1])}-{String(plate.digits[2])}{String(plate.digits[3])}-
          </Text>
          <View style={{
            width: 30, height: 30, borderRadius: 6, marginLeft: 2, alignItems: 'center', justifyContent: 'center',
            backgroundColor: result ? (result.win ? C.greenSoft : C.redSoft) : '#B9AE8B',
          }}>
            <Text style={{ fontSize: 18, fontWeight: '900', color: result ? (result.win ? C.green : C.red) : '#6B6250' }}>
              {result ? result.answer : '?'}
            </Text>
          </View>
        </View>
      ) : (
        <View style={{ alignItems: 'center', paddingVertical: 18 }}>
          <Icon name="card-text-outline" size={42} color={C.faint} />
          <Text style={[FONT.sub, { marginTop: 8 }]}>Tap below to flag down a passing truck.</Text>
        </View>
      )}
      {plate && !result ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 8 }}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => (
            <Pressable key={d} onPress={() => guess(d)} style={{
              width: 48, height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: C.border,
              backgroundColor: C.bgSoft, alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={[FONT.h3]}>{d}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={{ minHeight: 26, alignItems: 'center' }}>
        {result ? (
          <Text style={[FONT.h3, { color: result.win ? C.green : C.sub }]}>
            {result.win ? '+8 Gold!' : 'Wrong — study the digits you CAN see.'}
          </Text>
        ) : null}
      </View>
      <Btn title={plate && !result ? 'Pick the digit above' : 'New plate'} kind="green" icon="card-text"
        style={{ marginTop: 8, alignSelf: 'stretch' }} disabled={(plate && !result) || left <= 0} onPress={start} />
      {left <= 0 ? <Text style={[FONT.tiny, { textAlign: 'center', marginTop: 6 }]}>Come back tomorrow for 10 more.</Text> : null}
    </View>
  );
}

export function MiniGamesModal({ visible, onClose }) {
  const toast = useToast();
  const gold = useGame(s => s.gold);
  const [tab, setTab] = useState('scratch');
  const tapMidasEgg = useEasterEggTap('midas_touch', 7);
  useEffect(() => { if (visible) setTab('scratch'); }, [visible]);
  return (
    <Sheet visible={visible} onClose={onClose} title="Free Gold Games" height="86%">
      <Card style={{ marginBottom: 12, backgroundColor: C.bgSoft }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row><Icon name="gold" size={20} color={C.gold} /><Text style={[FONT.h3, { marginLeft: 6 }]}>Your Gold</Text></Row>
          <Pressable onPress={tapMidasEgg}><Text style={[FONT.h2, { color: C.gold }]}>{gold}</Text></Pressable>
        </Row>
      </Card>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 14 }}>
        <Row style={{ gap: 6 }}>
          <Chip label="Scratch Card" icon="ticket-confirmation" active={tab === 'scratch'} onPress={() => setTab('scratch')} />
          <Chip label="Lucky Spin" icon="rotate-right" active={tab === 'spin'} onPress={() => setTab('spin')} />
          <Chip label="Dice Roll" icon="dice-multiple" active={tab === 'dice'} onPress={() => setTab('dice')} />
          <Chip label="Toll Gate" icon="highway" color={C.green} active={tab === 'toll'} onPress={() => setTab('toll')} />
          <Chip label="High-Stakes" icon="slot-machine-outline" color={C.red} active={tab === 'bet'} onPress={() => setTab('bet')} />
          <Chip label="Lucky Plate" icon="card-text" color={C.gold} active={tab === 'plate'} onPress={() => setTab('plate')} />
        </Row>
      </ScrollView>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
        {tab === 'scratch' ? <ScratchGame toast={toast} /> : tab === 'spin' ? <SpinGame toast={toast} /> : tab === 'dice' ? <DiceGame toast={toast} />
          : tab === 'toll' ? <TollGateGame toast={toast} /> : tab === 'bet' ? <BetSlotGame toast={toast} />
            : <PlateGame toast={toast} />}
      </ScrollView>
    </Sheet>
  );
}

// ============ Driver Detail ============
// Tap a driver → full A→Z picture: profile, current delivery, live route with
// where they've reached, next break, ETA and career stats.
export function DriverDetailModal({ visible, onClose, staffId, onShowOnMap }) {
  const [driverTimelineOpen, setDriverTimelineOpen] = useState(false);
  const toast = useToast();
  const staff = useGame(s => s.staff);
  const trucks = useGame(s => s.trucks);
  const deliveries = useGame(s => s.deliveries);
  const promoteStaff = useGame(s => s.promoteStaff);
  const member = staff.find(x => x.id === staffId);
  const truck = member && member.truckId ? trucks.find(t => t.id === member.truckId) : null;
  const d = truck ? deliveries.find(x => x.truckId === truck.id) : null;
  useTick(visible && !!d);
  if (!member) return <Sheet visible={visible} onClose={onClose} title="Driver" height="40%"><View /></Sheet>;

  const role = STAFF_ROLES.find(r => r.id === member.role);
  const level = STAFF_LEVELS.find(l => l.id === member.level);
  const avatar = STAFF_AVATAR[`${member.role}:${member.gender}`] || 'account';
  const m = truck ? modelById(truck.modelId) : null;
  const now = Date.now();
  const prog = d ? Math.min(100, ((now - d.startedAt) / (d.endsAt - d.startedAt)) * 100) : 0;
  const eta = d ? fmtDur((d.endsAt - now) / 1000) : null;

  return (
    <Sheet visible={visible} onClose={onClose} title={member.name} height="88%">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
        <Row style={{ marginBottom: 12 }}>
          <View style={[cs.heroIcon, { backgroundColor: C.blueSoft }]}><Icon name={avatar} size={34} color={C.blue} /></View>
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={FONT.h2}>{member.name}</Text>
            <Row style={{ marginTop: 4, flexWrap: 'wrap' }}>
              <Pill text={`${level ? level.name : member.level} ${role ? role.name : member.role}`} icon={role ? role.icon : 'account'} />
              {(() => { const mood = staffMood(member, { trucks, deliveries }); return (
                <View style={{ marginLeft: 6 }}>
                  <Pill text={mood.label} icon={mood.icon} color={mood.color} bg={mood.color + '22'} />
                </View>
              ); })()}
            </Row>
            <Row style={{ marginTop: 6 }}>
              <Icon name="star" size={13} color={C.amber} />
              <Text style={[FONT.tiny, { marginLeft: 4 }]}>Skill {member.skill}/100 · {inrShort(member.salary)}/mo</Text>
            </Row>
          </View>
        </Row>

        {/* Promotion — manual, per employee. Skill jumps into the next level's
            band and the fresh-promotion buzz doubles output for 3 days. */}
        {(member.promoBoostUntil || 0) > Date.now() && (
          <Row style={{ backgroundColor: C.amberSoft, borderRadius: RADIUS.md, padding: 10, marginBottom: 12 }}>
            <Icon name="rocket-launch" size={16} color={C.gold} />
            <Text style={[FONT.tiny, { marginLeft: 6, flex: 1, color: C.text }]}>
              Promotion buzz active — 2× {member.role === 'driver' ? 'driving pace' : 'workshop efficiency'} for {fmtDur((member.promoBoostUntil - Date.now()) / 1000)} more.
            </Text>
          </Row>
        )}
        {(() => {
          const ladder = ['junior', 'senior', 'expert'];
          const idx = ladder.indexOf(member.level);
          if (idx === -1 || idx >= ladder.length - 1) return null;
          const next = STAFF_LEVELS.find(l => l.id === ladder[idx + 1]);
          return (
            <Btn
              title={`Promote to ${next.name} (${inrShort(Math.max(member.salary * 1.1, next.salary[0]))}–${inrShort(next.salary[1])}/mo)`}
              kind="green" icon="account-arrow-up" style={{ marginBottom: 12 }}
              onPress={() => {
                const r = promoteStaff(member.id);
                toast(r.ok ? `Promoted to ${r.level} — skill ${r.newSkill}, 2× boost for 3 days!` : r.err, r.ok ? 'success' : 'error');
              }}
            />
          );
        })()}

        {/* Current delivery */}
        {d && m ? (
          <>
            <Card style={{ marginBottom: 12 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={FONT.h3}>{cityById(d.fromCityId)?.name} → {cityById(d.toCityId)?.name}</Text>
                <Text style={[FONT.mono, { color: C.blue }]}>ETA {eta}</Text>
              </Row>
              <Row style={{ marginTop: 4 }}>
                <Icon name={m.icon} size={14} color={C.sub} />
                <Text style={[FONT.tiny, { marginLeft: 4 }]}>{truck.customName || m.name} · {d.cargoTons} t · {cargoById(d.cargoType)?.name}</Text>
              </Row>
              <Progress pct={prog} color={C.green} style={{ marginTop: 8 }} />
              <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
                <Text style={FONT.tiny}>{Math.round(d.route.roadKm * prog / 100)} / {d.route.roadKm} km</Text>
                <Text style={FONT.tiny}>{Math.round(prog)}%</Text>
              </Row>
            </Card>
            <Card style={{ marginBottom: 12 }}>
              <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={FONT.h3}>Live Route</Text>
                <Btn title="Full Timeline" kind="soft" small icon="map-marker-path" onPress={() => setDriverTimelineOpen(true)} />
              </Row>
            </Card>
            {driverTimelineOpen && (
              <Sheet visible={driverTimelineOpen} onClose={() => setDriverTimelineOpen(false)} title="Full Shipment Timeline" height="80%">
                <ScrollView showsVerticalScrollIndicator={false}>
                  <JourneyTracker delivery={d} model={m} />
                </ScrollView>
              </Sheet>
            )}
          </>
        ) : (
          <Card style={{ marginBottom: 12, alignItems: 'center', padding: 20 }}>
            <Icon name="steering" size={30} color={C.faint} />
            <Text style={[FONT.sub, { marginTop: 8, textAlign: 'center' }]}>
              {truck ? `Assigned to ${truck.customName || m?.name} — currently ${truck.status}. No active delivery.` : 'Not assigned to a truck yet. Assign this driver from the Staff panel.'}
            </Text>
          </Card>
        )}

        {/* Career — live: the in-progress trip is added in real time as the
            truck drives, then committed permanently when the delivery finishes. */}
        {(() => {
          const tripHours = d && m ? d.route.roadKm / m.speed : 0;
          const liveKm = Math.round((member.kmDriven || 0) + (d ? d.route.roadKm * prog / 100 : 0));
          const liveHours = Math.round(((member.hoursDriven || 0) + tripHours * prog / 100) * 10) / 10;
          return (
            <Card>
              <Row style={{ justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={FONT.h3}>Career</Text>
                {d ? <Pill text="Live · updating" icon="pulse" color={C.green} bg={C.greenSoft} /> : null}
              </Row>
              <SpecRow icon="steering" label="Hours driven" value={`${liveHours} h`} />
              <SpecRow icon="sleep" label="Sleep hours" value={`${member.sleepHours || 0} h`} />
              <SpecRow icon="package-variant-closed-check" label="Deliveries" value={`${member.deliveries || 0}${d ? ' · +1 in transit' : ''}`} />
              <SpecRow icon="map-marker-distance" label="Distance driven" value={`${liveKm.toLocaleString('en-IN')} km`} />
            </Card>
          );
        })()}

        {truck && (
          <Btn title="Show truck on map" kind="soft" icon="crosshairs-gps" style={{ marginTop: 12 }}
            onPress={() => { onShowOnMap && onShowOnMap(truck); }} />
        )}
      </ScrollView>
    </Sheet>
  );
}

// ============ Notifications ============
// The feed can hold hundreds of entries — rendering them all makes the sheet
// heavy to open. Show the newest NOTIF_PAGE, and load the rest in pages via a
// "Show more" footer (count resets whenever the sheet reopens or filter flips).
const NOTIF_PAGE = 12;
export function NotificationsModal({ visible, onClose }) {
  const notifications = useGame(s => s.notifications);
  const markRead = useGame(s => s.markRead);
  const markAllRead = useGame(s => s.markAllRead);
  const [filter, setFilter] = useState('all');
  const [shownCount, setShownCount] = useState(NOTIF_PAGE);
  const tapInboxEgg = useEasterEggTap('inbox_zero', 5);
  useEffect(() => { if (visible) setShownCount(NOTIF_PAGE); }, [visible, filter]);
  const list = notifications.filter(n => filter === 'all' || (filter === 'delivery' ? n.type === 'delivery' : n.type !== 'delivery'));
  const shown = list.slice(0, shownCount);
  const hidden = list.length - shown.length;
  return (
    <Sheet visible={visible} onClose={onClose} title="Notifications" height="82%">
      <Row style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <Row style={{ gap: 6 }}>
          <Chip label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
          <Chip label="Deliveries" active={filter === 'delivery'} onPress={() => setFilter('delivery')} />
          <Chip label="System" active={filter === 'system'} onPress={() => setFilter('system')} />
        </Row>
        <Btn title="Mark all read" kind="ghost" small onPress={() => { tapInboxEgg(); markAllRead(); }} />
      </Row>
      <FlatList
        data={shown} keyExtractor={n => n.id} showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 30 }}
        initialNumToRender={NOTIF_PAGE} windowSize={5} removeClippedSubviews
        ListEmptyComponent={<View style={{ alignItems: 'center', padding: 30 }}><Icon name="bell-sleep-outline" size={30} color={C.faint} /><Text style={[FONT.sub, { marginTop: 6 }]}>Nothing yet.</Text></View>}
        ListFooterComponent={hidden > 0 ? (
          <Pressable onPress={() => setShownCount(c => c + 15)}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12 }}>
            <Icon name="chevron-down" size={16} color={C.blue} />
            <Text style={{ color: C.blue, fontWeight: '700', marginLeft: 4 }}>Show more ({hidden} older)</Text>
          </Pressable>
        ) : null}
        renderItem={({ item: n }) => (
          <Pressable onPress={() => markRead(n.id)} style={[cs.notif, !n.read && { backgroundColor: C.blueSoft }]}>
            <View style={[cs.notifIcon, { backgroundColor: n.read ? C.bgSoft : '#fff' }]}><Icon name={n.icon} size={18} color={C.blue} /></View>
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={[FONT.body, { fontWeight: n.read ? '500' : '700' }]}>{n.message}</Text>
              <Text style={FONT.tiny}>{relTime(n.ts)}</Text>
            </View>
            {!n.read && <View style={cs.dot} />}
          </Pressable>
        )}
      />
    </Sheet>
  );
}

const EGGS_INITIAL = 6;

// ============ Backup (export / import / auto-backup) ============
// Exports the COMPLETE save — company, money, trucks, live deliveries, hubs,
// countries, achievements, eggs, settings, everything — as versioned JSON
// (see engine/backup.js). Importable on any device running the same or a
// newer app version.
// Before/after comparison for a restore (auto-backup or picked file) — shows
// exactly what changes, current vs incoming, before anything is touched.
function buildRestoreDiff(current, incoming) {
  if (!current || !incoming) return [];
  const hubNames = (s) => (s?.hubs || []).map(h => h.name).join(', ') || '—';
  const rows = [
    { icon: 'cash-multiple', label: 'Cash Balance', before: inr(current.balance || 0), after: inr(incoming.balance || 0) },
    { icon: 'gold', label: 'Gold', before: String(current.gold || 0), after: String(incoming.gold || 0) },
    { icon: 'domain', label: 'Company', before: current.company?.name || '—', after: incoming.company?.name || '—' },
    { icon: 'truck', label: 'Fleet Size', before: String((current.trucks || []).length), after: String((incoming.trucks || []).length) },
    { icon: 'account-group', label: 'Staff', before: String((current.staff || []).length), after: String((incoming.staff || []).length) },
    { icon: 'garage', label: 'HQ & Garages', before: hubNames(current), after: hubNames(incoming) },
    { icon: 'earth', label: 'Countries Unlocked', before: String((current.unlockedCountries || ['IN']).length), after: String((incoming.unlockedCountries || ['IN']).length) },
    { icon: 'diamond-stone', label: 'Hidden Gems Found', before: String((current.easterEggs?.found || []).length), after: String((incoming.easterEggs?.found || []).length) },
    { icon: 'chart-line', label: 'Lifetime Revenue', before: inrShort(current.stats?.revenue || 0), after: inrShort(incoming.stats?.revenue || 0) },
    { icon: 'map-marker-distance', label: 'Lifetime Distance', before: `${Math.round(current.stats?.km || 0).toLocaleString()} km`, after: `${Math.round(incoming.stats?.km || 0).toLocaleString()} km` },
  ];
  return rows.map(r => ({ ...r, changed: r.before !== r.after }));
}
function RestoreDiffCard({ current, incoming }) {
  const rows = useMemo(() => buildRestoreDiff(current, incoming), [current, incoming]);
  return (
    <Card style={{ marginTop: 10, backgroundColor: '#0F172A', borderColor: '#1E293B' }}>
      <Row style={{ marginBottom: 8 }}>
        <Icon name="compare-horizontal" size={16} color="#5B8DF0" />
        <Text style={[FONT.body, { fontWeight: '800', marginLeft: 6, color: '#F8FAFC' }]}>What Changes If You Restore</Text>
      </Row>
      {rows.map((r, i) => (
        <View key={r.label} style={[{ paddingVertical: 7 }, i > 0 && { borderTopWidth: 1, borderTopColor: '#1E293B' }]}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row style={{ flex: 1 }}>
              <Icon name={r.icon} size={14} color="#64748B" />
              <Text style={[FONT.tiny, { marginLeft: 6, color: '#94A3B8' }]}>{r.label}</Text>
            </Row>
          </Row>
          <Row style={{ marginTop: 2 }}>
            <Text style={[FONT.tiny, { color: r.changed ? '#F87171' : '#94A3B8', flex: 1 }]} numberOfLines={1}>Now: {r.before}</Text>
            <Icon name="arrow-right" size={12} color="#64748B" style={{ marginHorizontal: 4 }} />
            <Text style={[FONT.tiny, { color: r.changed ? '#4ADE80' : '#94A3B8', fontWeight: r.changed ? '800' : '400', flex: 1, textAlign: 'right' }]} numberOfLines={1}>After: {r.after}</Text>
          </Row>
        </View>
      ))}
    </Card>
  );
}

// ============ QR Backup Transfer (phone-to-phone, no cable/internet) ============
// A full save can't fit in one QR code (QR's hard capacity ceiling is a few
// KB; a real save is much bigger) — so it's compressed and shown as a
// SEQUENCE of QR codes that auto-advance; the receiving phone's camera
// captures them in any order, and the moment every frame is in, the exact
// same before/after diff card used for file restore appears before anything
// is touched.
function QrExportPanel({ snapshot }) {
  const built = useMemo(() => buildQrFrames(snapshot), [snapshot]);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    if (!playing || built.frames.length <= 1) return undefined;
    const iv = setInterval(() => setIdx(i => (i + 1) % built.frames.length), 900);
    return () => clearInterval(iv);
  }, [playing, built.frames.length]);

  return (
    <View style={{ alignItems: 'center' }}>
      <Card style={{ padding: 16, alignItems: 'center' }}>
        <QRCode value={built.frames[idx]} size={230} />
      </Card>
      <Text style={[FONT.body, { fontWeight: '800', marginTop: 12 }]}>
        Frame {idx + 1} of {built.totalFrames}
      </Text>
      <Progress pct={((idx + 1) / built.totalFrames) * 100} color={C.blue} style={{ width: 230, marginTop: 8 }} />
      <Text style={[FONT.tiny, { textAlign: 'center', marginTop: 10, paddingHorizontal: 10 }]}>
        Hold the OTHER phone's camera on this screen — it auto-advances and loops, so a slower camera gets extra passes to catch every frame.
      </Text>
      <Row style={{ gap: 10, marginTop: 14 }}>
        <Btn title="◀" kind="soft" small onPress={() => { setPlaying(false); setIdx(i => (i - 1 + built.totalFrames) % built.totalFrames); }} />
        <Btn title={playing ? 'Pause' : 'Play'} kind={playing ? 'soft' : 'blue'} small icon={playing ? 'pause' : 'play'} onPress={() => setPlaying(p => !p)} />
        <Btn title="▶" kind="soft" small onPress={() => { setPlaying(false); setIdx(i => (i + 1) % built.totalFrames); }} />
      </Row>
      <Text style={[FONT.tiny, { color: C.faint, marginTop: 8 }]}>{built.rawBytes.toLocaleString()}B compressed (~{Math.round(JSON.stringify(snapshot).length / 1024)}KB save)</Text>
    </View>
  );
}

function QrScanPanel({ current, onRestored }) {
  const receiverRef = useRef(createQrReceiver());
  const [progress, setProgress] = useState({ have: 0, total: 0 });
  const [permission, setPermission] = useState(Platform.OS === 'android' ? null : true); // null = unknown/asking
  const [scanned, setScanned] = useState(null); // reassembled save, pending confirmation
  const [lastError, setLastError] = useState(null);
  const busyRef = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA).then(res => {
      setPermission(res === PermissionsAndroid.RESULTS.GRANTED);
    }).catch(() => setPermission(false));
  }, []);

  const onReadCode = (event) => {
    if (busyRef.current || scanned) return;
    const text = event?.nativeEvent?.codeStringValue;
    if (!text) return;
    busyRef.current = true;
    const r = receiverRef.current.addFrame(text);
    setProgress(r.progress);
    if (r.error) setLastError(r.error);
    else setLastError(null);
    if (r.done) {
      haptic('success');
      setScanned(r.data);
    }
    setTimeout(() => { busyRef.current = false; }, 150); // small debounce, camera fires fast
  };

  const resetScan = () => { receiverRef.current.reset(); setScanned(null); setProgress({ have: 0, total: 0 }); setLastError(null); };

  if (permission === false) {
    return (
      <Card style={{ alignItems: 'center', padding: 24 }}>
        <Icon name="camera-off-outline" size={36} color={C.faint} />
        <Text style={[FONT.body, { fontWeight: '700', marginTop: 10, textAlign: 'center' }]}>Camera permission needed</Text>
        <Text style={[FONT.tiny, { textAlign: 'center', marginTop: 6 }]}>Enable camera access for this app in your phone's Settings to scan a QR transfer.</Text>
      </Card>
    );
  }
  if (permission === null) {
    return <Card style={{ alignItems: 'center', padding: 24 }}><Text style={FONT.sub}>Requesting camera permission…</Text></Card>;
  }

  if (scanned) {
    return (
      <View>
        <Card style={{ marginBottom: 10, backgroundColor: C.greenSoft }}>
          <Row><Icon name="check-decagram" size={16} color={C.green} /><Text style={[FONT.body, { fontWeight: '700', marginLeft: 6, color: C.text }]}>All {progress.total} frames captured — verified.</Text></Row>
        </Card>
        <RestoreDiffCard current={current} incoming={scanned} />
        <Row style={{ marginTop: 10, gap: 8 }}>
          <View style={{ flex: 1 }}><Btn title="Cancel" kind="ghost" onPress={resetScan} /></View>
          <View style={{ flex: 1 }}>
            <Btn title="Restore This" kind="danger" icon="backup-restore" onPress={() => { onRestored(scanned); resetScan(); }} />
          </View>
        </Row>
      </View>
    );
  }

  return (
    <View>
      <View style={{ width: '100%', height: 280, borderRadius: RADIUS.lg, overflow: 'hidden', backgroundColor: '#000' }}>
        <Camera style={{ flex: 1 }} scanBarcode onReadCode={onReadCode} showFrame={false} laserColor="#2563EB" frameColor="#2563EB" />
      </View>
      <Text style={[FONT.body, { fontWeight: '800', textAlign: 'center', marginTop: 12 }]}>
        {progress.total ? `Captured ${progress.have} of ${progress.total} frames` : 'Point at the other phone\'s QR slideshow'}
      </Text>
      {progress.total > 0 && <Progress pct={(progress.have / progress.total) * 100} color={C.blue} style={{ marginTop: 8 }} />}
      {lastError ? <Text style={[FONT.tiny, { color: C.red, textAlign: 'center', marginTop: 8 }]}>{lastError}</Text> : null}
      <Text style={[FONT.tiny, { textAlign: 'center', marginTop: 10 }]}>
        Order doesn't matter — hold steady and let it cycle through the other phone's frames.
      </Text>
    </View>
  );
}

export function QrBackupModal({ visible, onClose }) {
  const toast = useToast();
  const cloudSnapshot = useGame(s => s.cloudSnapshot);
  const applyCloudState = useGame(s => s.applyCloudState);
  const [tab, setTab] = useState('export'); // 'export' | 'scan'
  useEffect(() => { if (visible) setTab('export'); }, [visible]);
  if (!visible) return <Sheet visible={false} onClose={onClose} title="QR Transfer" height="90%"><View /></Sheet>;
  const current = cloudSnapshot();

  return (
    <Sheet visible={visible} onClose={onClose} title="QR Transfer" height="92%">
      <Row style={{ gap: 6, marginBottom: 14 }}>
        <Chip label="Show My QR (Send)" icon="qrcode" active={tab === 'export'} onPress={() => setTab('export')} />
        <Chip label="Scan a QR (Receive)" icon="camera-outline" active={tab === 'scan'} onPress={() => setTab('scan')} />
      </Row>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
        {tab === 'export' ? (
          <QrExportPanel snapshot={current} />
        ) : (
          <QrScanPanel current={current} onRestored={(data) => {
            applyCloudState(data);
            toast('Save restored from QR transfer — welcome back, boss!', 'success');
            onClose();
          }} />
        )}
      </ScrollView>
    </Sheet>
  );
}

function BackupTab({ onClose }) {
  const toast = useToast();
  const lastBackupAt = useGame(s => s.lastBackupAt);
  const cloudSnapshot = useGame(s => s.cloudSnapshot);
  const applyCloudState = useGame(s => s.applyCloudState);
  const backupNow = useGame(s => s.backupNow);
  // pending = a picked & validated file waiting for the confirm tap.
  const [pending, setPending] = useState(null); // {data, meta, fileName}
  const [busy, setBusy] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  const doExport = async () => {
    setBusy(true);
    try {
      const r = await exportBackup(cloudSnapshot());
      toast(r.ok ? `Backup file saved: ${r.path}` : r.err, r.ok ? 'success' : 'error');
    } catch (e) { toast('Export failed — try again', 'error'); }
    setBusy(false);
  };

  // Step 1: pick the .json via the system file picker and validate it.
  const doPickFile = async () => {
    setBusy(true);
    const f = await pickBackupFile();
    setBusy(false);
    if (f.cancelled) return;
    if (!f.ok) { toast(f.err, 'error'); return; }
    const r = parseBackup(f.text);
    if (!r.ok) { setPending(null); toast(r.err, 'error'); return; }
    setPending({ data: r.data, meta: r.meta, fileName: f.name });
  };

  // Step 2: explicit confirm replaces the current game.
  const doImport = () => {
    if (!pending) return;
    applyCloudState(pending.data);
    toast(`Backup from ${pending.meta.version} imported — welcome back, boss!`, 'success');
    setPending(null);
    onClose && onClose();
  };

  // Two-step: first tap FETCHES the auto-backup and shows the diff (nothing
  // touched yet); second, explicit tap actually restores it.
  const [pendingAuto, setPendingAuto] = useState(null);
  const doFetchAuto = async () => {
    setBusy(true);
    const p = await readAutoBackup();
    setBusy(false);
    if (!p) { toast('No auto-backup found on this device yet', 'error'); return; }
    setPendingAuto(p.data);
  };
  const doRestoreAuto = () => {
    if (!pendingAuto) return;
    applyCloudState(pendingAuto);
    toast('Auto-backup restored', 'success');
    setPendingAuto(null);
    onClose && onClose();
  };

  return (
    <>
      <SectionTitle icon="database-export" text="Export & Share" />
      <Card>
        <Text style={FONT.sub}>
          Exports your entire game — A to Z, from money and trucks to unlocked countries and achievements — as a
          <Text style={{ fontWeight: '800' }}> versioned .json backup file</Text> saved into your phone's Downloads folder. Copy or send that file to move your empire to another device.
        </Text>
        <Btn title={busy ? 'Working…' : 'Export backup file'} kind="green" icon="file-export-outline" disabled={busy} onPress={doExport} style={{ marginTop: 12 }} />
        <Text style={[FONT.tiny, { marginTop: 8 }]}>
          Format: TruckEmpire-backup-{APP_VERSION}-date.json · importable on {APP_VERSION} or any newer version.
        </Text>
      </Card>

      <SectionTitle icon="qrcode" text="QR Transfer (phone to phone)" />
      <Card>
        <Text style={FONT.sub}>
          No cable, no internet: show a QR slideshow on this phone and scan it with the other phone's camera — full A-to-Z save (company, money, gold, trucks, staff, achievements, hidden gems, everything), same before/after diff before anything is restored.
        </Text>
        <Btn title="Open QR Transfer" kind="blue" icon="qrcode-scan" style={{ marginTop: 12 }} onPress={() => setQrOpen(true)} />
      </Card>
      {qrOpen && <QrBackupModal visible={qrOpen} onClose={() => setQrOpen(false)} />}

      <SectionTitle icon="history" text="Auto-Backup" />
      <Card>
        <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={[FONT.body, { fontWeight: '700' }]}>Daily local safety copy</Text>
            <Text style={FONT.tiny}>
              {lastBackupAt ? `Last auto-backup ${relTime(lastBackupAt)}` : 'No backup taken yet'} · runs once every real day, automatically.
            </Text>
          </View>
          <Btn title="Back up now" small kind="soft" icon="content-save-outline"
            onPress={() => { backupNow(); toast('Snapshot saved on this device', 'success'); }} />
        </Row>
        {!pendingAuto ? (
          <Btn title={busy ? 'Checking…' : 'Check auto-backup'} kind="soft" icon="backup-restore" disabled={busy} onPress={doFetchAuto} style={{ marginTop: 12 }} />
        ) : (
          <>
            <RestoreDiffCard current={cloudSnapshot()} incoming={pendingAuto} />
            <Row style={{ marginTop: 10, gap: 8 }}>
              <View style={{ flex: 1 }}><Btn title="Cancel" kind="ghost" onPress={() => setPendingAuto(null)} /></View>
              <View style={{ flex: 1 }}><Btn title="Restore This" kind="danger" icon="backup-restore" onPress={doRestoreAuto} /></View>
            </Row>
          </>
        )}
      </Card>

      <SectionTitle icon="database-import" text="Import" />
      <Card>
        <Text style={FONT.sub}>Pick the backup .json file (from Downloads, Drive, WhatsApp — anywhere on the phone). It's checked before anything is touched.</Text>
        <Btn title={busy ? 'Working…' : 'Choose backup file'} kind="blue" icon="folder-open-outline"
          disabled={busy} onPress={doPickFile} style={{ marginTop: 10 }} />
        {pending && (
          <View style={{ marginTop: 10, backgroundColor: C.blueSoft, borderRadius: RADIUS.md, padding: 10 }}>
            <Row>
              <Icon name="file-check-outline" size={16} color={C.blue} />
              <Text style={[FONT.body, { fontWeight: '700', marginLeft: 6, flex: 1 }]} numberOfLines={1}>{pending.fileName}</Text>
            </Row>
            <Text style={[FONT.tiny, { marginTop: 2 }]}>
              Valid backup · from {pending.meta.version}{pending.meta.savedAt ? ` · saved ${relTime(new Date(pending.meta.savedAt).getTime())}` : ''}
              {pending.data.company?.name ? ` · company "${pending.data.company.name}"` : ''}
            </Text>
            <RestoreDiffCard current={cloudSnapshot()} incoming={pending.data} />
            <Btn title="Import — replaces the current game" kind="danger" icon="database-import" onPress={doImport} style={{ marginTop: 8 }} />
          </View>
        )}
        <Row style={{ marginTop: 10, backgroundColor: C.amberSoft, borderRadius: RADIUS.md, padding: 8 }}>
          <Icon name="shield-alert-outline" size={14} color={C.amber} />
          <Text style={[FONT.tiny, { marginLeft: 6, flex: 1, color: C.text }]}>
            Importing replaces everything on this device. Backups from a newer app version than {APP_VERSION} are rejected — update the app first.
          </Text>
        </Row>
      </Card>
    </>
  );
}

// ============ Achievements (Steam-style: tiered tracks with progress) ============
const TIER_COLORS = ['#8D99AE', '#B08D57', '#8FA6B2', '#E9B949', '#7D3C98'];
function AchievementsTab() {
  const state = useGame();
  const unlocked = state.achievements?.unlocked || {};
  const fmtVal = (a, v) => a.unit === '₹' ? inrShort(v) : Math.floor(v).toLocaleString();
  const totalTiers = ACHIEVEMENTS.length * ACHIEVEMENT_TIERS.length;
  const doneTiers = Object.keys(unlocked).length;
  return (
    <>
      <SectionTitle icon="trophy" text={`Achievements — ${doneTiers}/${totalTiers} unlocked`} />
      <Card style={{ marginBottom: 12, backgroundColor: C.bgSoft }}>
        <Text style={FONT.sub}>Every track has 5 levels — {ACHIEVEMENT_TIERS.join(' → ')}. Each level pays a one-time gold bonus the moment you reach it.</Text>
      </Card>
      {ACHIEVEMENTS.map(a => {
        const v = achievementValue(state, a.id);
        // Highest tier reached, and the next target being chased.
        let reached = -1;
        for (let i = 0; i < a.levels.length; i++) if (unlocked[`${a.id}:${i}`] || v >= a.levels[i]) reached = i;
        const next = reached + 1 < a.levels.length ? a.levels[reached + 1] : null;
        const base = reached >= 0 ? a.levels[reached] : 0;
        const pct = next ? Math.min(100, ((v - base) / (next - base)) * 100) : 100;
        const maxed = next === null;
        return (
          <Card key={a.id} style={{ marginBottom: 8 }}>
            <Row>
              <View style={[cs.heroIcon, { width: 44, height: 44, backgroundColor: maxed ? C.amberSoft : C.bgSoft }]}>
                <Icon name={a.icon} size={24} color={maxed ? C.gold : reached >= 0 ? C.blue : C.faint} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={[FONT.body, { fontWeight: '800' }]}>{a.title}</Text>
                  <Pill
                    text={maxed ? 'Legend ★' : reached >= 0 ? ACHIEVEMENT_TIERS[reached] : 'Locked'}
                    icon={maxed ? 'crown' : reached >= 0 ? 'medal' : 'lock-outline'}
                    color={reached >= 0 ? TIER_COLORS[Math.min(reached, 4)] : C.faint}
                    bg={reached >= 0 ? TIER_COLORS[Math.min(reached, 4)] + '22' : C.bgSoft} />
                </Row>
                <Text style={FONT.tiny}>{a.desc}</Text>
              </View>
            </Row>
            <Progress pct={pct} color={maxed ? C.gold : C.blue} style={{ marginTop: 10 }} />
            <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
              <Text style={FONT.tiny}>{fmtVal(a, v)} {a.unit}</Text>
              <Text style={FONT.tiny}>
                {maxed ? 'All 5 levels complete!' : `Next: ${ACHIEVEMENT_TIERS[reached + 1]} at ${fmtVal(a, next)} (+${ACHIEVEMENT_TIER_GOLD[reached + 1]} gold)`}
              </Text>
            </Row>
            {/* 5 tier dots */}
            <Row style={{ gap: 6, marginTop: 8 }}>
              {a.levels.map((lv, i) => (
                <View key={i} style={{ flex: 1, alignItems: 'center', paddingVertical: 4, borderRadius: 8,
                  backgroundColor: i <= reached ? TIER_COLORS[i] + '22' : C.bgSoft }}>
                  <Icon name={i <= reached ? 'check-decagram' : 'circle-outline'} size={13} color={i <= reached ? TIER_COLORS[i] : C.faint} />
                  <Text style={[FONT.tiny, { fontSize: 9 }]} numberOfLines={1}>{fmtVal(a, lv)}</Text>
                </View>
              ))}
            </Row>
          </Card>
        );
      })}
    </>
  );
}

// ============ Roadmap (upcoming plans — tentative, tucked in Settings) ============
// A quiet corner listing what MIGHT come next. Everything here is tentative,
// not a promise — plans get promoted out of this list into real releases.
const ROADMAP_ITEMS = [
  { icon: 'truck-trailer', title: 'Trailer & Truck Upgrades', status: 'exploring',
    desc: 'Engine, tyres, GPS and security upgrades per truck — security cuts theft risk, tyres cut bursts, engine adds pace.' },
  { icon: 'robot-industrial', title: 'Rival AI Companies', status: 'exploring',
    desc: '2–3 bot transport companies that snap up contracts you ignore, buy garages before you and fight you on a live leaderboard.' },
  { icon: 'shield-car', title: 'Cargo Insurance Policies', status: 'planned',
    desc: 'Monthly premium per truck; insured trucks recover most of the money lost to theft, accidents and weather damage.' },
  { icon: 'gavel', title: 'Truck Auctions', status: 'planned',
    desc: 'A weekly second-hand auction house — bid on used rigs below market price, sell your old ones to the highest bidder.' },
  { icon: 'firework', title: 'Festival Seasons', status: 'planned',
    desc: 'Diwali, Holi and New Year events: limited-time cargo rushes, double tips, festive map skins and special rewards.' },
  { icon: 'account-group', title: 'Driver Union Events', status: 'exploring',
    desc: 'Strikes, bonus demands and morale meetings — keep the crew happy or watch the fleet park itself.' },
  { icon: 'ev-station', title: 'EV Economy Overhaul', status: 'exploring',
    desc: 'Charging networks, battery degradation, green-cargo contracts that only electric trucks can take.' },
  { icon: 'train', title: 'Rail & Air Cargo', status: 'someday',
    desc: 'Book train wagons and air freight for long hauls — cheaper/faster trade-offs against your own trucks.' },
  { icon: 'star-circle', title: 'City Reputation', status: 'someday',
    desc: 'Deliver often to a city and it starts trusting you: better rates, faster loading, exclusive contracts.' },
  { icon: 'newspaper-variant', title: 'Apna News Channel', status: 'shipped',
    desc: 'SHIPPED in v3.0.0 — fuel desk, weather bulletins, trip advice and the gossip column, live on the map.' },
  { icon: 'routes', title: 'Real Roads (Google-Maps style)', status: 'beta',
    desc: 'Trucks following actual highway geometry bend by bend. Already LIVE in the private beta build — graduating here soon.' },
  { icon: 'shield-home', title: 'Garage Upgrades', status: 'exploring',
    desc: 'Level up garages: bigger fuel discounts, faster loading, covered parking that slows condition wear.' },
  { icon: 'school', title: 'Driver Academy', status: 'exploring',
    desc: 'Send drivers to training between trips — buy XP with time and cash instead of only earning it on the road.' },
  { icon: 'camera', title: 'Photo Mode — Empire Report Card', status: 'shipped',
    desc: 'SHIPPED — open from Company Insights (tap your profile pill): a trophy-style stats card with records (longest haul, best trip) and one-tap share.' },
  { icon: 'music', title: 'Sound & Music Pass', status: 'someday',
    desc: 'Ambient highway audio, per-country map music, and a horn on tap-and-hold — Horn OK Please.' },
  { icon: 'content-save-all', title: 'Multiple Save Slots', status: 'someday',
    desc: 'Run more than one company, restore any of them anywhere with a company code.' },
  { icon: 'translate', title: 'Hindi & Gujarati', status: 'someday',
    desc: 'Full localisation for the languages the game\'s heartland actually speaks.' },
  { icon: 'account-multiple', title: 'Convoy Multiplayer', status: 'dream',
    desc: 'True partner play — shared convoys and cargo exchange. Needs a server, so it lives at the very end of this list.' },
];
const ROADMAP_STATUS = {
  shipped: { label: 'Shipped ✓', color: C.green, bg: C.greenSoft },
  beta: { label: 'In Beta', color: '#C0161C', bg: '#C0161C22' },
  planned: { label: 'Planned', color: C.green, bg: C.greenSoft },
  exploring: { label: 'Exploring', color: C.blue, bg: C.blueSoft },
  someday: { label: 'Someday', color: C.amber, bg: C.amberSoft },
  dream: { label: 'Dream', color: '#7D3C98', bg: '#7D3C9822' },
};
const ROADMAP_INITIAL = 5;
function RoadmapTab() {
  const [showAll, setShowAll] = useState(false);
  const items = showAll ? ROADMAP_ITEMS : ROADMAP_ITEMS.slice(0, ROADMAP_INITIAL);
  return (
    <>
      <SectionTitle icon="map-clock-outline" text="Upcoming Plans" />
      <Card style={{ marginBottom: 12, backgroundColor: C.blueSoft }}>
        <Row>
          <Icon name="information-outline" size={14} color={C.blue} />
          <Text style={[FONT.tiny, { marginLeft: 6, flex: 1, color: C.text }]}>
            A peek at the workshop. Everything below is TENTATIVE — ideas being weighed, not promises. Order and content change with every release.
          </Text>
        </Row>
      </Card>
      {items.map(it => {
        const stMeta = ROADMAP_STATUS[it.status] || ROADMAP_STATUS.someday;
        return (
          <Card key={it.title} style={{ marginBottom: 8, padding: 12 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row style={{ flex: 1, marginRight: 8 }}>
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={it.icon} size={20} color={C.sub} />
                </View>
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={[FONT.body, { fontWeight: '800' }]}>{it.title}</Text>
                  <Text style={FONT.tiny}>{it.desc}</Text>
                </View>
              </Row>
              <Pill text={stMeta.label} color={stMeta.color} bg={stMeta.bg} />
            </Row>
          </Card>
        );
      })}
      <Btn
        title={showAll ? 'Show less' : `Show more plans (${ROADMAP_ITEMS.length - ROADMAP_INITIAL} hidden)`}
        kind="soft" icon={showAll ? 'chevron-up' : 'chevron-down'} style={{ marginTop: 4 }}
        onPress={() => setShowAll(v => !v)}
      />
      <Text style={[FONT.tiny, { textAlign: 'center', marginTop: 10 }]}>
        Got an idea? It probably belongs on this list — tell the developer.
      </Text>
    </>
  );
}

// ============ Settings ============
// v3.1.0 redesign: info-first. Profile & Company open as clean VIEW pages —
// a read-only summary card with an Edit button; the form only appears in
// edit mode and returns to the view after saving.
function ViewRow({ icon, label, value, divider }) {
  return (
    <Row style={[{ paddingVertical: 9, justifyContent: 'space-between' }, divider && { borderTopWidth: 1, borderTopColor: C.border }]}>
      <Row style={{ flex: 1 }}>
        <Icon name={icon} size={16} color={C.sub} />
        <Text style={[FONT.sub, { marginLeft: 8 }]}>{label}</Text>
      </Row>
      <Text style={[FONT.body, { fontWeight: '700', maxWidth: '55%' }]} numberOfLines={1}>{value}</Text>
    </Row>
  );
}

export function SettingsModal({ visible, onClose, initialTab }) {
  const toast = useToast();
  const company = useGame(s => s.company);
  const settings = useGame(s => s.settings);
  const stats = useGame(s => s.stats);
  const trucks = useGame(s => s.trucks);
  const staff = useGame(s => s.staff);
  const saveSettings = useGame(s => s.saveSettings);
  const saveCompany = useGame(s => s.saveCompany);
  const resetGame = useGame(s => s.resetGame);
  const gameDay = useGame(s => s.gameDay);
  const [tab, setTab] = useState(initialTab || 'profile');
  const [editing, setEditing] = useState(null); // 'profile' | 'company' | null — view-first pages
  useEffect(() => { if (visible) { setTab(initialTab || 'profile'); setEditing(null); } }, [visible, initialTab]);
  useEffect(() => { setEditing(null); }, [tab]);
  const [ceo, setCeo] = useState(company?.ceo || '');
  const [avatar, setAvatar] = useState(company?.avatar);
  const [cname, setCname] = useState(company?.name || '');
  const [logo, setLogo] = useState(company?.logo);
  const [confirmReset, setConfirmReset] = useState(false);
  // Easter-egg checklist renders only the first few cards by default —
  // the full list mounts behind "Show more" so the tab opens without lag.
  const [allEggs, setAllEggs] = useState(false);
  const tapMirrorEgg = useEasterEggTap('mirror_mirror', 5);
  const tapBrandedEgg = useEasterEggTap('branded', 4);
  const tapCuriousEgg = useEasterEggTap('curious_mind', 5);
  const tapSteadyEgg = useEasterEggTap('steady_hands', 4);
  const tapDangerEgg = useEasterEggTap('nice_try', 6);
  const tapSpeedEgg = useEasterEggTap('speed_demon', 5);

  useEffect(() => {
    if (visible && company) { setCeo(company.ceo); setAvatar(company.avatar); setCname(company.name); setLogo(company.logo); setConfirmReset(false); }
  }, [visible]);

  const TABS = [
    ['profile', 'Profile', 'account-circle'], ['company', 'Company', 'domain'],
    ['gameplay', 'Gameplay', 'controller-classic'], ['notif', 'Alerts', 'bell-ring-outline'],
    ['achievements', 'Achievements', 'trophy'],
    ['backup', 'Backup', 'backup-restore'],
    ['eggs', 'Easter Eggs', 'egg-easter'], ['roadmap', 'Roadmap', 'map-clock-outline'],
    ['about', 'About', 'information-outline'],
  ];
  const day = gameDay().day;
  const foundEggs = useGame(s => s.easterEggs?.found || []);

  return (
    <Sheet visible={visible} onClose={onClose} title="Settings" height="88%">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 12 }}>
        <Row style={{ gap: 6 }}>{TABS.map(([id, l, icon]) => <Chip key={id} label={l} icon={icon} active={tab === id} onPress={() => { if (id === 'about' && tab === 'about') tapCuriousEgg(); setTab(id); }} />)}</Row>
      </ScrollView>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
        {tab === 'profile' && (editing !== 'profile' ? (
          <>
            {/* VIEW: clean identity card, no form in sight */}
            <Card style={{ alignItems: 'center', paddingVertical: 20, marginBottom: 12, backgroundColor: '#0F172A', borderColor: '#1E293B' }}>
              <Pressable onPress={tapMirrorEgg}>
                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={company?.avatar || 'account-tie'} size={38} color="#5B8DF0" />
                </View>
              </Pressable>
              <Text style={[FONT.h2, { marginTop: 10, color: '#F8FAFC' }]}>{company?.ceo}</Text>
              <Text style={[FONT.tiny, { color: '#94A3B8' }]}>CEO · {company?.name}</Text>
              <Btn title="Edit Profile" kind="blue" small icon="pencil" style={{ marginTop: 12 }}
                onPress={() => { setCeo(company?.ceo || ''); setAvatar(company?.avatar); setEditing('profile'); }} />
            </Card>
            <SectionTitle icon="chart-box-outline" text="Lifetime Stats" />
            <Card>
              <ViewRow icon="package-variant-closed-check" label="Deliveries" value={String(stats.deliveries)} />
              <ViewRow divider icon="cash-multiple" label="Revenue" value={inrShort(stats.revenue)} />
              <ViewRow divider icon="map-marker-distance" label="Distance" value={`${Math.round(stats.km).toLocaleString()} km`} />
              <ViewRow divider icon="truck" label="Trucks owned" value={String(trucks.length)} />
              <ViewRow divider icon="account-group" label="Staff" value={String(staff.length)} />
              <ViewRow divider icon="calendar" label="Current day" value={String(day)} />
            </Card>
          </>
        ) : (
          <>
            {/* EDIT: the form appears only on demand */}
            <SectionTitle icon="pencil" text="Edit Profile" />
            <Card>
              <Text style={[FONT.tiny, { marginBottom: 4 }]}>CEO NAME</Text>
              <TextInput value={ceo} onChangeText={setCeo} maxLength={30} style={cs.input} />
              <Text style={[FONT.tiny, { marginTop: 14, marginBottom: 4 }]}>AVATAR</Text>
              <IconGrid options={AVATARS} value={avatar} onChange={o => { if (o === avatar) tapMirrorEgg(); setAvatar(o); }} />
            </Card>
            <Btn title="Save Profile" kind="green" icon="content-save-outline" style={{ marginTop: 14 }}
              onPress={() => { saveCompany({ ceo, avatar }); setEditing(null); toast('Profile saved', 'success'); }} />
            <Btn title="Cancel" kind="ghost" style={{ marginTop: 8 }} onPress={() => setEditing(null)} />
          </>
        ))}
        {tab === 'company' && (editing !== 'company' ? (
          <>
            <Card style={{ alignItems: 'center', paddingVertical: 20, marginBottom: 12, backgroundColor: '#0F172A', borderColor: '#1E293B' }}>
              <Pressable onPress={tapBrandedEgg}>
                <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={company?.logo || 'truck'} size={38} color="#5B8DF0" />
                </View>
              </Pressable>
              <Text style={[FONT.h2, { marginTop: 10, color: '#F8FAFC' }]}>{company?.name}</Text>
              <Text style={[FONT.tiny, { color: '#94A3B8' }]}>Est. day 1 · HQ {cityById(company?.hqCityId)?.name}</Text>
              <Btn title="Edit Company" kind="blue" small icon="pencil" style={{ marginTop: 12 }}
                onPress={() => { setCname(company?.name || ''); setLogo(company?.logo); setEditing('company'); }} />
            </Card>
            <SectionTitle icon="information-outline" text="Company Details" />
            <Card>
              <ViewRow icon="domain" label="Company name" value={company?.name || '—'} />
              <ViewRow divider icon="account-tie" label="CEO" value={company?.ceo || '—'} />
              <ViewRow divider icon="map-marker" label="Headquarters" value={cityById(company?.hqCityId)?.name || '—'} />
              <ViewRow divider icon="calendar-check" label="Founded" value={company?.createdAt ? new Date(company.createdAt).toDateString() : '—'} />
            </Card>
          </>
        ) : (
          <>
            <SectionTitle icon="pencil" text="Edit Company" />
            <Card>
              <Text style={[FONT.tiny, { marginBottom: 4 }]}>COMPANY NAME</Text>
              <TextInput value={cname} onChangeText={setCname} maxLength={40} style={cs.input} />
              <Text style={[FONT.tiny, { marginTop: 14, marginBottom: 4 }]}>LOGO</Text>
              <IconGrid options={LOGOS} value={logo} onChange={o => { if (o === logo) tapBrandedEgg(); setLogo(o); }} />
            </Card>
            <Btn title="Save Company" kind="green" icon="content-save-outline" style={{ marginTop: 14 }}
              onPress={() => { saveCompany({ name: cname, logo }); setEditing(null); toast('Company saved', 'success'); }} />
            <Btn title="Cancel" kind="ghost" style={{ marginTop: 8 }} onPress={() => setEditing(null)} />
          </>
        ))}
        {tab === 'gameplay' && (
          <>
            <SectionTitle icon="controller-classic" text="Simulation" />
            <Card>
              <Text style={[FONT.tiny, { marginBottom: 6 }]}>GAME SPEED</Text>
              <Row style={{ gap: 6, flexWrap: 'wrap' }}>
                {[[0.5, 'Slow'], [1, 'Normal'], [2, 'Fast'], [4, 'Very Fast']].map(([v, l]) => (
                  <Chip key={v} label={l} active={settings.speed === v} onPress={() => { if (v === 4) tapSpeedEgg(); saveSettings({ speed: v }); }} />
                ))}
              </Row>
              <Text style={[FONT.tiny, { marginTop: 14, marginBottom: 6 }]}>DIFFICULTY</Text>
              <Row style={{ gap: 6 }}>
                {['easy', 'normal', 'hard'].map(d => <Chip key={d} label={d[0].toUpperCase() + d.slice(1)} active={settings.difficulty === d} onPress={() => { if (d === 'normal' && settings.difficulty === 'normal') tapSteadyEgg(); saveSettings({ difficulty: d }); }} />)}
              </Row>
              <Text style={[FONT.tiny, { marginTop: 14, marginBottom: 6 }]}>RANDOM EVENTS (theft, accidents...)</Text>
              <Row style={{ gap: 6 }}>
                {[['off', 'Off'], ['rare', 'Rare'], ['sometimes', 'Sometimes']].map(([v, l]) =>
                  <Chip key={v} label={l} active={(settings.events || 'rare') === v} onPress={() => saveSettings({ events: v })} />)}
              </Row>
            </Card>
            <SectionTitle icon="tune-variant" text="Preferences" />
            <Card>
              <ToggleRow label="Auto-save" value={settings.autosave} onChange={v => saveSettings({ autosave: v })} />
              <ToggleRow label="Show fuel stations by default" value={settings.showStations} onChange={v => saveSettings({ showStations: v })} />
            </Card>
            <SectionTitle icon="volume-high" text="Audio" />
            <Card>
              <ToggleRow label="Sound effects & music" value={settings.sound} onChange={v => saveSettings({ sound: v })} />
              <Row style={{ justifyContent: 'space-between', marginTop: 12 }}>
                <Text style={FONT.tiny}>MUSIC VOLUME</Text>
                <Text style={[FONT.tiny, { fontWeight: '800', color: C.blue }]}>{Math.round((settings.musicVolume ?? 0.4) * 100)}%</Text>
              </Row>
              <GameSlider min={0} max={100} step={5} value={Math.round((settings.musicVolume ?? 0.4) * 100)}
                onChange={v => saveSettings({ musicVolume: v / 100 })} minLabel="0%" maxLabel="100%" />
              <Row style={{ justifyContent: 'space-between', marginTop: 10 }}>
                <Text style={FONT.tiny}>SOUND EFFECTS VOLUME</Text>
                <Text style={[FONT.tiny, { fontWeight: '800', color: C.blue }]}>{Math.round((settings.sfxVolume ?? 1) * 100)}%</Text>
              </Row>
              <GameSlider min={0} max={100} step={5} value={Math.round((settings.sfxVolume ?? 1) * 100)}
                onChange={v => saveSettings({ sfxVolume: v / 100 })} minLabel="0%" maxLabel="100%" />
              <Text style={[FONT.tiny, { marginTop: 14, marginBottom: 6 }]}>STARTUP SOUND — plays once each time you open the game</Text>
              <Row style={{ gap: 6, flexWrap: 'wrap' }}>
                {STARTUP_SOUNDS.map(o => (
                  <Chip key={o.key} label={o.label} active={(settings.startupSound || 'start') === o.key}
                    onPress={() => { saveSettings({ startupSound: o.key }); if (o.key !== 'off') play(o.key, settings.startupVolume ?? 0.7); }} />
                ))}
              </Row>
              {(settings.startupSound || 'start') !== 'off' ? (
                <>
                  <Row style={{ justifyContent: 'space-between', marginTop: 10 }}>
                    <Text style={FONT.tiny}>STARTUP VOLUME</Text>
                    <Text style={[FONT.tiny, { fontWeight: '800', color: C.blue }]}>{Math.round((settings.startupVolume ?? 0.7) * 100)}%</Text>
                  </Row>
                  <GameSlider min={0} max={100} step={5} value={Math.round((settings.startupVolume ?? 0.7) * 100)}
                    onChange={v => saveSettings({ startupVolume: v / 100 })} minLabel="0%" maxLabel="100%" />
                </>
              ) : null}
            </Card>
            <SectionTitle icon="vibrate" text="Vibration" />
            <Card>
              <ToggleRow label="Vibration / haptics" value={settings.haptics !== false} onChange={v => saveSettings({ haptics: v })} />
              <Text style={[FONT.tiny, { marginTop: 12, marginBottom: 6 }]}>INTENSITY</Text>
              <Row style={{ gap: 6 }}>
                {[['short', 'Short'], ['medium', 'Medium'], ['long', 'Long']].map(([v, l]) => (
                  <Chip key={v} label={l} active={(settings.hapticIntensity || 'medium') === v} onPress={() => saveSettings({ hapticIntensity: v })} />
                ))}
              </Row>
            </Card>
            <SectionTitle icon="alert-octagon-outline" text="Danger Zone" />
            <Card style={{ borderColor: C.red }}>
              <Pressable onPress={tapDangerEgg}>
                <Text style={[FONT.sub, { marginBottom: 8 }]}>This permanently deletes your empire and all progress.</Text>
              </Pressable>
              <Btn title={confirmReset ? 'Tap again to confirm reset' : 'Reset Game Data'} kind="danger" icon="delete-forever-outline"
                onPress={() => { if (confirmReset) { resetGame(); onClose(); } else setConfirmReset(true); }} />
            </Card>
          </>
        )}
        {tab === 'notif' && (
          <>
            <SectionTitle icon="bell-ring-outline" text="Notifications" />
            <Card>
              {[['delivery', 'Delivery updates'], ['truck', 'Truck ready'], ['fuel', 'Low fuel warning'], ['daily', 'Daily summary']].map(([k, l]) => (
                <ToggleRow key={k} label={l} value={settings.notif[k]} onChange={v => saveSettings({ notif: { ...settings.notif, [k]: v } })} />
              ))}
            </Card>
          </>
        )}
        {tab === 'achievements' && <AchievementsTab />}
        {tab === 'roadmap' && <RoadmapTab />}
        {tab === 'backup' && <BackupTab onClose={onClose} />}
        {tab === 'eggs' && (
          <>
            <SectionTitle icon="egg-easter" text={`Hidden Gems — ${foundEggs.length}/${EASTER_EGGS.length} found`} />
            <Card style={{ marginBottom: 12, backgroundColor: C.bgSoft }}>
              <Text style={FONT.sub}>Scattered around the app are {EASTER_EGGS.length} hidden gems. Each one is found by repeatedly tapping something specific, fast. Find one and it pays out big — once. The rest stay a secret until you stumble onto them.</Text>
            </Card>
            {(allEggs ? EASTER_EGGS : EASTER_EGGS.slice(0, EGGS_INITIAL)).map(egg => {
              const found = foundEggs.includes(egg.id);
              return (
                <Card key={egg.id} style={{ marginBottom: 8, opacity: found ? 1 : 0.75 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Row style={{ flex: 1 }}>
                      <Icon name={found ? 'diamond-stone' : 'help-rhombus-outline'} size={20} color={found ? C.gold : C.faint} />
                      <View style={{ marginLeft: 10, flex: 1 }}>
                        <Text style={[FONT.body, { fontWeight: '700' }]}>{found ? egg.title : '???'}</Text>
                        <Text style={FONT.tiny}>{found ? egg.where : egg.hint}</Text>
                      </View>
                    </Row>
                    <Pill text={found ? 'Found' : 'Locked'} icon={found ? 'check-circle' : 'lock-outline'} color={found ? C.green : C.faint} bg={found ? C.greenSoft : C.bgSoft} />
                  </Row>
                </Card>
              );
            })}
            {EASTER_EGGS.length > EGGS_INITIAL && (
              <Pressable onPress={() => setAllEggs(v => !v)}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12 }}>
                <Icon name={allEggs ? 'chevron-up' : 'chevron-down'} size={16} color={C.blue} />
                <Text style={{ color: C.blue, fontWeight: '700', marginLeft: 4 }}>
                  {allEggs ? 'Show less' : `Show more gems (${EASTER_EGGS.length - EGGS_INITIAL} hidden)`}
                </Text>
              </Pressable>
            )}
          </>
        )}
        {tab === 'about' && (
          <AboutTab onReplayTutorial={() => { saveSettings({ tutorialSeen: false }); toast('Tutorial will show on the map', 'info'); onClose(); }} />
        )}
      </ScrollView>
    </Sheet>
  );
}

// Credits — the open data / open source that makes the game possible.
const CREDITS = [
  { icon: 'map', name: 'OpenStreetMap', role: 'Map & road data', by: '© OpenStreetMap contributors (ODbL)' },
  { icon: 'layers', name: 'Leaflet', role: 'Interactive map engine', by: 'Vladimir Agafonkin & contributors' },
  { icon: 'earth', name: 'CARTO Basemaps', role: 'Map tile styling', by: '© CARTO — basemaps.cartocdn.com' },
  { icon: 'routes', name: 'OSRM Routing Engine', role: 'Real road paths (beta)', by: 'Project OSRM — router.project-osrm.org' },
  { icon: 'react', name: 'React Native', role: 'App framework', by: 'Meta Open Source' },
  { icon: 'vector-square', name: 'Material Community Icons', role: 'Iconography', by: 'Pictogrammers (Apache 2.0)' },
  { icon: 'road-variant', name: 'National Highways data', role: 'Route network', by: 'Compiled from public NHAI references' },
  { icon: 'creation', name: 'Claude (Anthropic)', role: 'AI development partner', by: 'Every line, every fix, every 2am idea — built together' },
];

// The team — every card is rendered identically (same badge size, same fixed
// title/subtitle height) so the row always lines up, no matter how long a
// title is.
const DEVELOPERS = [
  { name: 'Parth Vasoya', title: 'Lead Developer & Designer', icon: 'account-star', color: C.blue, bg: C.blueSoft },
  { name: 'Jeel Gajera', title: 'Developer', icon: 'account-tie', color: C.green, bg: C.greenSoft },
  { name: 'Claude', title: '24/7 AI Coding Partner', icon: 'creation', color: '#C0161C', bg: '#C0161C1A', eggId: 'hello_claude', tapCount: 9 },
];

// A shimmering placeholder row (icon block + two text lines) used while remote
// data loads — mirrors the real row layout so the UI doesn't jump.
function SkeletonRow({ lines = 2 }) {
  return (
    <Row style={{ paddingVertical: 8, alignItems: 'center' }}>
      <Skeleton w={38} h={38} r={12} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Skeleton w="55%" h={12} />
        {lines > 1 ? <Skeleton w="80%" h={9} style={{ marginTop: 6 }} /> : null}
      </View>
    </Row>
  );
}
function SkeletonList({ rows = 4, lines = 2 }) {
  return (
    <Card>
      {Array.from({ length: rows }).map((_, i) => <SkeletonRow key={i} lines={lines} />)}
    </Card>
  );
}

// ============ About (version, updates, credits, team) ============
function AboutTab({ onReplayTutorial }) {
  const toast = useToast();
  const [state, setState] = useState({ status: 'idle', data: null, err: null }); // idle|checking|done|error
  const [allHistory, setAllHistory] = useState(false);
  const tapVersionEgg = useEasterEggTap('version_detective', 6);
  const tapMakerEgg = useEasterEggTap('meet_the_maker', 7);
  const tapClaudeEgg = useEasterEggTap('hello_claude', 9);

  const check = async () => {
    setState({ status: 'checking', data: null, err: null });
    try {
      const data = await checkForUpdate();
      setState({ status: 'done', data, err: null });
      if (!data.hasUpdate) toast('You’re on the latest version', 'success');
    } catch (e) {
      setState({ status: 'error', data: null, err: e.message || 'Could not reach GitHub' });
    }
  };
  // Auto-check once when the About tab first mounts.
  useEffect(() => { check(); }, []);

  const latest = state.data?.latest;
  const hasUpdate = state.data?.hasUpdate;

  return (
    <>
      {/* App identity — the real brand emblem, same as splash + launcher icon */}
      <Card style={{ alignItems: 'center', padding: 22 }}>
        <BrandEmblem size={84} />
        <Text style={[FONT.h2, { marginTop: 10 }]}>Truck Empire Tycoon</Text>
        <Row style={{ marginTop: 6 }}>
          <Pressable onPress={tapVersionEgg}><Pill text={`Installed ${APP_VERSION}`} icon="cellphone-check" color={C.sub} bg={C.bgSoft} /></Pressable>
          {state.status === 'done' && (
            <View style={{ marginLeft: 6 }}>
              {hasUpdate
                ? <Pill text={`Update ${latest.version}`} icon="arrow-up-bold-circle" color={C.green} bg={C.greenSoft} />
                : <Pill text="Up to date" icon="check-circle" color={C.blue} bg={C.blueSoft} />}
            </View>
          )}
        </Row>
        <Text style={[FONT.sub, { textAlign: 'center', marginTop: 10 }]}>
          Build and run your own Indian trucking empire. Real highways, real cities, real-time hauls — 100% offline. Made in India.
        </Text>
      </Card>

      {/* Updates */}
      <Text style={cs.section}>Software Update</Text>
      <Card>
        <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={[FONT.body, { fontWeight: '700' }]}>
              {state.status === 'checking' ? 'Checking for updates…'
                : state.status === 'error' ? 'Couldn’t check for updates'
                  : hasUpdate ? `New version available` : 'Latest version installed'}
            </Text>
            <Text style={FONT.tiny}>
              Installed {APP_VERSION}{latest ? `  ·  Available ${latest.version}` : ''}
              {latest?.apkSize ? `  ·  ${fmtMB(latest.apkSize)}` : ''}
            </Text>
            {state.status === 'error' ? <Text style={[FONT.tiny, { color: C.red }]}>{state.err}</Text> : null}
          </View>
          <Btn title="Check" small kind="soft" icon="refresh" disabled={state.status === 'checking'} onPress={check} />
        </Row>

        {/* Updates download in the browser: one tap opens the release APK,
            Android's own download manager fetches it and hands it straight
            to the package installer — the most reliable path on every device. */}
        {hasUpdate && (
          <>
            <Btn title={`Download ${latest.version} via browser`} kind="green" icon="open-in-new" style={{ marginTop: 12 }}
              onPress={() => { if (latest?.apkUrl) Linking.openURL(latest.apkUrl).catch(() => toast('Could not open the browser', 'error')); }} />
            <Text style={[FONT.tiny, { marginTop: 6 }]}>
              The APK opens in your browser and downloads there. Tap it when finished and confirm the install.
            </Text>
          </>
        )}
        {latest?.notes ? (
          <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10 }}>
            <Text style={[FONT.tiny, { fontWeight: '700', marginBottom: 4 }]}>WHAT’S NEW IN {latest.version}</Text>
            <Text style={FONT.sub}>{latest.notes.slice(0, 400)}</Text>
          </View>
        ) : null}
      </Card>

      {/* Version history */}
      {state.status === 'checking' ? (
        <>
          <Text style={cs.section}>Version History</Text>
          <SkeletonList rows={5} lines={2} />
        </>
      ) : state.data?.releases?.length ? (
        <>
          <Text style={cs.section}>Version History</Text>
          <Card>
            {state.data.releases.slice(0, allHistory ? 15 : 3).map((r, i) => {
              const isCurrent = cmpVer(r.version, APP_VERSION) === 0;
              return (
                <Row key={r.version} style={[{ justifyContent: 'space-between', paddingVertical: 9 }, i > 0 && { borderTopWidth: 1, borderTopColor: C.border }]}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Row>
                      <Text style={[FONT.body, { fontWeight: '700' }]}>{r.version}</Text>
                      {isCurrent ? <View style={{ marginLeft: 6 }}><Pill text="Installed" color={C.blue} bg={C.blueSoft} /></View> : null}
                      {i === 0 && !isCurrent ? <View style={{ marginLeft: 6 }}><Pill text="Latest" color={C.green} bg={C.greenSoft} /></View> : null}
                    </Row>
                    <Text style={FONT.tiny} numberOfLines={2}>{r.notes ? r.notes.slice(0, 120) : 'Automated release build.'}</Text>
                  </View>
                  <Text style={FONT.tiny}>{r.date ? relTime(new Date(r.date).getTime()) : ''}{r.apkSize ? `\n${fmtMB(r.apkSize)}` : ''}</Text>
                </Row>
              );
            })}
            {state.data.releases.length > 3 && (
              <Pressable onPress={() => setAllHistory(v => !v)}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border }}>
                <Icon name={allHistory ? 'chevron-up' : 'chevron-down'} size={16} color={C.blue} />
                <Text style={{ color: C.blue, fontWeight: '700', marginLeft: 4 }}>
                  {allHistory ? 'Show less' : `Show older versions (${Math.min(15, state.data.releases.length) - 3} more)`}
                </Text>
              </Pressable>
            )}
          </Card>
        </>
      ) : null}

      {/* Developers — simple vertical list, one row per person. Full name and
          title get all the horizontal space they need instead of being
          squeezed into a cramped 3-up card grid. */}
      <Text style={cs.section}>Developed By</Text>
      <Card style={{ padding: 0 }}>
        {DEVELOPERS.map((dev, i) => {
          const tapEgg = i === 0 ? tapMakerEgg : dev.eggId === 'hello_claude' ? tapClaudeEgg : null;
          return (
            <Pressable key={dev.name} onPress={() => { if (tapEgg) tapEgg(); }}
              style={[{ flexDirection: 'row', alignItems: 'center', padding: 14 }, i > 0 && { borderTopWidth: 1, borderTopColor: C.border }]}>
              <View style={[cs.heroIcon, { width: 44, height: 44, backgroundColor: dev.bg }]}><Icon name={dev.icon} size={22} color={dev.color} /></View>
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={[FONT.body, { fontWeight: '800' }]} numberOfLines={1}>{dev.name}</Text>
                <Text style={FONT.tiny} numberOfLines={1}>{dev.title}</Text>
              </View>
            </Pressable>
          );
        })}
      </Card>

      {/* Credits */}
      <Text style={cs.section}>Credits & Open Source</Text>
      <Card>
        <Text style={[FONT.tiny, { marginBottom: 6 }]}>This game is built on wonderful open data and open-source software:</Text>
        {CREDITS.map((c, i) => (
          <Row key={c.name} style={[{ paddingVertical: 8 }, i > 0 && { borderTopWidth: 1, borderTopColor: C.border }]}>
            <View style={[cs.heroIcon, { width: 38, height: 38, backgroundColor: C.bgSoft }]}><Icon name={c.icon} size={20} color={C.sub} /></View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[FONT.body, { fontWeight: '700' }]}>{c.name}</Text>
              <Text style={FONT.tiny}>{c.role} · {c.by}</Text>
            </View>
          </Row>
        ))}
      </Card>

      {/* Tribute / trademark disclaimer — the fleet's brand names are our own
          fictional creations, inspired by (and paying tribute to) the real
          trucking manufacturers whose work shaped this game's world. */}
      <Text style={cs.section}>A Note on Vehicle Names</Text>
      <Card style={{ backgroundColor: C.bgSoft }}>
        <Row>
          <Icon name="hand-heart-outline" size={16} color={C.sub} style={{ marginTop: 1 }} />
          <Text style={[FONT.tiny, { marginLeft: 8, flex: 1, lineHeight: 17 }]}>
            The truck brands and model names in this game (Tatrax, Ashok Logistics, Voltra, Scanix and others) are original,
            fictional creations — a respectful tribute to the real manufacturers who inspire the world of trucking we love.
            Any resemblance is intentional homage, not affiliation; all real trademarks remain the property of their
            rightful owners.
          </Text>
        </Row>
      </Card>

      <Btn title="Replay Tutorial" kind="soft" icon="school-outline" style={{ marginTop: 14 }} onPress={onReplayTutorial} />
      <Text style={[FONT.tiny, { textAlign: 'center', marginTop: 12 }]}>Made with ♥ in India · {APP_VERSION}</Text>
    </>
  );
}

function ToggleRow({ label, value, onChange }) {
  return (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 8 }}>
      <Text style={FONT.body}>{label}</Text>
      <Switch value={!!value} onValueChange={onChange} trackColor={{ true: C.blue }} />
    </Row>
  );
}

function IconGrid({ options, value, onChange }) {
  return (
    <Row style={{ flexWrap: 'wrap', gap: 8 }}>
      {options.map(o => (
        <Pressable key={o} onPress={() => onChange(o)}
          style={[cs.iconTile, value === o && { borderColor: C.blue, backgroundColor: C.blueSoft }]}>
          <Icon name={o} size={22} color={value === o ? C.blue : C.text} />
        </Pressable>
      ))}
    </Row>
  );
}

// ============ Hubs & Garages ============
const TIER_LABEL = { 1: 'Metro', 2: 'Major City', 3: 'Regional' };
export function HubsModal({ visible, onClose, onShowOnMap }) {
  const toast = useToast();
  const hubs = useGame(s => s.hubs || []);
  const balance = useGame(s => s.balance);
  const buyHub = useGame(s => s.buyHub);
  const fastTravel = useGame(s => s.fastTravel);
  const refuelAtHub = useGame(s => s.refuelAtHub);
  const trucks = useGame(s => s.trucks);
  const [query, setQuery] = useState('');
  const [travelFor, setTravelFor] = useState(null); // hub cityId whose picker is open
  const owned = new Set(hubs.map(h => h.cityId));
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = CITIES.filter(c => !owned.has(c.id));
    if (!q) return base.filter(c => c.tier <= 2).slice(0, 15);
    return base.filter(c => {
      if (c.name.toLowerCase().includes(q) || c.state.toLowerCase().includes(q)) return true;
      const country = COUNTRY_BY_CODE[c.country || 'IN'];
      return !!country && (country.name.toLowerCase().includes(q) || (c.country || 'IN').toLowerCase() === q);
    }).slice(0, 15);
  }, [query, hubs.length]);
  const sellHub = useGame(s => s.sellHub);
  const buy = (c) => { const r = buyHub(c.id); toast(r.ok ? `Garage opened in ${c.name}!` : r.err, r.ok ? 'success' : 'error'); };
  const sell = (h) => { const r = sellHub(h.cityId); toast(r.ok ? `Garage sold for ${inrShort(r.refund)}` : r.err, r.ok ? 'success' : 'error'); };

  return (
    <Sheet visible={visible} onClose={onClose} title="Garages & Network" height="88%">
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Card style={{ marginBottom: 12, backgroundColor: C.bgSoft }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row style={{ flex: 1 }}>
              <Icon name="garage" size={18} color={C.blue} />
              <Text style={[FONT.h3, { marginLeft: 6 }]}>Your Network</Text>
            </Row>
            <Text style={FONT.sub}>{hubs.length} location{hubs.length === 1 ? '' : 's'}</Text>
          </Row>
          <Row style={{ marginTop: 6 }}>
            <Icon name="information-outline" size={13} color={C.sub} />
            <Text style={[FONT.tiny, { marginLeft: 5, flex: 1 }]}>Garages give free refuelling and let trucks fast-travel between them. Each has a monthly upkeep cost.</Text>
          </Row>
        </Card>

        {hubs.map(h => {
          const c = cityById(h.cityId);
          const here = trucks.filter(t => t.cityId === h.cityId);
          const parked = here.filter(t => t.status === 'parked');
          const needFuel = parked.filter(t => (t.fuelPct || 0) < 100);
          const elsewhere = trucks.filter(t => t.status === 'parked' && t.cityId !== h.cityId && owned.has(t.cityId));
          const upkeep = h.hq ? 0 : (h.maint || hubMaintForCity(c));
          return (
            <Card key={h.cityId} style={{ marginBottom: 8 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Row style={{ flex: 1 }}>
                  <View style={[cs.heroIcon, { width: 40, height: 40, backgroundColor: h.hq ? C.blueSoft : C.bgSoft }]}>
                    <Icon name={h.hq ? 'office-building-marker' : 'garage-variant'} size={22} color={h.hq ? C.blue : C.text} />
                  </View>
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={[FONT.body, { fontWeight: '800' }]}>{h.name}</Text>
                    <Text style={FONT.tiny}>{c ? `${c.name}, ${c.state}` : ''}</Text>
                  </View>
                </Row>
                <Pill text={h.hq ? 'HQ' : TIER_LABEL[c?.tier] || 'Garage'} color={h.hq ? C.blue : C.sub} bg={h.hq ? C.blueSoft : C.bgSoft} />
              </Row>
              <Row style={{ marginTop: 10, gap: 14, flexWrap: 'wrap' }}>
                <Row><Icon name="truck" size={14} color={C.sub} /><Text style={[FONT.sub, { marginLeft: 4 }]}>{here.length} here</Text></Row>
                <Row><Icon name="parking" size={14} color={C.blue} /><Text style={[FONT.sub, { marginLeft: 4 }]}>{parked.length} parked</Text></Row>
                {!h.hq && <Row><Icon name="wrench-clock" size={14} color={C.amber} /><Text style={[FONT.sub, { marginLeft: 4 }]}>{inrShort(upkeep)}/mo upkeep</Text></Row>}
              </Row>
              <Row style={{ marginTop: 10, gap: 8, flexWrap: 'wrap' }}>
                {c && <Btn title="Map" kind="soft" small icon="crosshairs-gps" onPress={() => { onClose(); onShowOnMap && onShowOnMap({ lat: c.lat, lng: c.lng, scale: 5, key: Date.now() }); }} />}
                {needFuel.length > 0 && (
                  <Btn title={`Refuel ${needFuel.length} free`} kind="green" small icon="gas-station"
                    onPress={() => { needFuel.forEach(t => refuelAtHub(t.id)); toast(`Refuelled ${needFuel.length} truck(s) free`, 'success'); }} />
                )}
                {elsewhere.length > 0 && (
                  <Btn title="Send truck here" kind="blue" small icon="transfer"
                    onPress={() => setTravelFor(travelFor === h.cityId ? null : h.cityId)} />
                )}
                {!h.hq && (
                  <Btn title={`Sell · ${inrShort(Math.round((h.cost || 0) * 0.5))}`} kind="danger" small icon="cash-minus" onPress={() => sell(h)} />
                )}
              </Row>
              {travelFor === h.cityId && (
                <View style={cs.pickerBox}>
                  <Text style={[FONT.tiny, { marginBottom: 6 }]}>PICK A PARKED TRUCK TO FAST-TRAVEL HERE</Text>
                  {elsewhere.map(t => {
                    const m = modelById(t.modelId), from = cityById(t.cityId);
                    return (
                      <Pressable key={t.id} style={cs.resRow} onPress={() => {
                        const r = fastTravel(t.id, h.cityId);
                        toast(r.ok ? `Moved to ${c.name} for ${inr(r.fee)}` : r.err, r.ok ? 'success' : 'error');
                        if (r.ok) setTravelFor(null);
                      }}>
                        <Icon name={m.icon} size={16} color={C.sub} />
                        <Text style={[FONT.body, { flex: 1, marginLeft: 8 }]} numberOfLines={1}>{t.customName || m.name}</Text>
                        <Text style={FONT.tiny}>{from?.name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </Card>
          );
        })}

        <Text style={cs.section}>Open a New Garage — price varies by city</Text>
        <TextInput value={query} onChangeText={setQuery} placeholder="Search any city to expand into..."
          placeholderTextColor={C.faint} style={cs.input} />
        <View style={{ marginTop: 8, paddingBottom: 24 }}>
          {results.map(c => {
            const cost = hubCostForCity(c);
            const upkeep = hubMaintForCity(c);
            const afford = balance >= cost;
            return (
              <Card key={c.id} style={{ marginBottom: 8, padding: 12 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Row><Text style={[FONT.body, { fontWeight: '700' }]}>{c.name}</Text>
                      <View style={{ marginLeft: 6 }}><Pill text={TIER_LABEL[c.tier] || 'Regional'} color={C.sub} bg={C.bgSoft} /></View>
                    </Row>
                    <Text style={FONT.tiny}>{c.state}</Text>
                    <Row style={{ marginTop: 4, gap: 12 }}>
                      <Text style={[FONT.sub, { fontWeight: '800', color: C.text }]}>{inr(cost)}</Text>
                      <Row><Icon name="wrench-clock" size={12} color={C.amber} /><Text style={[FONT.tiny, { marginLeft: 3 }]}>{inrShort(upkeep)}/mo</Text></Row>
                    </Row>
                  </View>
                  <Btn title={afford ? 'Buy' : 'Low funds'} kind={afford ? 'primary' : 'soft'} small disabled={!afford} icon="garage-variant" onPress={() => buy(c)} />
                </Row>
              </Card>
            );
          })}
        </View>
      </ScrollView>
    </Sheet>
  );
}

// ============ HQ / Garage info (tap the building on the map) ============
// One modal for both: HQ shows the whole company picture (network, monthly
// bills incl. electricity, fleet ops); a garage shows its own books and lets
// you operate the trucks parked there — refuel, dispatch, fast-travel in.
export function HubInfoModal({ visible, onClose, cityId, onNewDelivery, onOpenTruck }) {
  const toast = useToast();
  const tapHqHomeEgg = useEasterEggTap('hq_home', 5);
  const hubs = useGame(s => s.hubs || []);
  const trucks = useGame(s => s.trucks);
  const deliveries = useGame(s => s.deliveries);
  const staff = useGame(s => s.staff);
  const history = useGame(s => s.history);
  const company = useGame(s => s.company);
  const refuelAtHub = useGame(s => s.refuelAtHub);
  const fastTravel = useGame(s => s.fastTravel);
  const [travelOpen, setTravelOpen] = useState(false);
  useEffect(() => { if (!visible) setTravelOpen(false); }, [visible]);

  const hub = hubs.find(h => h.cityId === cityId);
  const city = cityId ? cityById(cityId) : null;
  if (!hub || !city) return <Sheet visible={visible} onClose={onClose} title="Garage" height="40%"><View /></Sheet>;

  const isHQ = !!hub.hq;
  const here = trucks.filter(t => t.cityId === cityId);
  const parked = here.filter(t => t.status === 'parked');
  const delivering = trucks.filter(t => t.status === 'delivering' && deliveries.some(d => d.truckId === t.id && (d.fromCityId === cityId || d.toCityId === cityId)));
  const needFuel = parked.filter(t => (t.fuelPct || 0) < 100);
  const elsewhere = trucks.filter(t => t.status === 'parked' && t.cityId !== cityId && hubs.some(h => h.cityId === t.cityId));
  const trips = history.filter(h => h.fromCityId === cityId || h.toCityId === cityId);
  const tripNet = trips.reduce((a, h) => a + h.net, 0);
  // Monthly bills — upkeep covers rent/maintenance; the light bill is a slice
  // of it (deterministic per tier) so the invoice reads like a real one.
  const upkeep = isHQ ? 0 : (hub.maint || hubMaintForCity(city));
  const lightBill = isHQ ? 25000 : Math.round(upkeep * 0.18);
  const rentMaint = isHQ ? 0 : upkeep - lightBill;
  const salaries = staff.reduce((a, x) => a + x.salary, 0);
  const netUpkeep = hubs.filter(h => !h.hq).reduce((a, h) => a + (h.maint || hubMaintForCity(cityById(h.cityId))), 0);

  return (
    <Sheet visible={visible} onClose={onClose} title={hub.name} height="88%">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
        {/* Hero */}
        <Card style={{ marginBottom: 12, backgroundColor: isHQ ? '#0F172A' : C.bgSoft, borderColor: isHQ ? '#1E293B' : C.border }}>
          <Row>
            <Pressable onPress={() => { if (isHQ) tapHqHomeEgg(); }}>
              <View style={[cs.heroIcon, { width: 52, height: 52, backgroundColor: isHQ ? '#1E293B' : C.blueSoft }]}>
                <Icon name={isHQ ? 'office-building-marker' : 'garage-variant'} size={28} color={isHQ ? '#5B8DF0' : C.blue} />
              </View>
            </Pressable>
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={[FONT.h2, isHQ && { color: '#F8FAFC' }]}>{isHQ ? company?.name : hub.name}</Text>
              <Text style={[FONT.tiny, isHQ && { color: '#94A3B8' }]}>
                {isHQ ? `Headquarters · ${city.name}, ${city.state}` : `${city.name}, ${city.state} · Tier ${city.tier}`} · since {relTime(hub.since)}
              </Text>
            </View>
            <Pill text={isHQ ? 'HQ' : 'Garage'} color={isHQ ? '#5B8DF0' : C.blue} bg={isHQ ? '#1E293B' : C.blueSoft} />
          </Row>
        </Card>

        {/* Location stats */}
        <Row style={{ marginBottom: 8, backgroundColor: C.bgSoft, borderRadius: RADIUS.md, paddingVertical: 10 }}>
          <ContractStat icon="truck" label="Trucks here" value={String(here.length)} />
          <ContractStat icon="parking" label="Parked" value={String(parked.length)} color={C.blue} />
          <ContractStat icon="truck-fast" label="To / from" value={String(delivering.length)} color={C.green} />
          <ContractStat icon="history" label="Past trips" value={String(trips.length)} />
        </Row>
        {trips.length > 0 && (
          <Card style={{ marginBottom: 12 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row><Icon name="cash-check" size={16} color={C.green} /><Text style={[FONT.body, { fontWeight: '700', marginLeft: 6 }]}>Earnings through this {isHQ ? 'HQ' : 'garage'}</Text></Row>
              <Text style={[FONT.mono, { fontWeight: '800', color: tripNet >= 0 ? C.green : C.red }]}>{inrShort(tripNet)}</Text>
            </Row>
          </Card>
        )}

        {/* Monthly bills */}
        <SectionTitle icon="file-document-outline" text="Monthly Bills" />
        <Card style={{ marginBottom: 12 }}>
          <Row style={{ justifyContent: 'space-between', paddingVertical: 7 }}>
            <Row><Icon name="lightbulb-on-outline" size={16} color={C.amber} /><Text style={[FONT.body, { marginLeft: 8 }]}>Electricity (light bill)</Text></Row>
            <Text style={[FONT.mono, { fontWeight: '700' }]}>{inr(lightBill)}</Text>
          </Row>
          {!isHQ && (
            <Row style={{ justifyContent: 'space-between', paddingVertical: 7, borderTopWidth: 1, borderTopColor: C.border }}>
              <Row><Icon name="home-city-outline" size={16} color={C.sub} /><Text style={[FONT.body, { marginLeft: 8 }]}>Rent & maintenance</Text></Row>
              <Text style={[FONT.mono, { fontWeight: '700' }]}>{inr(rentMaint)}</Text>
            </Row>
          )}
          {isHQ && (
            <>
              <Row style={{ justifyContent: 'space-between', paddingVertical: 7, borderTopWidth: 1, borderTopColor: C.border }}>
                <Row><Icon name="account-cash" size={16} color={C.sub} /><Text style={[FONT.body, { marginLeft: 8 }]}>Staff salaries (company-wide)</Text></Row>
                <Text style={[FONT.mono, { fontWeight: '700' }]}>{inr(salaries)}</Text>
              </Row>
              <Row style={{ justifyContent: 'space-between', paddingVertical: 7, borderTopWidth: 1, borderTopColor: C.border }}>
                <Row><Icon name="garage" size={16} color={C.sub} /><Text style={[FONT.body, { marginLeft: 8 }]}>Garage network upkeep</Text></Row>
                <Text style={[FONT.mono, { fontWeight: '700' }]}>{inr(netUpkeep)}</Text>
              </Row>
            </>
          )}
          <Row style={{ justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.border, marginTop: 2 }}>
            <Text style={[FONT.body, { fontWeight: '800' }]}>Total / month</Text>
            <Text style={[FONT.mono, { fontWeight: '800', color: C.amber }]}>
              {inr(isHQ ? lightBill + salaries + netUpkeep : upkeep)}
            </Text>
          </Row>
          <Text style={[FONT.tiny, { marginTop: 6 }]}>Billed automatically with monthly costs every 30 game days.</Text>
        </Card>

        {/* Operate trucks from here */}
        <SectionTitle icon="steering" text="Operate From Here" right={
          needFuel.length > 0 ? <Btn title={`Refuel ${needFuel.length} free`} kind="green" small icon="gas-station"
            onPress={() => { needFuel.forEach(t => refuelAtHub(t.id)); toast(`Refuelled ${needFuel.length} truck(s) free`, 'success'); }} /> : null
        } />
        {parked.length === 0 ? (
          <Card style={{ marginBottom: 10 }}>
            <Text style={FONT.sub}>No trucks parked here right now.</Text>
            {elsewhere.length > 0 && (
              <Btn title="Fast-travel a truck here" kind="blue" small icon="transfer" style={{ marginTop: 10 }}
                onPress={() => setTravelOpen(v => !v)} />
            )}
          </Card>
        ) : parked.map(t => {
          const m = modelById(t.modelId);
          return (
            <Card key={t.id} style={{ marginBottom: 8, padding: 12 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Pressable style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }} onPress={() => onOpenTruck && onOpenTruck(t.id)}>
                  <Icon name={m.icon} size={20} color={C.blue} />
                  <View style={{ marginLeft: 8, flex: 1 }}>
                    <Text style={FONT.body} numberOfLines={1}>{t.customName || m.name}</Text>
                    <Text style={FONT.tiny}>Fuel {Math.round(t.fuelPct)}% · condition {Math.round(t.condition == null ? 100 : t.condition)}%</Text>
                  </View>
                </Pressable>
                <Btn title="Dispatch" kind="primary" small icon="truck-fast"
                  onPress={() => { onClose(); onNewDelivery && onNewDelivery(t.id); }} />
              </Row>
            </Card>
          );
        })}
        {parked.length > 0 && elsewhere.length > 0 && (
          <Btn title="Fast-travel another truck here" kind="soft" small icon="transfer" style={{ marginBottom: 8 }}
            onPress={() => setTravelOpen(v => !v)} />
        )}
        {travelOpen && (
          <View style={[cs.pickerBox, { marginBottom: 10 }]}>
            <Text style={[FONT.tiny, { marginBottom: 6 }]}>PICK A PARKED TRUCK TO BRING HERE</Text>
            {elsewhere.map(t => {
              const m = modelById(t.modelId), from = cityById(t.cityId);
              return (
                <Pressable key={t.id} style={cs.resRow} onPress={() => {
                  const r = fastTravel(t.id, cityId);
                  toast(r.ok ? `Moved to ${city.name} for ${inr(r.fee)}` : r.err, r.ok ? 'success' : 'error');
                  if (r.ok) setTravelOpen(false);
                }}>
                  <Icon name={m.icon} size={16} color={C.sub} />
                  <Text style={[FONT.body, { flex: 1, marginLeft: 8 }]} numberOfLines={1}>{t.customName || m.name}</Text>
                  <Text style={FONT.tiny}>{from?.name}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </Sheet>
  );
}

// ============ Company Insights (tap the profile capsule) ============
// The company's own page: identity, level, health scorecard and smart tips —
// a real dashboard, not a shortcut into Settings.
// Photo Mode — a real, professional shareable "Empire Report Card" PNG.
// Captured with react-native-view-shot (ViewShot wraps just the card, not
// the buttons/toggle), in either a dark or light theme. Falls back to a
// text share if capture fails for any reason (e.g. storage permission).
const PM_THEMES = {
  dark: {
    bg: '#0F172A', panel: '#1B2740', border: '#26344F',
    text: '#F8FAFC', sub: '#94A3B8', faint: '#64748B',
    accent: '#5B8DF0', good: '#4ADE80', gold: '#F4D35E',
  },
  light: {
    bg: '#FFFFFF', panel: '#F1F5F9', border: '#E2E8F0',
    text: '#0B1220', sub: '#475569', faint: '#64748B',
    accent: '#2563EB', good: '#16A34A', gold: '#B7791F',
  },
};
function PMStatTile({ icon, label, value, color, theme }) {
  return (
    <View style={{ width: '33.3%', alignItems: 'center', paddingVertical: 12 }}>
      <Icon name={icon} size={20} color={theme.accent} />
      <Text style={[FONT.h3, { color: color || theme.text, marginTop: 4, fontWeight: '800' }]} numberOfLines={1}>{value}</Text>
      <Text style={[FONT.tiny, { color: theme.faint, textAlign: 'center', marginTop: 1 }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}
export function PhotoModeModal({ visible, onClose }) {
  const toast = useToast();
  const state = useGame(s => s);
  const [mode, setMode] = useState('dark'); // 'dark' | 'light' card theme
  const [capturing, setCapturing] = useState(false);
  const shotRef = useRef(null);
  useEffect(() => { if (!visible) setCapturing(false); }, [visible]);
  if (!visible) return <Sheet visible={false} onClose={onClose} title="Photo Mode" height="90%"><View /></Sheet>;
  const company = state.company;
  if (!company) return <Sheet visible={visible} onClose={onClose} title="Photo Mode" height="40%"><View /></Sheet>;
  const t = PM_THEMES[mode];
  const hq = cityById(company.hqCityId);
  const xp = companyXP(state);
  const level = companyLevelOf(xp);
  const ageDays = Math.max(1, Math.round((Date.now() - company.createdAt) / 86400000));
  const history = state.history || [];
  const longest = history.length ? [...history].sort((a, b) => b.km - a.km)[0] : null;
  const bestTrip = history.length ? [...history].sort((a, b) => b.net - a.net)[0] : null;
  const gemsFound = (state.easterEggs?.found || []).length;
  const tiersUnlocked = Object.keys(state.achievements?.unlocked || {}).length;
  const totalTiers = ACHIEVEMENTS.length * 5;
  const dateStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const shareText = () => {
    const lines = [
      `${company.name} — Empire Report Card`,
      `Level ${level} · ${companyTitleOf(level)} · Day ${ageDays}`,
      ``,
      `Fleet: ${state.trucks.length} trucks · ${state.staff.length} staff`,
      `${state.stats.deliveries.toLocaleString('en-IN')} deliveries · ${Math.round(state.stats.km).toLocaleString('en-IN')} km driven`,
      `Lifetime revenue: ${inrShort(state.stats.revenue)}`,
      `${(state.unlockedCountries || ['IN']).length} countries unlocked · ${gemsFound} hidden gems found`,
      `${tiersUnlocked}/${totalTiers} achievement tiers unlocked`,
    ];
    if (longest) lines.push(``, `Longest haul: ${cityById(longest.fromCityId)?.name} → ${cityById(longest.toCityId)?.name} · ${longest.km} km`);
    if (bestTrip) lines.push(`Best trip ever: ${cityById(bestTrip.fromCityId)?.name} → ${cityById(bestTrip.toCityId)?.name} · ${inr(bestTrip.net)} profit`);
    lines.push(``, `Built in Truck Empire Tycoon`);
    return lines.join('\n');
  };

  const doShare = async () => {
    setCapturing(true);
    try {
      const raw = await shotRef.current.capture();
      // React Native's built-in Share module can't actually attach a local
      // file on Android — it just forwards the raw file:// path, which
      // Android blocks with a FileUriExposedException, silently landing in
      // the catch below and shipping text-only every time. react-native-share
      // ships its own FileProvider and does the content:// conversion for
      // us, so the real image reaches WhatsApp/etc, not just a caption.
      const uri = raw.startsWith('file://') || raw.startsWith('content://') || raw.startsWith('data:') ? raw : `file://${raw}`;
      setCapturing(false);
      await RNShare.open({ url: uri, type: 'image/png', message: shareText(), failOnCancel: false });
    } catch (e) {
      setCapturing(false);
      if (e && (e.message === 'User did not share' || e.error === 'User did not share')) return; // cancelled — not a failure
      toast('Could not capture image — sharing as text instead.', 'warn');
      Share.share({ message: shareText() }).catch(() => {});
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Photo Mode" height="92%">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
        {/* Light / dark card toggle */}
        <Row style={{ gap: 6, marginBottom: 12 }}>
          <Chip label="Dark Card" icon="weather-night" active={mode === 'dark'} onPress={() => setMode('dark')} />
          <Chip label="Light Card" icon="white-balance-sunny" active={mode === 'light'} onPress={() => setMode('light')} />
        </Row>

        {/* Everything inside ViewShot is EXACTLY what gets captured as the PNG. */}
        <ViewShot ref={shotRef} options={{ format: 'png', quality: 1, result: 'tmpfile' }}>
          <View style={{ backgroundColor: t.bg, borderRadius: RADIUS.xl, padding: 22, borderWidth: 1, borderColor: t.border }}>
            {/* Masthead */}
            <Row style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <Row>
                <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: t.panel, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="truck-fast" size={17} color={t.accent} />
                </View>
                <Text style={{ marginLeft: 8, fontSize: 12, fontWeight: '800', color: t.faint, letterSpacing: 0.5 }}>TRUCK EMPIRE TYCOON</Text>
              </Row>
              <Text style={{ fontSize: 11, color: t.faint }}>{dateStr}</Text>
            </Row>

            {/* Identity */}
            <View style={{ alignItems: 'center' }}>
              <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: t.panel, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: t.border }}>
                <Icon name={company.logo || 'truck'} size={36} color={t.accent} />
              </View>
              <Text style={{ fontSize: 22, fontWeight: '800', color: t.text, marginTop: 12 }}>{company.name}</Text>
              <Text style={{ fontSize: 12, color: t.sub, marginTop: 3 }}>CEO {company.ceo} · HQ {hq?.name}</Text>
              <View style={{ marginTop: 12, backgroundColor: t.panel, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 7, borderWidth: 1, borderColor: t.border }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: t.gold }}>Level {level} · {companyTitleOf(level)}</Text>
              </View>
              <Text style={{ fontSize: 11, color: t.faint, marginTop: 8 }}>Day {ageDays} of the empire</Text>
            </View>

            {/* Stat grid */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 18, borderTopWidth: 1, borderTopColor: t.border, paddingTop: 4 }}>
              <PMStatTile icon="map-marker-distance" label="Total KM" value={Math.round(state.stats.km).toLocaleString('en-IN')} theme={t} />
              <PMStatTile icon="cash-multiple" label="Lifetime Revenue" value={inrShort(state.stats.revenue)} color={t.good} theme={t} />
              <PMStatTile icon="package-variant-closed-check" label="Deliveries" value={String(state.stats.deliveries)} theme={t} />
              <PMStatTile icon="truck" label="Fleet Size" value={String(state.trucks.length)} theme={t} />
              <PMStatTile icon="account-group" label="Staff" value={String(state.staff.length)} theme={t} />
              <PMStatTile icon="earth" label="Countries" value={String((state.unlockedCountries || ['IN']).length)} theme={t} />
              <PMStatTile icon="diamond-stone" label="Gems Found" value={String(gemsFound)} color={t.gold} theme={t} />
              <PMStatTile icon="trophy" label="Achievements" value={`${tiersUnlocked}/${totalTiers}`} color={t.gold} theme={t} />
              <PMStatTile icon="garage" label="Garages" value={String((state.hubs || []).length)} theme={t} />
            </View>

            {/* Records */}
            {(longest || bestTrip) && (
              <View style={{ marginTop: 6, borderTopWidth: 1, borderTopColor: t.border, paddingTop: 14 }}>
                {longest && (
                  <Row style={{ marginBottom: 9 }}>
                    <Icon name="highway" size={16} color={t.accent} />
                    <Text style={{ fontSize: 12, color: t.sub, marginLeft: 9, flex: 1 }}>
                      Longest haul ever: <Text style={{ color: t.text, fontWeight: '700' }}>{cityById(longest.fromCityId)?.name} → {cityById(longest.toCityId)?.name}</Text> · {longest.km} km
                    </Text>
                  </Row>
                )}
                {bestTrip && (
                  <Row>
                    <Icon name="star-circle" size={16} color={t.gold} />
                    <Text style={{ fontSize: 12, color: t.sub, marginLeft: 9, flex: 1 }}>
                      Most profitable trip: <Text style={{ color: t.good, fontWeight: '700' }}>{cityById(bestTrip.fromCityId)?.name} → {cityById(bestTrip.toCityId)?.name}</Text> · {inr(bestTrip.net)}
                    </Text>
                  </Row>
                )}
              </View>
            )}

            {/* Footer */}
            <Text style={{ fontSize: 10, color: t.faint, textAlign: 'center', marginTop: 18 }}>Built with Truck Empire Tycoon · Made in India</Text>
          </View>
        </ViewShot>

        <Btn title={capturing ? 'Capturing…' : 'Share as Image'} kind="green" icon="share-variant" disabled={capturing}
          style={{ marginTop: 16 }} onPress={doShare} />
        <Text style={[FONT.tiny, { textAlign: 'center', marginTop: 8 }]}>
          Captures the card above as a real PNG, in whichever theme is selected, and opens your share sheet.
        </Text>
      </ScrollView>
    </Sheet>
  );
}


export function CompanyInsightsModal({ visible, onClose, onOpenSettings, onOpenPhotoMode }) {
  const state = useGame(s => s);
  // PERF: once opened these sheets stay mounted; skip all the analytics work
  // (and the whole render tree) while hidden.
  if (!visible) return <Sheet visible={false} onClose={onClose} title="Company Insights" height="88%"><View /></Sheet>;
  const company = state.company;
  const hq = company ? cityById(company.hqCityId) : null;
  if (!company) return <Sheet visible={visible} onClose={onClose} title="Company" height="40%"><View /></Sheet>;
  const xp = companyXP(state);
  const level = companyLevelOf(xp);
  const nextXp = companyXpForLevel(level + 1), curXp = companyXpForLevel(level);
  const idle = state.trucks.filter(t => t.status === 'parked').length;
  const broken = state.trucks.filter(t => t.status === 'broken').length;
  const lowCond = state.trucks.filter(t => (t.condition == null ? 100 : t.condition) < 50).length;
  const freeDrivers = state.staff.filter(x => x.role === 'driver' && !x.truckId).length;
  const score = creditScoreOf(state.credit);
  const fuel = fuelFactorForDay(state.gameDay().day);
  const ageDays = Math.max(1, Math.round((Date.now() - company.createdAt) / 86400000));
  const utilisation = state.trucks.length ? Math.round(((state.trucks.length - idle - broken) / state.trucks.length) * 100) : 0;

  // Dynamic tips — only the ones that actually apply right now.
  const tips = [];
  if (idle > 0) tips.push({ icon: 'truck-alert-outline', text: `${idle} truck${idle > 1 ? 's' : ''} parked idle — every parked hour is money not earned. Use Depart All or dispatch from a garage.` });
  if (broken > 0) tips.push({ icon: 'wrench-clock', text: `${broken} truck${broken > 1 ? 's' : ''} broken down. Repair them (mechanic or 15 Gold) before the backlog hurts.` });
  if (lowCond > 0) tips.push({ icon: 'engine-off-outline', text: `${lowCond} truck${lowCond > 1 ? 's' : ''} below 50% condition — they drive slower every km. A service pays for itself.` });
  if (fuel <= 0.95) tips.push({ icon: 'gas-station', text: `Diesel is CHEAP today (${Math.round((fuel - 1) * 100)}%). Dispatch long hauls now and save on every litre.` });
  if (fuel >= 1.12) tips.push({ icon: 'gas-station-off', text: `Fuel spike today (+${Math.round((fuel - 1) * 100)}%). Short profitable runs beat cross-country marathons until it settles.` });
  if ((state.weather || []).length) tips.push({ icon: 'weather-cloudy-alert', text: `${state.weather.length} weather zones active — check TET News before dispatching; routes through them run up to 30% slower.` });
  if (freeDrivers === 0 && idle > 0) tips.push({ icon: 'account-plus', text: 'Idle trucks but no free drivers — hire from the Staff tab to put them to work.' });
  if (score < 650) tips.push({ icon: 'bank-remove', text: `Credit score ${score} — pay EMIs on time to win back the bank's trust and unlock bigger loans.` });
  if ((state.hubs || []).length < 3) tips.push({ icon: 'garage-variant', text: 'Garages give free refuelling + fast-travel. A garage on your busiest corridor compounds fast.' });
  if (!state.campaigns.some(a => a.endsAt > Date.now())) tips.push({ icon: 'bullhorn-outline', text: 'No marketing running — check the Marketing tab ROI table; the right campaign pays for itself.' });
  if (tips.length === 0) tips.push({ icon: 'check-decagram', text: 'Everything humming — fleet busy, books clean, skies clear. Time to expand into a new country?' });

  return (
    <Sheet visible={visible} onClose={onClose} title="Company Insights" height="88%">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
        {/* Identity + level */}
        <Card style={{ marginBottom: 12, backgroundColor: '#0F172A', borderColor: '#1E293B' }}>
          <Row>
            <View style={[cs.heroIcon, { width: 54, height: 54, backgroundColor: '#1E293B' }]}>
              <Icon name={company.logo || 'truck'} size={28} color="#5B8DF0" />
            </View>
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={[FONT.h2, { color: '#F8FAFC' }]}>{company.name}</Text>
              <Text style={[FONT.tiny, { color: '#94A3B8' }]}>CEO {company.ceo} · HQ {hq?.name} · day {ageDays} of the empire</Text>
            </View>
          </Row>
          <Row style={{ marginTop: 12, justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[FONT.body, { color: '#F8FAFC', fontWeight: '800' }]}>Lv {level} · {companyTitleOf(level)}</Text>
            <Text style={[FONT.tiny, { color: '#94A3B8' }]}>{(xp - curXp).toLocaleString('en-IN')}/{(nextXp - curXp).toLocaleString('en-IN')} XP</Text>
          </Row>
          <View style={{ height: 7, borderRadius: 4, backgroundColor: '#1E293B', marginTop: 6, overflow: 'hidden' }}>
            <View style={{ width: `${((xp - curXp) / Math.max(1, nextXp - curXp)) * 100}%`, height: 7, backgroundColor: '#5B8DF0' }} />
          </View>
        </Card>

        {/* Health scorecard */}
        <SectionTitle icon="heart-pulse" text="Company Health" />
        <Row style={{ marginBottom: 8, backgroundColor: C.bgSoft, borderRadius: RADIUS.md, paddingVertical: 10 }}>
          <ContractStat icon="truck-fast" label="Fleet busy" value={`${utilisation}%`} color={utilisation >= 50 ? C.green : C.amber} />
          <ContractStat icon="bank" label="Credit" value={String(score)} color={score >= 650 ? C.green : C.red} />
          <ContractStat icon="account-group" label="Staff" value={String(state.staff.length)} />
          <ContractStat icon="earth" label="Countries" value={String((state.unlockedCountries || ['IN']).length)} color={C.blue} />
        </Row>
        <Row style={{ marginBottom: 14, backgroundColor: C.bgSoft, borderRadius: RADIUS.md, paddingVertical: 10 }}>
          <ContractStat icon="truck" label="Trucks" value={String(state.trucks.length)} />
          <ContractStat icon="garage" label="Garages" value={String((state.hubs || []).length)} />
          <ContractStat icon="package-variant-closed-check" label="Deliveries" value={String(state.stats.deliveries)} />
          <ContractStat icon="cash-multiple" label="Revenue" value={inrShort(state.stats.revenue)} color={C.green} />
        </Row>

        {/* Smart tips */}
        <SectionTitle icon="lightbulb-on-outline" text="Tips For You Right Now" />
        <Card style={{ marginBottom: 14 }}>
          {tips.slice(0, 6).map((t, i) => (
            <Row key={i} style={[{ paddingVertical: 9, alignItems: 'flex-start' }, i > 0 && { borderTopWidth: 1, borderTopColor: C.border }]}>
              <Icon name={t.icon} size={18} color={C.blue} style={{ marginTop: 1 }} />
              <Text style={[FONT.body, { marginLeft: 9, flex: 1 }]}>{t.text}</Text>
            </Row>
          ))}
        </Card>

        <Btn title="Photo Mode — Empire Report Card" kind="blue" icon="trophy-award" style={{ marginBottom: 10 }}
          onPress={() => { onClose(); onOpenPhotoMode && onOpenPhotoMode(); }} />
        <Btn title="Edit company (Settings)" kind="soft" icon="cog-outline" onPress={() => { onClose(); onOpenSettings && onOpenSettings(); }} />
      </ScrollView>
    </Sheet>
  );
}

// ============ TET News 24×7 (fuel, weather, events, trip advice) ============
// The news channel the notifications kept hinting at: fuel market moves,
// live weather bulletins with the regions they cover, world events, and
// concrete "dispatch here today" suggestions based on all of it.
export function NewsModal({ visible, onClose }) {
  const state = useGame(s => s);
  const day = state.gameDay().day;
  // Suggestions memo must run unconditionally (hooks), but the heavy city
  // scans inside it only execute while the sheet is visible.
  const hidden = !visible;
  const fuel = fuelFactorForDay(day);
  const fuelY = fuelFactorForDay(Math.max(1, day - 1));
  const zones = state.weather || [];
  const events = state.mapEvents || [];
  const unlocked = state.unlockedCountries || ['IN'];

  // Cities affected by each weather zone (big cities inside the blob) —
  // memoized per zone set so any unrelated re-render (a toast, a tick
  // elsewhere) doesn't re-scan every city again.
  const affectedCache = useMemo(() => {
    const m = new Map();
    for (const z of zones) {
      m.set(z.id, CITIES.filter(c => {
        if (c.tier > 2 || ((c.country || 'IN') !== 'IN' && !unlocked.includes(c.country))) return false;
        const kLat = 111, kLng = 111 * Math.cos((z.lat * Math.PI) / 180);
        const dy = (c.lat - z.lat) * kLat, dx = (c.lng - z.lng) * kLng;
        return Math.sqrt(dx * dx + dy * dy) <= weatherRadiusAt(z, Math.atan2(dy, dx));
      }).slice(0, 4));
    }
    return m;
  }, [zones, unlocked]);
  const affected = (z) => affectedCache.get(z.id) || [];

  // Suggested destinations: busy tier-1/2 unlocked cities with CLEAR skies.
  const suggestions = useMemo(() => {
    if (hidden) return [];
    const inZone = (c) => zones.some(z => {
      const kLat = 111, kLng = 111 * Math.cos((z.lat * Math.PI) / 180);
      const dy = (c.lat - z.lat) * kLat, dx = (c.lng - z.lng) * kLng;
      return Math.sqrt(dx * dx + dy * dy) <= weatherRadiusAt(z, Math.atan2(dy, dx));
    });
    return CITIES
      .filter(c => c.tier <= 2 && !c.locality && unlocked.includes(c.country || 'IN') && !inZone(c))
      .sort((a, b) => (b.pop || 0) - (a.pop || 0))
      .filter((_, i) => (i + day) % 7 < 3) // rotate picks day to day
      .slice(0, 4);
  }, [zones, unlocked, day, hidden]);
  if (hidden) return <Sheet visible={false} onClose={onClose} title="Apna News, Tera Kya Jata" height="88%"><View /></Sheet>;

  const gossip = [
    'Transporters association demands wider bypasses around metro mandis. Hamare drivers bole: "pehle chai ka thela hatao".',
    'Insiders whisper the diesel market may turn tomorrow — watch the index. Ya mat dekho, tera kya jaata hai?',
    'Border agents report record cargo volumes. One officer seen practising his stamp arm at the gym.',
    'Veteran drivers say monsoon routes reward patience, not speed. Naye drivers say "kya?"',
    'Freight rates firm up as festival demand builds. Mithai boxes officially cargo of the season.',
  ][day % 5];

  return (
    <Sheet visible={visible} onClose={onClose} title="Apna News, Tera Kya Jata" height="88%">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
        {/* TV masthead: red channel band + LIVE dot, like a real news channel */}
        <View style={{ backgroundColor: '#C0161C', borderRadius: RADIUS.lg, padding: 12, marginBottom: 10 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row>
              <View style={{ backgroundColor: '#fff', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ color: '#C0161C', fontWeight: '900', fontSize: 16, letterSpacing: 1 }}>APNA NEWS</Text>
              </View>
              <Text style={{ color: '#FFD7D8', fontWeight: '700', fontSize: 10, marginLeft: 8, alignSelf: 'flex-end' }}>Tera Kya Jata</Text>
            </Row>
            <Row style={{ backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#FF4D4D', marginRight: 5, alignSelf: 'center' }} />
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 10 }}>LIVE</Text>
            </Row>
          </Row>
          <Text style={{ color: '#FFD7D8', fontSize: 10.5, marginTop: 6 }} numberOfLines={1}>
            ● BREAKING ● Day {day} across the empire ● {zones.length} weather alerts ● Fuel {fuel > 1 ? 'UP' : fuel < 1 ? 'DOWN' : 'FLAT'} {Math.abs(Math.round((fuel - 1) * 100))}% ● Sabse tez, sabse bakwaas ●
          </Text>
        </View>

        {/* Breaking: fuel market */}
        <Card style={{ marginBottom: 12, backgroundColor: '#0F172A', borderColor: '#1E293B' }}>
          <Row style={{ justifyContent: 'space-between', marginBottom: 6 }}>
            <Pill text="FUEL DESK" icon="gas-station" color="#F4D35E" bg="#3B2F0B" />
            <Pill text="EXCLUSIVE" icon="star-four-points" color="#fff" bg="#C0161C" />
          </Row>
          <Text style={[FONT.h3, { color: '#F8FAFC' }]}>
            {fuel >= 1.12 ? `Diesel spikes ${Math.round((fuel - 1) * 100)}% nationwide` :
              fuel <= 0.95 ? `Diesel crashes ${Math.round((1 - fuel) * 100)}% — pumps crowded` :
                'Fuel market steady today'}
          </Text>
          <Text style={[FONT.tiny, { color: '#94A3B8', marginTop: 4 }]}>
            ₹{Math.round(92 * fuel)}/L today vs ₹{Math.round(92 * fuelY)}/L yesterday ({fuel > fuelY ? 'rising' : fuel < fuelY ? 'falling' : 'flat'}).
            {fuel <= 0.95 ? ' Editors say: dispatch the long hauls NOW.' : fuel >= 1.12 ? ' Editors say: keep runs short until it cools.' : ' No panic at the pumps.'}
          </Text>
        </Card>

        {/* Weather bulletins */}
        <SectionTitle icon="weather-cloudy-alert" text="Weather Bulletins" />
        {zones.length === 0 ? (
          <Card style={{ marginBottom: 12 }}><Text style={FONT.sub}>Clear skies across the network today — no advisories.</Text></Card>
        ) : zones.map(z => {
          const k = WEATHER_KINDS[z.kind] || {};
          const cities = affected(z);
          return (
            <Card key={z.id} style={{ marginBottom: 8, borderLeftWidth: 4, borderLeftColor: k.color || C.blue }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Row style={{ flex: 1 }}>
                  <Icon name={k.icon || 'weather-pouring'} size={20} color={k.color || C.blue} />
                  <View style={{ marginLeft: 9, flex: 1 }}>
                    <Text style={[FONT.body, { fontWeight: '800' }]}>{k.label} over {z.name}</Text>
                    <Text style={FONT.tiny}>
                      Trucks {Math.round((1 - (k.slow || 1)) * 100)}% slower inside the zone.
                      {cities.length ? ` Affects ${cities.map(c => c.name).join(', ')}.` : ''}
                    </Text>
                  </View>
                </Row>
              </Row>
            </Card>
          );
        })}

        {/* Trip advice */}
        <SectionTitle icon="compass-outline" text="Where To Send Trucks Today" />
        <Card style={{ marginBottom: 12 }}>
          {suggestions.length === 0 ? (
            <Text style={FONT.sub}>Rough weather everywhere — brave the slow lanes or wait for tomorrow's bulletin.</Text>
          ) : suggestions.map((c, i) => (
            <Row key={c.id} style={[{ paddingVertical: 9, justifyContent: 'space-between' }, i > 0 && { borderTopWidth: 1, borderTopColor: C.border }]}>
              <Row style={{ flex: 1 }}>
                <Icon name="weather-sunny" size={17} color={C.amber} />
                <View style={{ marginLeft: 9, flex: 1 }}>
                  <Text style={[FONT.body, { fontWeight: '700' }]}>{c.name}</Text>
                  <Text style={FONT.tiny}>{c.state} · clear skies, big demand (pop {(c.pop / 1e6).toFixed(1)}M)</Text>
                </View>
              </Row>
              <Pill text="Clear route" color={C.green} bg={C.greenSoft} icon="check" />
            </Row>
          ))}
          <Text style={[FONT.tiny, { marginTop: 8 }]}>Picks rotate daily — clear-sky tier-1/2 cities in your unlocked countries.</Text>
        </Card>

        {/* BREAKING: your empire's own wire — live incidents, thefts,
            marketing launches and the freshest company headlines. */}
        <SectionTitle icon="flash" text="Breaking — Empire Wire" />
        {(() => {
          const items = [];
          // Live incidents on trucks right now
          for (const d of state.deliveries) {
            if (!d.incident) continue;
            const t = state.trucks.find(x => x.id === d.truckId);
            const im = incidentMeta(d.incident.type);
            items.push({ key: 'inc' + d.id, icon: im.icon, color: im.color, tag: 'HAPPENING NOW',
              text: `${im.title.replace('!', '')} — ${state.company?.name}'s ${t ? (t.customName || modelById(t.modelId).name) : 'truck'} held up en route to ${cityById(d.toCityId)?.name}.` });
          }
          // Marketing campaigns on air
          for (const a of state.campaigns.filter(x => x.endsAt > Date.now())) {
            const def = CAMPAIGNS.find(c => c.id === a.campaignId);
            if (def) items.push({ key: 'mk' + a.id, icon: 'bullhorn', color: C.blue, tag: 'AD WATCH',
              text: `${state.company?.name} blankets the market with "${def.name}" — rivals reportedly sweating (+${Math.round(def.boost * 100)}% freight buzz).` });
          }
          // Freshest company headlines from the notification wire
          for (const n of state.notifications.slice(0, 6)) {
            items.push({ key: n.id, icon: n.icon, color: C.sub, tag: relTime(n.ts).toUpperCase(), text: n.message });
          }
          if (!items.length) return <Card style={{ marginBottom: 12 }}><Text style={FONT.sub}>A quiet hour on the wire — even the bandits are on chai break.</Text></Card>;
          return items.slice(0, 9).map((it, i) => (
            <Card key={it.key} style={{ marginBottom: 6, padding: 10, borderLeftWidth: 3, borderLeftColor: it.color || C.red }}>
              <Row style={{ alignItems: 'flex-start' }}>
                <Icon name={it.icon || 'flash'} size={16} color={it.color || C.red} style={{ marginTop: 1 }} />
                <View style={{ marginLeft: 8, flex: 1 }}>
                  <Text style={[FONT.tiny, { fontWeight: '900', color: '#C0161C', fontSize: 9, letterSpacing: 0.5 }]}>{it.tag}</Text>
                  <Text style={FONT.body} numberOfLines={3}>{it.text}</Text>
                </View>
              </Row>
            </Card>
          ));
        })()}

        {/* Market Watch — the exchange's own ticker: today's biggest mover
            and any freshly-listed IPO, so the stock market feels like part
            of the same news wire instead of a separate silo. */}
        {(state.stocks || []).length > 0 ? (() => {
          if (hidden) return null;
          const stocks = state.stocks;
          let top = stocks[0], bottom = stocks[0];
          for (const st of stocks) {
            const r = stockYearReturn(st);
            if (r > stockYearReturn(top)) top = st;
            if (r < stockYearReturn(bottom)) bottom = st;
          }
          const founded = stocks.filter(st => st.founder === 'player').slice(-3);
          return (
            <>
              <SectionTitle icon="finance" text="Market Watch" />
              <Card style={{ marginBottom: 6, padding: 10, borderLeftWidth: 3, borderLeftColor: C.green }}>
                <Row style={{ alignItems: 'flex-start' }}>
                  <Icon name="trending-up" size={16} color={C.green} style={{ marginTop: 1 }} />
                  <View style={{ marginLeft: 8, flex: 1 }}>
                    <Text style={[FONT.tiny, { fontWeight: '900', color: C.green, fontSize: 9, letterSpacing: 0.5 }]}>TOP GAINER</Text>
                    <Text style={FONT.body} numberOfLines={2}>{top.name} is up {Math.round(stockYearReturn(top) * 100)}% this year — trading at {inr(top.price)}.</Text>
                  </View>
                </Row>
              </Card>
              <Card style={{ marginBottom: 6, padding: 10, borderLeftWidth: 3, borderLeftColor: C.red }}>
                <Row style={{ alignItems: 'flex-start' }}>
                  <Icon name="trending-down" size={16} color={C.red} style={{ marginTop: 1 }} />
                  <View style={{ marginLeft: 8, flex: 1 }}>
                    <Text style={[FONT.tiny, { fontWeight: '900', color: C.red, fontSize: 9, letterSpacing: 0.5 }]}>TOP LOSER</Text>
                    <Text style={FONT.body} numberOfLines={2}>{bottom.name} is down {Math.round(Math.abs(stockYearReturn(bottom)) * 100)}% this year — now {inr(bottom.price)}.</Text>
                  </View>
                </Row>
              </Card>
              {founded.map(st => (
                <Card key={st.id} style={{ marginBottom: 6, padding: 10, borderLeftWidth: 3, borderLeftColor: C.gold }}>
                  <Row style={{ alignItems: 'flex-start' }}>
                    <Icon name="rocket-launch" size={16} color={C.gold} style={{ marginTop: 1 }} />
                    <View style={{ marginLeft: 8, flex: 1 }}>
                      <Text style={[FONT.tiny, { fontWeight: '900', color: '#C0161C', fontSize: 9, letterSpacing: 0.5 }]}>IPO WATCH</Text>
                      <Text style={FONT.body} numberOfLines={2}>{st.name} debuted on the exchange, founded by {state.company?.name} — now trading at {inr(st.price)}.</Text>
                    </View>
                  </Row>
                </Card>
              ))}
            </>
          );
        })() : null}

        {/* World events */}
        {events.length > 0 && (
          <>
            <SectionTitle icon="alert-decagram-outline" text="On The Wire" />
            {events.map(ev => (
              <Card key={ev.id} style={{ marginBottom: 8, padding: 12 }}>
                <Row>
                  <Icon name={ev.icon} size={17} color={ev.color || C.red} />
                  <View style={{ marginLeft: 9, flex: 1 }}>
                    <Text style={FONT.body}>{ev.label}</Text>
                    <Text style={FONT.tiny}>{relTime(ev.ts)}</Text>
                  </View>
                </Row>
              </Card>
            ))}
          </>
        )}

        {/* Gossip column */}
        <SectionTitle icon="newspaper-variant-outline" text="The Gossip Column" />
        <Card>
          <Text style={[FONT.body, { fontStyle: 'italic' }]}>"{gossip}"</Text>
          <Text style={[FONT.tiny, { marginTop: 6 }]}>— Apna News desk. 100% unverified, 200% confident. Tera kya jata?</Text>
        </Card>
      </ScrollView>
    </Sheet>
  );
}

// ============================== STOCK MARKET ==============================
function LoadMore({ shown, total, onMore }) {
  if (shown >= total) return null;
  return (
    <Pressable onPress={onMore} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, marginTop: 2, borderRadius: 22, borderWidth: 1, borderColor: C.border, backgroundColor: C.bgSoft }}>
      <Icon name="chevron-down" size={16} color={C.blue} />
      <Text style={{ color: C.blue, fontWeight: '700', marginLeft: 4 }}>Show more ({total - shown})</Text>
    </Pressable>
  );
}

// A candle/line chart built from a stock's daily-close history — synthetic
// OHLC per point (deterministic jitter from the point's own values, not
// stored) so candles look real without doubling the persisted data.
function StockChart({ stock, days, mode, tf, now }) {
  const W = 320, H = 140, PAD = 6;
  let points;
  if (tf?.live) {
    // Live 1H/3H windows are synthesized from the same deterministic jitter
    // curve the ticker uses — sampled every ~5 minutes across the window —
    // so the chart and the live price on screen always agree.
    const windowMs = tf.hours * 3600 * 1000;
    const steps = 24;
    points = Array.from({ length: steps + 1 }, (_, i) => {
      const t = now - windowMs + (windowMs * i) / steps;
      return { day: t, price: liveStockPrice(stock, t) };
    });
  } else {
    const hist = stock.history || [];
    const nowDay = hist.length ? hist[hist.length - 1].day : 1;
    const cutoff = nowDay - days;
    points = hist.filter(h => h.day > cutoff);
    if (points.length < 2) points = hist.slice(-2);
  }
  if (points.length < 2) points = [{ day: 0, price: stock.price }, { day: 1, price: stock.price }];

  const prices = points.map(p => p.price);
  const min = Math.min(...prices), max = Math.max(...prices);
  const span = Math.max(0.01, max - min);
  const x = i => PAD + (i / Math.max(1, points.length - 1)) * (W - PAD * 2);
  const y = v => H - PAD - ((v - min) / span) * (H - PAD * 2);
  const up = points[points.length - 1].price >= points[0].price;
  const color = up ? C.green : C.red;

  if (mode === 'candle') {
    const cw = Math.max(2, ((W - PAD * 2) / points.length) * 0.6);
    return (
      <Svg width={W} height={H}>
        {points.map((p, i) => {
          // Synthetic OHLC: open = previous close, close = this point,
          // high/low nudged out by a tiny deterministic jitter.
          const openP = i > 0 ? points[i - 1].price : p.price;
          const closeP = p.price;
          const seed = Math.abs(Math.sin(p.day * 12.9898 + i));
          const wick = span * 0.04 * (0.3 + seed);
          const hi = Math.max(openP, closeP) + wick;
          const lo = Math.min(openP, closeP) - wick;
          const cUp = closeP >= openP;
          const cColor = cUp ? C.green : C.red;
          const cx = x(i);
          const bodyTop = y(Math.max(openP, closeP));
          const bodyBot = y(Math.min(openP, closeP));
          return (
            <G key={i}>
              <Path d={`M${cx} ${y(hi)} L${cx} ${y(lo)}`} stroke={cColor} strokeWidth={1} />
              <Path
                d={`M${cx - cw / 2} ${bodyTop} L${cx + cw / 2} ${bodyTop} L${cx + cw / 2} ${Math.max(bodyBot, bodyTop + 1)} L${cx - cw / 2} ${Math.max(bodyBot, bodyTop + 1)} Z`}
                fill={cColor} />
            </G>
          );
        })}
      </Svg>
    );
  }

  const line = points.map((p, i) => `${x(i)},${y(p.price)}`).join(' ');
  const area = `${x(0)},${H - PAD} ${line} ${x(points.length - 1)},${H - PAD}`;
  return (
    <Svg width={W} height={H}>
      <Polyline points={area} fill={color} opacity={0.12} stroke="none" />
      <Polyline points={line} fill="none" stroke={color} strokeWidth={2} />
    </Svg>
  );
}

function StockDetail({ stock, portfolio, balance, buyStock, sellStock, toast, onBack }) {
  const [tf, setTf] = useState('1D');
  const [mode, setMode] = useState('line');
  const [now, setNow] = useState(Date.now());
  const [feed, setFeed] = useState([]);
  const tfDef = STOCK_TIMEFRAMES.find(t => t.key === tf) || STOCK_TIMEFRAMES[2];
  const open = isMarketOpen(now);

  // Live ticker — only this ONE open stock re-computes every couple of
  // seconds (local component state, not a store subscription), so this
  // can't repeat the earlier freeze bug no matter how many companies exist.
  useEffect(() => {
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (isMarketOpen(t) && Math.random() < 0.6) {
        setFeed(f => [fakeTradeFor(stock, t), ...f].slice(0, 6));
      }
    }, 2500);
    return () => clearInterval(id);
  }, [stock.id]);

  const livePrice = tfDef.live ? liveStockPrice(stock, now) : stock.price;
  const ret = tfDef.live
    ? (liveStockPrice(stock, now) - liveStockPrice(stock, now - tfDef.hours * 3600 * 1000)) / liveStockPrice(stock, now - tfDef.hours * 3600 * 1000)
    : stockReturnOverDays(stock, tfDef.days);
  const pos = portfolio[stock.id];
  const holdingValue = pos ? pos.shares * stock.price : 0;
  const holdingPL = pos ? holdingValue - pos.shares * pos.avgCost : 0;
  const maxAffordable = Math.max(0, Math.floor(balance / (stock.price * 1.005)));

  return (
    <View>
      <Pressable onPress={onBack} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <Icon name="chevron-left" size={18} color={C.blue} />
        <Text style={[FONT.body, { color: C.blue, fontWeight: '700', marginLeft: 2 }]}>Back to market</Text>
      </Pressable>
      <Card style={{ marginBottom: 10, backgroundColor: '#0F172A', borderColor: '#1E293B' }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={[FONT.h3, { color: '#F8FAFC' }]} numberOfLines={1}>{stock.name}</Text>
            <Text style={[FONT.tiny, { color: '#94A3B8' }]}>{stock.sector}{stock.founder === 'player' ? ' · Founder shares' : ''}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[FONT.h2, { color: '#F8FAFC' }]}>{inr(livePrice)}</Text>
            <Text style={[FONT.tiny, { color: ret >= 0 ? '#4ADE80' : '#F87171', fontWeight: '800' }]}>
              {ret >= 0 ? '▲' : '▼'} {Math.abs(Math.round(ret * 1000) / 10)}% · {tf}
            </Text>
          </View>
        </Row>
        <Row style={{ marginTop: 8, alignItems: 'center' }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: open ? '#4ADE80' : '#64748B', marginRight: 6 }} />
          <Text style={[FONT.tiny, { color: '#94A3B8' }]}>{open ? 'Market open · live · 9:15 AM–3:30 PM' : 'Market closed · frozen at last close · reopens 9:15 AM'}</Text>
        </Row>
      </Card>

      <Row style={{ gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {STOCK_TIMEFRAMES.map(t => (
          <Pressable key={t.key} onPress={() => setTf(t.key)}
            style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.sm, backgroundColor: tf === t.key ? C.blueSoft : C.bgSoft, borderWidth: 1, borderColor: tf === t.key ? C.blue : C.border }}>
            <Text style={[FONT.tiny, { fontWeight: '700', color: tf === t.key ? C.blue : C.sub }]}>{t.label}</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => setMode(m => m === 'line' ? 'candle' : 'line')}
          style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.sm, backgroundColor: C.bgSoft, borderWidth: 1, borderColor: C.border, flexDirection: 'row', alignItems: 'center' }}>
          <Icon name={mode === 'line' ? 'chart-line' : 'chart-candlestick'} size={14} color={C.sub} />
          <Text style={[FONT.tiny, { fontWeight: '700', marginLeft: 4, color: C.sub }]}>{mode === 'line' ? 'Line' : 'Candle'}</Text>
        </Pressable>
      </Row>

      <Card style={{ marginBottom: 10, alignItems: 'center' }}>
        <StockChart stock={stock} days={tfDef.days} tf={tfDef} now={now} mode={mode} />
      </Card>

      {(() => {
        const f = stockFundamentals(stock);
        return (
          <Card style={{ marginBottom: 10 }}>
            <Text style={[FONT.tiny, { fontWeight: '800', color: C.sub, marginBottom: 8 }]}>COMPANY FUNDAMENTALS</Text>
            <Row style={{ flexWrap: 'wrap' }}>
              <View style={{ width: '50%', marginBottom: 10 }}>
                <Text style={FONT.tiny}>Market Cap</Text>
                <Text style={[FONT.body, { fontWeight: '800' }]}>{inrShort(f.marketCap)}</Text>
              </View>
              <View style={{ width: '50%', marginBottom: 10 }}>
                <Text style={FONT.tiny}>Annual Revenue</Text>
                <Text style={[FONT.body, { fontWeight: '800' }]}>{inrShort(f.annualRevenue)}</Text>
              </View>
              <View style={{ width: '50%' }}>
                <Text style={FONT.tiny}>Annual Profit (post-tax)</Text>
                <Text style={[FONT.body, { fontWeight: '800', color: C.green }]}>{inrShort(f.annualProfit * (1 - f.taxRate))}</Text>
              </View>
              <View style={{ width: '50%' }}>
                <Text style={FONT.tiny}>P/E Ratio</Text>
                <Text style={[FONT.body, { fontWeight: '800' }]}>{f.peRatio ? f.peRatio.toFixed(1) : '—'}</Text>
              </View>
            </Row>
            <Text style={[FONT.tiny, { color: C.faint, marginTop: 4 }]}>Corporate tax rate: {Math.round(f.taxRate * 100)}% · {f.sharesOutstanding.toLocaleString()} shares outstanding</Text>
          </Card>
        );
      })()}

      {open && feed.length > 0 ? (
        <Card style={{ marginBottom: 10 }}>
          <Text style={[FONT.tiny, { fontWeight: '800', color: C.sub, marginBottom: 6 }]}>LIVE MARKET ACTIVITY</Text>
          {feed.map((tr, i) => (
            <Row key={i} style={{ justifyContent: 'space-between', marginTop: i ? 4 : 0 }}>
              <Text style={FONT.tiny} numberOfLines={1}>{tr.trader}</Text>
              <Text style={[FONT.tiny, { fontWeight: '700', color: tr.side === 'buy' ? C.green : C.red }]}>
                {tr.side === 'buy' ? 'Bought' : 'Sold'} {tr.qty} sh
              </Text>
            </Row>
          ))}
        </Card>
      ) : null}

      {pos ? (
        <Card style={{ marginBottom: 10 }}>
          <Text style={[FONT.body, { fontWeight: '800' }]}>Your Position</Text>
          <Row style={{ justifyContent: 'space-between', marginTop: 6 }}>
            <Text style={FONT.tiny}>{pos.shares} shares · avg {inrShort(pos.avgCost)}</Text>
            <Text style={[FONT.tiny, { fontWeight: '800', color: holdingPL >= 0 ? C.green : C.red }]}>
              {holdingPL >= 0 ? '+' : ''}{inrShort(holdingPL)} · {inrShort(holdingValue)} value
            </Text>
          </Row>
        </Card>
      ) : null}

      <Card style={{ marginBottom: 10 }}>
        <Text style={[FONT.body, { fontWeight: '800' }]}>Buy</Text>
        <Row style={{ gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {[1, 5, 10, 25].map(n => (
            <Pressable key={n} disabled={maxAffordable < n} onPress={() => {
              const r = buyStock(stock.id, n);
              toast(r.ok ? `Bought ${n} × ${stock.name}` : r.err, r.ok ? 'success' : 'error');
            }} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.sm, backgroundColor: C.greenSoft, borderWidth: 1, borderColor: C.green, opacity: maxAffordable < n ? 0.4 : 1 }}>
              <Text style={[FONT.tiny, { fontWeight: '700', color: C.green }]}>{n} sh</Text>
            </Pressable>
          ))}
          <Pressable disabled={maxAffordable <= 0} onPress={() => {
            const r = buyStock(stock.id, maxAffordable);
            toast(r.ok ? `Bought ${maxAffordable} × ${stock.name}` : r.err, r.ok ? 'success' : 'error');
          }} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.sm, backgroundColor: C.green, opacity: maxAffordable <= 0 ? 0.4 : 1 }}>
            <Text style={[FONT.tiny, { fontWeight: '800', color: '#fff' }]}>Max ({maxAffordable})</Text>
          </Pressable>
        </Row>
      </Card>

      {pos ? (
        <Card style={{ marginBottom: 10 }}>
          <Text style={[FONT.body, { fontWeight: '800' }]}>Sell</Text>
          <Row style={{ gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {[0.25, 0.5, 1].map(frac => {
              const n = Math.max(1, Math.round(pos.shares * frac));
              return (
                <Pressable key={frac} onPress={() => {
                  const r = sellStock(stock.id, n);
                  toast(r.ok ? `Sold ${n} × ${stock.name}` : r.err, r.ok ? 'success' : 'error');
                }} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.sm, backgroundColor: C.redSoft || '#FEE2E2', borderWidth: 1, borderColor: C.red }}>
                  <Text style={[FONT.tiny, { fontWeight: '700', color: C.red }]}>{frac === 1 ? `All (${n})` : `${Math.round(frac * 100)}% (${n})`}</Text>
                </Pressable>
              );
            })}
          </Row>
        </Card>
      ) : null}
    </View>
  );
}

// A completely separate path from the main market: applying for an IPO is
// its own screen with its own criteria, reachable via a dedicated button —
// it does NOT share a page with buying/selling other companies' shares.
function IpoLaunchPanel({ req, launchStock, toast, onBack, onLaunched }) {
  return (
    <View>
      <Pressable onPress={onBack} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <Icon name="chevron-left" size={18} color={C.blue} />
        <Text style={[FONT.body, { color: C.blue, fontWeight: '700', marginLeft: 2 }]}>Back to market</Text>
      </Pressable>
      <Card style={{ marginBottom: 10, opacity: req.met ? 1 : 0.9 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={[FONT.h3, { fontWeight: '800' }]}>Launch Your Own IPO</Text>
          <Icon name="rocket-launch" size={20} color={req.met ? C.gold : C.faint} />
        </Row>
        <Text style={[FONT.tiny, { marginTop: 4 }]}>Prove your empire's track record to list on the exchange — ₹50L listing fee, 5,000 founder shares. Once listed, it trades on the main market like every other company.</Text>
        {[
          { label: 'Distance driven', have: req.have.km, need: req.km, unit: 'km' },
          { label: 'Lifetime revenue', have: req.have.revenue, need: req.revenue, unit: '₹' },
          { label: 'Deliveries completed', have: req.have.deliveries, need: req.deliveries, unit: '' },
        ].map(row => (
          <View key={row.label} style={{ marginTop: 10 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={FONT.tiny}>{row.label}</Text>
              <Text style={[FONT.tiny, { fontWeight: '700', color: row.have >= row.need ? C.green : C.sub }]}>
                {row.unit === '₹' ? inrShort(row.have) : row.have.toLocaleString()} / {row.unit === '₹' ? inrShort(row.need) : row.need.toLocaleString()}
              </Text>
            </Row>
            <Progress pct={Math.min(100, (row.have / row.need) * 100)} color={row.have >= row.need ? C.green : C.amber} style={{ marginTop: 4 }} />
          </View>
        ))}
        <Btn title={req.met ? 'Launch IPO · ₹50,00,000' : 'Requirements not met yet'} kind={req.met ? 'green' : 'soft'} disabled={!req.met}
          style={{ marginTop: 12 }}
          onPress={() => {
            const r = launchStock();
            toast(r.ok ? `${r.stock.name} listed! You hold 5,000 founder shares.` : r.err, r.ok ? 'success' : 'error');
            if (r.ok) onLaunched(r.stock.id);
          }} />
      </Card>
    </View>
  );
}

const STOCK_PAGE = 20;
export function StockMarketModal({ visible, onClose }) {
  const toast = useToast();
  const stocks = useGame(s => s.stocks || []);
  const portfolio = useGame(s => s.portfolio || {});
  const balance = useGame(s => s.balance);
  const buyStock = useGame(s => s.buyStock);
  const sellStock = useGame(s => s.sellStock);
  const launchStock = useGame(s => s.launchStock);
  const ipoRequirements = useGame(s => s.ipoRequirements);
  const [view, setView] = useState('list'); // 'list' | 'ipo' — two separate paths
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!visible) { setSelectedId(null); setQuery(''); setPage(1); setView('list'); } }, [visible]);

  // Whole-market ticker: every listed price on the list screen breathes in
  // real time too (not just the one open detail view), so the market feels
  // alive with bots/other participants trading even when you're just
  // browsing. Cheap — pure arithmetic over the visible page only.
  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => setNow(Date.now()), 3000);
    return () => clearInterval(id);
  }, [visible]);

  const selected = selectedId ? stocks.find(s => s.id === selectedId) : null;

  // Only crunch the whole 1000+-company list while the sheet is actually
  // open on the list view — never on every render, never in the background.
  const insight = useMemo(() => {
    if (!visible || selected || view !== 'list' || !stocks.length) return null;
    let top = stocks[0], bottom = stocks[0];
    let portfolioValue = 0, portfolioCost = 0;
    for (const st of stocks) {
      const r = stockYearReturn(st);
      if (r > stockYearReturn(top)) top = st;
      if (r < stockYearReturn(bottom)) bottom = st;
      const pos = portfolio[st.id];
      if (pos) { portfolioValue += pos.shares * st.price; portfolioCost += pos.shares * pos.avgCost; }
    }
    return { top, bottom, portfolioValue, portfolioCost, count: stocks.length };
  }, [visible, selected, view, stocks, portfolio]);

  const filtered = useMemo(() => {
    if (!visible || selected || view !== 'list') return [];
    const q = query.trim().toLowerCase();
    const list = q ? stocks.filter(s => s.name.toLowerCase().includes(q) || s.sector.toLowerCase().includes(q)) : stocks;
    return list;
  }, [visible, selected, view, stocks, query]);
  const visibleRows = filtered.slice(0, page * STOCK_PAGE);

  if (selected) {
    return (
      <Sheet visible={visible} onClose={onClose} title="Stock Market" height="90%">
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
          <StockDetail stock={selected} portfolio={portfolio} balance={balance}
            buyStock={buyStock} sellStock={sellStock} toast={toast} onBack={() => setSelectedId(null)} />
        </ScrollView>
      </Sheet>
    );
  }

  if (view === 'ipo') {
    const req = ipoRequirements();
    return (
      <Sheet visible={visible} onClose={onClose} title="Launch IPO" height="90%">
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
          <IpoLaunchPanel req={req} launchStock={launchStock} toast={toast}
            onBack={() => setView('list')} onLaunched={id => { setView('list'); setSelectedId(id); }} />
        </ScrollView>
      </Sheet>
    );
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Stock Market" height="90%">
      <View style={{ flex: 1 }}>
        {insight ? (
          <Card style={{ marginBottom: 10, backgroundColor: '#0F172A', borderColor: '#1E293B' }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View>
                <Text style={[FONT.tiny, { color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1 }]}>Your Portfolio</Text>
                <Text style={[FONT.h1, { color: '#F8FAFC', marginTop: 2 }]}>{inrShort(insight.portfolioValue)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[FONT.tiny, { color: '#94A3B8' }]}>{insight.count.toLocaleString()} listed</Text>
                <Text style={[FONT.tiny, { color: insight.portfolioValue >= insight.portfolioCost ? '#4ADE80' : '#F87171', marginTop: 4, fontWeight: '800' }]}>
                  {insight.portfolioValue >= insight.portfolioCost ? '▲' : '▼'} {inrShort(Math.abs(insight.portfolioValue - insight.portfolioCost))} P&L
                </Text>
              </View>
            </Row>
            <Row style={{ marginTop: 10, gap: 8 }}>
              <Pressable style={{ flex: 1, backgroundColor: '#1E293B', borderRadius: RADIUS.md, padding: 8 }} onPress={() => setSelectedId(insight.top.id)}>
                <Text style={[FONT.tiny, { color: '#4ADE80', fontWeight: '800' }]}>▲ Top gainer</Text>
                <Text style={[FONT.tiny, { color: '#F8FAFC', marginTop: 2 }]} numberOfLines={1}>{insight.top.name}</Text>
              </Pressable>
              <Pressable style={{ flex: 1, backgroundColor: '#1E293B', borderRadius: RADIUS.md, padding: 8 }} onPress={() => setSelectedId(insight.bottom.id)}>
                <Text style={[FONT.tiny, { color: '#F87171', fontWeight: '800' }]}>▼ Top loser</Text>
                <Text style={[FONT.tiny, { color: '#F8FAFC', marginTop: 2 }]} numberOfLines={1}>{insight.bottom.name}</Text>
              </Pressable>
            </Row>
            <Btn title="Launch your own IPO" kind="soft" icon="rocket-launch-outline" small style={{ marginTop: 10 }} onPress={() => setView('ipo')} />
          </Card>
        ) : (
          <Btn title="Launch your own IPO" kind="soft" icon="rocket-launch-outline" small style={{ marginBottom: 10 }} onPress={() => setView('ipo')} />
        )}

        <TextInput value={query} onChangeText={t => { setQuery(t); setPage(1); }} placeholder="Search companies or sectors..."
          placeholderTextColor={C.faint}
          style={{ backgroundColor: C.bgSoft, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10, color: C.text }} />

        <FlatList
          data={visibleRows}
          keyExtractor={s => s.id}
          renderItem={({ item: st }) => {
            const live = isMarketOpen(now) ? liveStockPrice(st, now) : st.price;
            const ret = stockYearReturn(st);
            const pos = portfolio[st.id];
            return (
              <Pressable onPress={() => setSelectedId(st.id)}>
                <Card style={{ marginBottom: 8, padding: 10 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Row>
                        <Text style={[FONT.body, { fontWeight: '700', flexShrink: 1 }]} numberOfLines={1}>{st.name}</Text>
                        {pos ? <Icon name="briefcase-check" size={13} color={C.blue} style={{ marginLeft: 6 }} /> : null}
                      </Row>
                      <Text style={FONT.tiny}>{st.sector}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[FONT.mono, { fontWeight: '800' }]}>{inr(live)}</Text>
                      <Text style={[FONT.tiny, { fontWeight: '800', color: ret >= 0 ? C.green : C.red }]}>
                        {ret >= 0 ? '▲' : '▼'} {Math.abs(Math.round(ret * 1000) / 10)}%
                      </Text>
                    </View>
                  </Row>
                </Card>
              </Pressable>
            );
          }}
          ListFooterComponent={<LoadMore shown={visibleRows.length} total={filtered.length} onMore={() => setPage(p => p + 1)} />}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      </View>
    </Sheet>
  );
}

// ============ World Expansion (unlock countries) ============
export function CountriesModal({ visible, onClose }) {
  const toast = useToast();
  const unlocked = useGame(s => s.unlockedCountries || ['IN']);
  const balance = useGame(s => s.balance);
  const unlockCountry = useGame(s => s.unlockCountry);
  const [confirm, setConfirm] = useState(null);
  const [showAllC, setShowAllC] = useState(false);
  useEffect(() => { if (!visible) setConfirm(null); }, [visible]);

  const cityCount = useMemo(() => {
    const m = {};
    for (const c of CITIES) { const k = c.country || 'IN'; m[k] = (m[k] || 0) + 1; }
    return m;
  }, []);

  const doUnlock = (code) => {
    const r = unlockCountry(code);
    if (r.ok) { toast(`Unlocked! +${inr(r.bonusCash)} & ${r.bonusGold} Gold`, 'success'); setConfirm(null); }
    else toast(r.err, 'error');
  };

  const total = COUNTRIES.length;
  const have = unlocked.length;

  return (
    <Sheet visible={visible} onClose={onClose} title="World Expansion" height="88%">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
        <Card style={{ marginBottom: 12, backgroundColor: C.blueSoft }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row style={{ flex: 1 }}>
              <Icon name="earth" size={20} color={C.blue} />
              <Text style={[FONT.h3, { marginLeft: 6 }]}>Expand Across Two Horizons</Text>
            </Row>
            <Pill text={`${have}/${total} unlocked`} color={C.blue} bg="#fff" />
          </Row>
          <Text style={[FONT.tiny, { marginTop: 6, color: C.text }]}>
            Unlock countries from Kenya to the Philippines — 30 nations, thousands of cities. Each unlock pays a one-time welcome bonus. Cross-border hauls charge customs (extra time + fee per border) but pay big.
          </Text>
        </Card>

        {/* Unlocked + first few locked, rest behind Show More (30 countries!) */}
        {(showAllC ? COUNTRIES : COUNTRIES.filter((co, i) => unlocked.includes(co.code) || i < unlocked.length + 6)).map(co => {
          const isUnlocked = unlocked.includes(co.code);
          const afford = balance >= co.unlockCost;
          const cnt = cityCount[co.code] || 0;
          return (
            <Card key={co.code} style={{ marginBottom: 10, borderColor: isUnlocked ? C.green : C.border }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Row style={{ flex: 1 }}>
                  <View style={[cs.heroIcon, { width: 46, height: 46, backgroundColor: isUnlocked ? C.greenSoft : C.bgSoft }]}>
                    <Icon name={co.icon} size={24} color={isUnlocked ? C.green : C.sub} />
                  </View>
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Row>
                      <Text style={FONT.h3}>{co.name}</Text>
                      <View style={{ marginLeft: 6 }}>
                        {isUnlocked
                          ? <Pill text={co.code === 'IN' ? 'Home' : 'Unlocked'} icon="check-circle" color={C.green} bg={C.greenSoft} />
                          : <Pill text="Locked" icon="lock" color={C.sub} bg={C.bgSoft} />}
                      </View>
                    </Row>
                    <Text style={FONT.tiny}>{co.blurb}</Text>
                  </View>
                </Row>
              </Row>
              <Row style={{ marginTop: 10, backgroundColor: C.bgSoft, borderRadius: RADIUS.md, paddingVertical: 8 }}>
                <ContractStat icon="city-variant-outline" label="Cities" value={String(cnt)} />
                {!isUnlocked && <ContractStat icon="cash" label="Unlock cost" value={inrShort(co.unlockCost)} color={C.text} />}
                {!isUnlocked && <ContractStat icon="gift" label="Bonus" value={`${inrShort(co.bonusCash)} +${co.bonusGold}G`} color={C.green} />}
              </Row>
              {!isUnlocked && (
                <Btn
                  title={confirm === co.code ? `Confirm — pay ${inr(co.unlockCost)}` : afford ? `Unlock ${co.name}` : `Need ${inrShort(co.unlockCost)}`}
                  kind={afford ? 'green' : 'soft'} icon="lock-open-variant" small={false} disabled={!afford}
                  style={{ marginTop: 10 }}
                  onPress={() => { if (confirm === co.code) doUnlock(co.code); else setConfirm(co.code); }}
                />
              )}
            </Card>
          );
        })}
        {!showAllC && COUNTRIES.length > unlocked.length + 6 && (
          <Btn title={`Show all ${COUNTRIES.length} countries`} kind="soft" icon="chevron-down"
            onPress={() => setShowAllC(true)} style={{ marginTop: 4 }} />
        )}
        {showAllC && (
          <Btn title="Show less" kind="soft" icon="chevron-up" onPress={() => setShowAllC(false)} style={{ marginTop: 4 }} />
        )}
      </ScrollView>
    </Sheet>
  );
}

// Fires once, the moment an existing save first crosses into v4.0.0 — the
// final grand release. Pure celebration screen, no game logic.
export function FinaleModal({ visible, onClose }) {
  const company = useGame(s => s.company);
  const stats = useGame(s => s.stats);
  const trucks = useGame(s => s.trucks);
  return (
    <Sheet visible={visible} onClose={onClose} title="Grand Finale" height="70%">
      <ScrollView contentContainerStyle={{ paddingBottom: 24, alignItems: 'center' }}>
        <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: C.goldSoft || '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginTop: 8, marginBottom: 14 }}>
          <Icon name="trophy" size={44} color={C.gold} />
        </View>
        <Text style={[FONT.h1, { textAlign: 'center' }]}>Congratulations, {company?.name}!</Text>
        <Text style={[FONT.body, { textAlign: 'center', marginTop: 10, color: C.sub, lineHeight: 20 }]}>
          Truck Empire Tycoon just hit its final grand release — v4.0.0. The Stock Market is open, the roads are yours, and this
          send-off is for every kilometre you've driven to get here.
        </Text>
        <Card style={{ marginTop: 18, width: '100%', backgroundColor: '#0F172A', borderColor: '#1E293B' }}>
          <Row style={{ justifyContent: 'space-around' }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={[FONT.h2, { color: '#F8FAFC' }]}>{Math.round(stats.km).toLocaleString('en-IN')}</Text>
              <Text style={[FONT.tiny, { color: '#94A3B8' }]}>km driven</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={[FONT.h2, { color: '#F8FAFC' }]}>{trucks.length}</Text>
              <Text style={[FONT.tiny, { color: '#94A3B8' }]}>trucks strong</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={[FONT.h2, { color: '#F8FAFC' }]}>{stats.deliveries}</Text>
              <Text style={[FONT.tiny, { color: '#94A3B8' }]}>deliveries</Text>
            </View>
          </Row>
        </Card>
        <Card style={{ marginTop: 10, width: '100%', backgroundColor: C.greenSoft }}>
          <Row style={{ justifyContent: 'center' }}>
            <Icon name="gift" size={18} color={C.green} />
            <Text style={[FONT.body, { fontWeight: '800', marginLeft: 8, color: C.text }]}>+₹5 Crore + 500 Gold credited to celebrate!</Text>
          </Row>
        </Card>
        <Btn title="Onward!" kind="green" icon="rocket-launch" style={{ marginTop: 18, alignSelf: 'stretch' }} onPress={onClose} />
      </ScrollView>
    </Sheet>
  );
}

const cs = StyleSheet.create({
  section: { ...FONT.tiny, marginTop: 14, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: C.text, backgroundColor: '#fff' },
  // flexShrink: 0 — a chip must never be squeezed narrower than its label
  // (squished chips wrap their text and look bent/overlapped); rows of chips
  // either wrap (flexWrap) or scroll horizontally instead.
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: '#fff', flexShrink: 0 },
  truckCard: { width: 120, padding: 10, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.border, marginRight: 8, backgroundColor: '#fff' },
  heroIcon: { width: 64, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  badgeDot: {
    position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: 9,
    backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: C.bg,
  },
  resRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  pickerBox: { marginTop: 10, backgroundColor: C.bgSoft, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.border, padding: 10 },
  suggChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.bgSoft, alignItems: 'center' },
  notif: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: RADIUS.md, marginBottom: 6 },
  notifIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.blue },
  iconTile: { width: 52, height: 52, borderRadius: 14, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  scratchTile: { width: 78, height: 66, borderRadius: 14, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.bgSoft, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 },
  convoyCard: {
    width: 78, height: 78, borderRadius: 14, borderWidth: 1.5, borderColor: C.border,
    backgroundColor: C.bgSoft, alignItems: 'center', justifyContent: 'center',
  },
  convoyVal: { color: '#fff', fontSize: 11, fontWeight: '800', marginTop: 2 },
  convoyIntro: {
    width: 258, height: 160, borderRadius: 16, borderWidth: 1.5, borderColor: C.border,
    backgroundColor: C.bgSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
});
