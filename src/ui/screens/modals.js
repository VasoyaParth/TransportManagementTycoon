// Modal flows — all rendered inside the shared <Sheet>. New delivery, truck
// detail, buy truck, contracts, power-ups, notifications, settings.
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, ScrollView, FlatList, Pressable, TextInput, StyleSheet, Switch, Animated, Easing } from 'react-native';
import Svg, { Polyline, Circle, Path, G, Text as SvgText } from 'react-native-svg';
import { C, FONT, RADIUS } from '../theme';
import { Card, Btn, IconBtn, Pill, Progress, Money, Stat, Row, Icon, useToast, relTime, Sheet, statusMeta, Skeleton } from '../components';
import { useGame, modelById, cargoById, hubCostForCity, hubMaintForCity, GAME_HOUR_MS, GOLD_TO_CASH, ROULETTE_SEGMENTS, DAILY_PLAYS, SLOT_SYMBOLS } from '../../store/gameStore';
import { cityById, suggestDestinations, routeCities } from '../../engine/routing';
import { CITIES } from '../../data/cities';
import { STAFF_ROLES, STAFF_LEVELS, STAFF_AVATAR } from '../../data/staffNames';
import { TRUCK_MODELS, CARGO_TYPES, POWERUPS, CONTRACT_FLAVORS, LOGOS, AVATARS, TRUCK_COLORS, TRUCK_LOGOS } from '../../data/trucks';
import { inr, inrShort } from '../../engine/economy';
import { APP_VERSION, checkForUpdate, fmtMB, cmpVer } from '../../net/updates';
import { useDownloadState, startDownload, installDownloaded, cancelDownload } from '../../net/downloadManager';
import { COUNTRIES, COUNTRY_BY_CODE } from '../../data/expansion';
import { TruckTopShapes, truckShapes, bodyTypeFor, defaultBodyColor } from '../truckArt';

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
function buildJourney(d, model, now = Date.now()) {
  const total = d.route.roadKm;
  const dur = d.endsAt - d.startedAt;
  const prog = dur > 0 ? Math.min(1, Math.max(0, (now - d.startedAt) / dur)) : 0;
  const kmNow = total * prog;
  const speed = model.speed || 60;
  const wp = [];
  wp.push({ type: 'origin', atKm: 0, title: `Picked up · ${cityById(d.fromCityId)?.name || 'Origin'}`, sub: 'Departed origin', icon: 'package-variant-closed', color: C.green });
  try {
    for (const rc of routeCities(d.route)) {
      wp.push({ type: 'city', atKm: rc.atKm, title: rc.city.name, sub: `${rc.city.state} · on route`, icon: 'map-marker', color: C.blue });
    }
  } catch (e) { /* routing edge cases — skip cities */ }
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
  wp.push({ type: 'dest', atKm: total, title: `Deliver to ${cityById(d.toCityId)?.name || 'Destination'}`, sub: prog >= 1 ? 'Arrived' : 'Pending arrival', icon: 'map-marker-check', color: C.green });

  const waypoints = wp.filter(w => w.atKm >= 0 && w.atKm <= total).sort((a, b) => a.atKm - b.atKm);
  // Every waypoint gets a clock time — proportional along the trip's real-time
  // span, same time-compression model the progress bar already uses. Passed
  // stops show when they were actually/estimated reached; the upcoming one
  // shows its estimated arrival.
  waypoints.forEach(w => {
    w.passed = w.atKm <= kmNow + 0.5;
    w.ts = d.startedAt + (total > 0 ? (w.atKm / total) * dur : 0);
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
  const j = buildJourney(delivery, model);
  const eta = fmtDur((delivery.endsAt - Date.now()) / 1000);
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
      sub={`${w.sub || ''}${w.type !== 'origin' && w.type !== 'dest' ? ` · ${w.atKm} km` : ''} · ${w.passed ? 'Reached' : j.waypoints.indexOf(w) === j.nextIdx ? 'ETA' : '~'} ${fmtWhen(w.ts)}`.replace(/^ · /, '')}
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
      <Text style={{ fontSize: 12.5, fontWeight: '700', color: active ? '#fff' : C.sub }}>{label}</Text>
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
    return CITIES.filter(c => c.name.toLowerCase().includes(q) || c.state.toLowerCase().includes(q)).slice(0, 8);
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
              <Pressable key={c.id} onPress={() => { setDest(c.id); setQuery(c.name); }} style={cs.resRow}>
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
              {locked ? (
                <Text style={[FONT.h3, { width: 90, textAlign: 'right' }]}>{clampTons} t</Text>
              ) : (
              <Row>
                <IconBtn name="minus-circle-outline" onPress={() => setTons(Math.max(1, clampTons - 1))} />
                <Text style={[FONT.h3, { width: 60, textAlign: 'center' }]}>{clampTons} t</Text>
                <IconBtn name="plus-circle-outline" onPress={() => setTons(Math.min(maxTons, clampTons + 1))} />
              </Row>
              )}
            </Row>
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
export function TruckDetailModal({ visible, onClose, truckId, onNewDelivery, onShowOnMap }) {
  const toast = useToast();
  const trucks = useGame(s => s.trucks);
  const deliveries = useGame(s => s.deliveries);
  const repairTruck = useGame(s => s.repairTruck);
  const serviceTruck = useGame(s => s.serviceTruck);
  const callMechanic = useGame(s => s.callMechanic);
  const customizeTruck = useGame(s => s.customizeTruck);
  const sellTruck = useGame(s => s.sellTruck);
  const truckResale = useGame(s => s.truckResale);
  const [confirmSell, setConfirmSell] = useState(false);
  useEffect(() => { if (!visible) setConfirmSell(false); }, [visible]);
  const truck = trucks.find(t => t.id === truckId);
  useTick(visible && !!truck && (truck.status === 'delivering' || truck.status === 'building'));
  if (!truck) return <Sheet visible={visible} onClose={onClose} title="Truck" height="50%"><View /></Sheet>;
  const m = modelById(truck.modelId);
  const meta = statusMeta[truck.status];
  const d = deliveries.find(x => x.truckId === truck.id);
  const now = Date.now();
  const prog = d ? Math.min(100, ((now - d.startedAt) / (d.endsAt - d.startedAt)) * 100) : 0;
  const eta = d ? fmtDur((d.endsAt - now) / 1000) : null;
  // Live fuel drains from the departure tank down to the arrival fuel as it drives.
  const startFuel = d && d.startFuelPct != null ? d.startFuelPct : truck.fuelPct;
  const arriveFuel = d && d.arriveFuelPct != null ? d.arriveFuelPct : startFuel;
  const curFuel = d ? Math.max(3, Math.round(startFuel + (arriveFuel - startFuel) * (prog / 100))) : Math.round(truck.fuelPct);
  const totalKm = d ? d.route.roadKm : 0;
  const kmCovered = d ? Math.round(totalKm * (prog / 100)) : 0;
  const buildLeft = truck.status === 'building' ? Math.max(0, (truck.buildEndsAt - now) / 1000) : 0;
  const buildPct = truck.status === 'building' ? 100 * (1 - buildLeft / truck.buildTotalSec) : 0;
  const fee = Math.round(m.price * 0.04);
  const condition = Math.round(truck.condition == null ? 100 : truck.condition);
  const conditionColor = condition >= 70 ? C.green : condition >= 40 ? C.amber : C.red;
  const serviceCost = Math.round(m.price * 0.05);
  const incident = d && d.incident;
  const incidentLeft = incident ? Math.max(0, (incident.resolveAt - now) / 1000) : 0;

  const doRepair = (gold) => { const r = repairTruck(truck.id, gold); toast(r.ok ? 'Repaired!' : r.err, r.ok ? 'success' : 'error'); };
  const doService = () => { const r = serviceTruck(truck.id); toast(r.ok ? 'Serviced — condition restored!' : r.err, r.ok ? 'success' : 'error'); };
  const doCallMechanic = () => { const r = callMechanic(d.id); toast(r.ok ? 'Mechanic on the way — delay cut short.' : r.err, r.ok ? 'success' : 'error'); };

  return (
    <Sheet visible={visible} onClose={onClose} title={truck.customName || m.name} height="86%">
      <ScrollView showsVerticalScrollIndicator={false}>
        <Row style={{ marginBottom: 12 }}>
          <TruckArtBadge model={m} color={truck.color} size={60} bg={meta.bg} />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={FONT.h2}>{truck.customName || m.name}</Text>
            <Text style={FONT.sub}>{m.brand}</Text>
            <Row style={{ marginTop: 4 }}><Stars rating={m.rating} /><View style={{ marginLeft: 8 }}><Pill text={meta.label} icon={meta.icon} color={meta.color} bg={meta.bg} /></View></Row>
          </View>
        </Row>

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
            {/* Live gauges — speed varies realistically, fuel drains as it drives */}
            <Row style={{ marginTop: 10 }}>
              <Gauge value={liveSpeed(m.speed, truck.id)} max={Math.round(m.speed * 1.15)} label="Speed" unit="km/h" color={C.green} />
              <Gauge value={curFuel} max={100} label={m.propulsion === 'electric' ? 'Charge' : 'Fuel'} unit="%"
                color={curFuel > 50 ? C.green : curFuel > 20 ? C.amber : C.red} />
            </Row>
          </Card>
        )}

        {/* Amazon-style route tracker */}
        {truck.status === 'delivering' && d && (
          <Card style={{ marginBottom: 12 }}>
            <Row style={{ justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={FONT.h3}>Shipment Tracking</Text>
              <Row style={{ gap: 10 }}>
                <Row><Icon name="sleep" size={13} color={C.blue} /><Text style={[FONT.tiny, { marginLeft: 3 }]}>{d.sleepBreaks || 0} sleep</Text></Row>
                <Row><Icon name="coffee-outline" size={13} color={C.sub} /><Text style={[FONT.tiny, { marginLeft: 3 }]}>{d.shortBreaks || 0} short</Text></Row>
                <Row><Icon name="gas-station" size={13} color={C.amber} /><Text style={[FONT.tiny, { marginLeft: 3 }]}>{d.refuelCount || (d.stops || []).length || 0} fuel</Text></Row>
              </Row>
            </Row>
            <JourneyTracker delivery={d} model={m} />
          </Card>
        )}
        {truck.status === 'building' && (
          <Card style={{ marginBottom: 12 }}>
            <Row style={{ justifyContent: 'space-between' }}><Text style={FONT.h3}>Building...</Text><Text style={FONT.mono}>{fmtClock(buildLeft)}</Text></Row>
            <Progress pct={buildPct} color={C.amber} style={{ marginTop: 8 }} />
          </Card>
        )}
        {incident && (
          <Card style={{ marginBottom: 12, borderColor: incident.type === 'accident' ? C.red : '#7D3C98' }}>
            <Row>
              <Icon name={incident.type === 'accident' ? 'car-brake-alert' : 'shield-alert'} size={16}
                color={incident.type === 'accident' ? C.red : '#7D3C98'} />
              <Text style={[FONT.body, { color: incident.type === 'accident' ? C.red : '#7D3C98', marginLeft: 6, fontWeight: '700' }]}>
                {incident.type === 'accident' ? 'Accident on the road!' : 'Cargo theft in transit!'}
              </Text>
            </Row>
            <Text style={[FONT.tiny, { marginTop: 6 }]}>
              Lost {inr(incident.penalty)} already. {incident.mechanicCalled ? 'Mechanic dispatched — ' : ''}Back on the road in ~{fmtDur(incidentLeft)}.
            </Text>
            {!incident.mechanicCalled && (
              <Btn title="Call Mechanic" kind="blue" small icon="wrench" onPress={doCallMechanic} style={{ marginTop: 10 }} />
            )}
          </Card>
        )}
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
          <SpecRow icon="fuel" label={m.propulsion === 'electric' ? 'Charge now' : 'Fuel now'}
            value={`${curFuel}% · ~${Math.round((curFuel / 100) * m.range)} km left`} />
          <SpecRow icon="wrench" label="Maintenance" value={`${inr(m.maint)}/km`} />
          <SpecRow icon="cash" label="Purchase price" value={inr(m.price)} />
        </Card>

        <Card style={{ marginTop: 10 }}>
          <Text style={[FONT.h3, { marginBottom: 4 }]}>Lifetime</Text>
          <SpecRow icon="map-marker-path" label="Distance driven"
            value={`${Math.round(truck.km + kmCovered).toLocaleString()} km${d ? ` (+${kmCovered} in progress)` : ''}`} />
          <SpecRow icon="package-variant-closed-check" label="Deliveries"
            value={d ? `${truck.deliveries} (+1 in progress · ${Math.round(prog)}%)` : truck.deliveries} />
          <SpecRow icon="map-marker" label="Location" value={cityById(truck.cityId)?.name || '—'} />
        </Card>

        {/* This truck's own delivery history */}
        {(truck.log || []).length > 0 && (
          <Card style={{ marginTop: 10 }}>
            <Text style={[FONT.h3, { marginBottom: 8 }]}>Delivery History</Text>
            {(truck.log || []).slice(0, 8).map(h => {
              const f = cityById(h.fromCityId), t2 = cityById(h.toCityId);
              return (
                <Row key={h.id} style={{ justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.border }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Row><Text style={FONT.body} numberOfLines={1}>{f?.name || '?'}</Text>
                      <Icon name="arrow-right" size={12} color={C.faint} style={{ marginHorizontal: 4 }} />
                      <Text style={FONT.body} numberOfLines={1}>{t2?.name || '?'}</Text>
                    </Row>
                    <Text style={FONT.tiny}>{h.km} km · {h.hours ? `${h.hours}h · ` : ''}{relTime(h.ts)}</Text>
                  </View>
                  <Text style={[FONT.mono, { fontWeight: '700', color: h.net >= 0 ? C.green : C.red }]}>{inr(h.net)}</Text>
                </Row>
              );
            })}
          </Card>
        )}

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
        {/* Sell truck — depreciated resale value */}
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
    if (r.ok) { toast(`${m.name} ordered — building at HQ`, 'success'); }
    else toast(r.err, 'error');
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="Truck Showroom" height="86%">
      <Row style={{ gap: 6, marginBottom: 10 }}>
        {[[0, 'All'], [1, 'Starter'], [2, 'Advanced'], [3, 'Premium']].map(([t, l]) => (
          <Chip key={t} label={l} active={tier === t} onPress={() => setTier(t)} />
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
        data={list} keyExtractor={m => m.id} showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 30 }}
        renderItem={({ item: m }) => {
          const pm = propMeta[m.propulsion];
          const afford = balance >= m.price;
          return (
            <Card style={{ marginBottom: 10 }}>
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
                <Text style={[FONT.h3, { color: C.text }]}>{inr(m.price)}</Text>
                <Btn title={afford ? 'Buy' : 'Insufficient funds'} kind={afford ? 'primary' : 'soft'} small disabled={!afford} onPress={() => buy(m)} />
              </Row>
            </Card>
          );
        }}
      />
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
export function PowerupsModal({ visible, onClose, onOpenGames }) {
  const toast = useToast();
  const gold = useGame(s => s.gold);
  const trucks = useGame(s => s.trucks);
  const buyPowerup = useGame(s => s.buyPowerup);
  const convertGoldToCash = useGame(s => s.convertGoldToCash);
  const [expand, setExpand] = useState(null);
  const [xGold, setXGold] = useState(5);
  useEffect(() => { if (visible) setXGold(g => Math.min(Math.max(1, g), Math.max(1, gold))); }, [visible, gold]);
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
    <Sheet visible={visible} onClose={onClose} title="Power-Ups Store" height="86%">
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
        <Row style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
          <Row>
            <IconBtn name="minus-circle-outline" color={xClamp <= 1 ? C.faint : C.text} onPress={() => setXGold(Math.max(1, xClamp - 1))} />
            <View style={{ alignItems: 'center', width: 74 }}>
              <Row><Icon name="gold" size={15} color={C.gold} /><Text style={[FONT.h3, { color: C.gold, marginLeft: 4 }]}>{xClamp}</Text></Row>
              <Text style={FONT.tiny}>= {inr(xClamp * GOLD_TO_CASH)}</Text>
            </View>
            <IconBtn name="plus-circle-outline" color={xClamp >= gold ? C.faint : C.text} onPress={() => setXGold(Math.min(gold, xClamp + 1))} />
          </Row>
          <Btn title="Exchange" kind="green" small icon="cash-plus" disabled={gold < 1} onPress={exchange} />
        </Row>
      </Card>

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
  const games = useGame(s => s.games);
  const gamesToday = useGame(s => s.gamesToday);
  const left = gamesToday().spinLeft;
  const spin = useRef(new Animated.Value(0)).current;
  const angleRef = useRef(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);

  const W = 250, cx = W / 2, cy = W / 2, r = W / 2 - 6, n = ROULETTE_SEGMENTS.length, seg = 360 / n;

  const doSpin = () => {
    if (spinning) return;
    const res = playRoulette();
    if (!res.ok) { toast(res.err, 'warn'); return; }
    setSpinning(true); setResult(null);
    const target = 360 * 5 + (360 - (res.index * seg + seg / 2)); // land segment center at top
    const start = angleRef.current;
    const end = start + (target - (start % 360) + 360) % 360 + 360 * 5;
    Animated.timing(spin, { toValue: end, duration: 3600, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => {
      angleRef.current = end; setSpinning(false); setResult(res);
      toast(res.prize === 'nothing' ? 'No luck this time!' : `Won: ${res.label}`, res.prize === 'nothing' ? 'info' : 'success');
    });
  };
  const rotate = spin.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] });

  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={[FONT.tiny, { marginBottom: 8 }]}>{left} of {DAILY_PLAYS} free spins left today</Text>
      <View style={{ width: W, height: W }}>
        {/* pointer */}
        <View style={{ position: 'absolute', top: -2, left: cx - 8, zIndex: 2 }}>
          <Icon name="menu-down" size={30} color={C.text} />
        </View>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Svg width={W} height={W}>
            <G>
              {ROULETTE_SEGMENTS.map((sgm, i) => {
                const mid = polar(cx, cy, r * 0.62, i * seg + seg / 2);
                return (
                  <G key={i}>
                    <Path d={slicePath(cx, cy, r, i * seg, (i + 1) * seg)} fill={sgm.color} stroke="#fff" strokeWidth={2} />
                    <SvgText x={mid.x} y={mid.y} fill="#fff" fontSize="11" fontWeight="bold" textAnchor="middle">{sgm.label}</SvgText>
                  </G>
                );
              })}
              <Circle cx={cx} cy={cy} r={16} fill="#fff" stroke={C.border} strokeWidth={2} />
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

function SlotGame({ toast }) {
  const playSlot = useGame(s => s.playSlot);
  const games = useGame(s => s.games); // re-render on play
  const gamesToday = useGame(s => s.gamesToday);
  const left = gamesToday().slotLeft;
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [display, setDisplay] = useState(['help', 'help', 'help']);

  const doSpin = () => {
    if (spinning) return;
    const r = playSlot();
    if (!r.ok) { toast(r.err, 'warn'); return; }
    setSpinning(true); setResult(null);
    let ticks = 0;
    const iv = setInterval(() => {
      ticks++;
      setDisplay([0, 1, 2].map(() => SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)].icon));
      if (ticks > 8) {
        clearInterval(iv);
        setDisplay(r.reels.map(id => (SLOT_SYMBOLS.find(s => s.id === id) || {}).icon));
        setSpinning(false); setResult(r);
        toast(r.isJackpot ? 'JACKPOT!' : r.reward > 0 ? `Won +${r.reward} Gold` : 'No match — try again!', r.reward > 0 ? 'success' : 'info');
      }
    }, 90);
  };

  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={[FONT.sub, { textAlign: 'center', marginBottom: 4 }]}>Spin 3 reels — three of a kind hits the jackpot, a pair pays a little.</Text>
      <Text style={[FONT.tiny, { marginBottom: 14 }]}>{left} of {DAILY_PLAYS} free spins left today</Text>
      <Row style={{ gap: 12, marginBottom: 16 }}>
        {[0, 1, 2].map(i => (
          <View key={i} style={{
            width: 60, height: 60, borderRadius: 12, borderWidth: 2, borderColor: C.border,
            alignItems: 'center', justifyContent: 'center', backgroundColor: C.bgSoft,
          }}>
            <Icon name={display[i] || 'help'} size={30} color={spinning ? C.faint : C.text} />
          </View>
        ))}
      </Row>
      <View style={{ minHeight: 30, alignItems: 'center' }}>
        {result ? (
          <Text style={[FONT.h3, { color: result.reward > 0 ? C.green : C.sub }]}>
            {result.isJackpot ? 'JACKPOT! ' : ''}{result.reward > 0 ? `+${result.reward} Gold` : 'No match — try again!'}
          </Text>
        ) : null}
      </View>
      <Btn title={spinning ? 'Spinning…' : 'Spin the reels'} kind="green" icon="slot-machine" style={{ marginTop: 12, alignSelf: 'stretch' }}
        disabled={spinning || left <= 0} onPress={doSpin} />
      {left <= 0 ? <Text style={[FONT.tiny, { textAlign: 'center', marginTop: 6 }]}>Come back tomorrow for 10 more.</Text> : null}
    </View>
  );
}

export function MiniGamesModal({ visible, onClose }) {
  const toast = useToast();
  const gold = useGame(s => s.gold);
  const [tab, setTab] = useState('scratch');
  useEffect(() => { if (visible) setTab('scratch'); }, [visible]);
  return (
    <Sheet visible={visible} onClose={onClose} title="Free Gold Games" height="86%">
      <Card style={{ marginBottom: 12, backgroundColor: C.bgSoft }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row><Icon name="gold" size={20} color={C.gold} /><Text style={[FONT.h3, { marginLeft: 6 }]}>Your Gold</Text></Row>
          <Text style={[FONT.h2, { color: C.gold }]}>{gold}</Text>
        </Row>
      </Card>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 14 }}>
        <Row style={{ gap: 6 }}>
          <Chip label="Scratch Card" icon="ticket-confirmation" active={tab === 'scratch'} onPress={() => setTab('scratch')} />
          <Chip label="Lucky Spin" icon="rotate-right" active={tab === 'spin'} onPress={() => setTab('spin')} />
          <Chip label="Dice Roll" icon="dice-multiple" active={tab === 'dice'} onPress={() => setTab('dice')} />
          <Chip label="Slot Machine" icon="slot-machine" active={tab === 'slot'} onPress={() => setTab('slot')} />
        </Row>
      </ScrollView>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
        {tab === 'scratch' ? <ScratchGame toast={toast} /> : tab === 'spin' ? <SpinGame toast={toast} /> : tab === 'dice' ? <DiceGame toast={toast} /> : <SlotGame toast={toast} />}
      </ScrollView>
    </Sheet>
  );
}

// ============ Driver Detail ============
// Tap a driver → full A→Z picture: profile, current delivery, live route with
// where they've reached, next break, ETA and career stats.
export function DriverDetailModal({ visible, onClose, staffId, onShowOnMap }) {
  const staff = useGame(s => s.staff);
  const trucks = useGame(s => s.trucks);
  const deliveries = useGame(s => s.deliveries);
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
            <Row style={{ marginTop: 4 }}>
              <Pill text={`${level ? level.name : member.level} ${role ? role.name : member.role}`} icon={role ? role.icon : 'account'} />
            </Row>
            <Row style={{ marginTop: 6 }}>
              <Icon name="star" size={13} color={C.amber} />
              <Text style={[FONT.tiny, { marginLeft: 4 }]}>Skill {member.skill}/100 · {inrShort(member.salary)}/mo</Text>
            </Row>
          </View>
        </Row>

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
              <Text style={[FONT.h3, { marginBottom: 10 }]}>Live Route</Text>
              <JourneyTracker delivery={d} model={m} />
            </Card>
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
export function NotificationsModal({ visible, onClose }) {
  const notifications = useGame(s => s.notifications);
  const markRead = useGame(s => s.markRead);
  const markAllRead = useGame(s => s.markAllRead);
  const [filter, setFilter] = useState('all');
  const list = notifications.filter(n => filter === 'all' || (filter === 'delivery' ? n.type === 'delivery' : n.type !== 'delivery'));
  return (
    <Sheet visible={visible} onClose={onClose} title="Notifications" height="82%">
      <Row style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <Row style={{ gap: 6 }}>
          <Chip label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
          <Chip label="Deliveries" active={filter === 'delivery'} onPress={() => setFilter('delivery')} />
          <Chip label="System" active={filter === 'system'} onPress={() => setFilter('system')} />
        </Row>
        <Btn title="Mark all read" kind="ghost" small onPress={markAllRead} />
      </Row>
      <FlatList
        data={list} keyExtractor={n => n.id} showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 30 }}
        ListEmptyComponent={<View style={{ alignItems: 'center', padding: 30 }}><Icon name="bell-sleep-outline" size={30} color={C.faint} /><Text style={[FONT.sub, { marginTop: 6 }]}>Nothing yet.</Text></View>}
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

// ============ Settings ============
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
  useEffect(() => { if (visible) setTab(initialTab || 'profile'); }, [visible, initialTab]);
  const [ceo, setCeo] = useState(company?.ceo || '');
  const [avatar, setAvatar] = useState(company?.avatar);
  const [cname, setCname] = useState(company?.name || '');
  const [logo, setLogo] = useState(company?.logo);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (visible && company) { setCeo(company.ceo); setAvatar(company.avatar); setCname(company.name); setLogo(company.logo); setConfirmReset(false); }
  }, [visible]);

  const TABS = [
    ['profile', 'Profile', 'account-circle'], ['company', 'Company', 'domain'],
    ['gameplay', 'Gameplay', 'controller-classic'], ['notif', 'Alerts', 'bell-ring-outline'],
    ['about', 'About', 'information-outline'],
  ];
  const day = gameDay().day;

  return (
    <Sheet visible={visible} onClose={onClose} title="Settings" height="88%">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 12 }}>
        <Row style={{ gap: 6 }}>{TABS.map(([id, l, icon]) => <Chip key={id} label={l} icon={icon} active={tab === id} onPress={() => setTab(id)} />)}</Row>
      </ScrollView>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
        {tab === 'profile' && (
          <>
            <SectionTitle icon="account-circle" text="Your Profile" />
            <Card>
              <Text style={[FONT.tiny, { marginBottom: 4 }]}>CEO NAME</Text>
              <TextInput value={ceo} onChangeText={setCeo} maxLength={30} style={cs.input} />
              <Text style={[FONT.tiny, { marginTop: 14, marginBottom: 4 }]}>AVATAR</Text>
              <IconGrid options={AVATARS} value={avatar} onChange={setAvatar} />
            </Card>
            <SectionTitle icon="chart-box-outline" text="Lifetime Stats" />
            <Card>
              <SpecRow icon="package-variant-closed-check" label="Deliveries" value={stats.deliveries} />
              <SpecRow icon="cash-multiple" label="Revenue" value={inrShort(stats.revenue)} />
              <SpecRow icon="map-marker-distance" label="Distance" value={`${Math.round(stats.km).toLocaleString()} km`} />
              <SpecRow icon="truck" label="Trucks owned" value={trucks.length} />
              <SpecRow icon="account-group" label="Staff" value={staff.length} />
              <SpecRow icon="calendar" label="Current day" value={day} />
            </Card>
            <Btn title="Save Profile" kind="green" icon="content-save-outline" style={{ marginTop: 14 }} onPress={() => { saveCompany({ ceo, avatar }); toast('Profile saved', 'success'); }} />
          </>
        )}
        {tab === 'company' && (
          <>
            <SectionTitle icon="domain" text="Company Identity" />
            <Card>
              <Text style={[FONT.tiny, { marginBottom: 4 }]}>COMPANY NAME</Text>
              <TextInput value={cname} onChangeText={setCname} maxLength={40} style={cs.input} />
              <Text style={[FONT.tiny, { marginTop: 14, marginBottom: 4 }]}>LOGO</Text>
              <IconGrid options={LOGOS} value={logo} onChange={setLogo} />
            </Card>
            <SectionTitle icon="account-multiple-plus-outline" text="Collaboration" />
            <Card>
              <Text style={FONT.tiny}>COMPANY CODE</Text>
              <Text style={[FONT.h2, { letterSpacing: 2, marginTop: 2 }]}>{company?.code}</Text>
              <Text style={FONT.tiny}>Share this with partners to collaborate.</Text>
            </Card>
            <Btn title="Save Company" kind="green" icon="content-save-outline" style={{ marginTop: 14 }} onPress={() => { saveCompany({ name: cname, logo }); toast('Company saved', 'success'); }} />
          </>
        )}
        {tab === 'gameplay' && (
          <>
            <SectionTitle icon="controller-classic" text="Simulation" />
            <Card>
              <Text style={[FONT.tiny, { marginBottom: 6 }]}>GAME SPEED</Text>
              <Row style={{ gap: 6, flexWrap: 'wrap' }}>
                {[[0.5, 'Slow'], [1, 'Normal'], [2, 'Fast'], [4, 'Very Fast']].map(([v, l]) => (
                  <Chip key={v} label={l} active={settings.speed === v} onPress={() => saveSettings({ speed: v })} />
                ))}
              </Row>
              <Text style={[FONT.tiny, { marginTop: 14, marginBottom: 6 }]}>DIFFICULTY</Text>
              <Row style={{ gap: 6 }}>
                {['easy', 'normal', 'hard'].map(d => <Chip key={d} label={d[0].toUpperCase() + d.slice(1)} active={settings.difficulty === d} onPress={() => saveSettings({ difficulty: d })} />)}
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
              <ToggleRow label="Sound effects & music" value={settings.sound} onChange={v => saveSettings({ sound: v })} />
              <ToggleRow label="Vibration / haptics" value={settings.haptics !== false} onChange={v => saveSettings({ haptics: v })} />
              <ToggleRow label="Show fuel stations by default" value={settings.showStations} onChange={v => saveSettings({ showStations: v })} />
            </Card>
            <SectionTitle icon="alert-octagon-outline" text="Danger Zone" />
            <Card style={{ borderColor: C.red }}>
              <Text style={[FONT.sub, { marginBottom: 8 }]}>This permanently deletes your empire and all progress.</Text>
              <Btn title={confirmReset ? 'Tap again to confirm reset' : 'Reset Game Data'} kind="danger" icon="delete-forever-outline"
                onPress={() => { if (confirmReset) { resetGame(); onClose(); } else setConfirmReset(true); }} />
            </Card>
          </>
        )}
        {tab === 'notif' && (
          <>
            <SectionTitle icon="bell-ring-outline" text="Notifications" />
            <Card>
              {[['delivery', 'Delivery updates'], ['truck', 'Truck ready'], ['fuel', 'Low fuel warning'], ['collab', 'Collaboration requests'], ['daily', 'Daily summary']].map(([k, l]) => (
                <ToggleRow key={k} label={l} value={settings.notif[k]} onChange={v => saveSettings({ notif: { ...settings.notif, [k]: v } })} />
              ))}
            </Card>
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
  { icon: 'map', name: 'OpenStreetMap', role: 'Map data & tiles', by: '© OpenStreetMap contributors (ODbL)' },
  { icon: 'layers', name: 'Leaflet', role: 'Interactive map engine', by: 'Vladimir Agafonkin & contributors' },
  { icon: 'satellite-variant', name: 'Esri World Imagery', role: 'Satellite basemap', by: 'Esri, Maxar, Earthstar Geographics' },
  { icon: 'react', name: 'React Native', role: 'App framework', by: 'Meta Open Source' },
  { icon: 'vector-square', name: 'Material Community Icons', role: 'Iconography', by: 'Pictogrammers (Apache 2.0)' },
  { icon: 'road-variant', name: 'National Highways data', role: 'Route network', by: 'Compiled from public NHAI references' },
];

// The team.
const DEVELOPERS = [
  { name: 'Parth Vasoya', title: 'Lead Developer & Designer', icon: 'account-star', color: C.blue, bg: C.blueSoft },
  { name: 'Jeel Gajera', title: 'Developer', icon: 'account-tie', color: C.green, bg: C.greenSoft },
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
  // Live download state comes from the background manager (survives tab switches).
  const download = useDownloadState();

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

  const beginDownload = () => { if (latest?.apkUrl) startDownload(latest.apkUrl, latest.version); };
  const doInstall = async () => { const r = await installDownloaded(); if (!r.ok) toast(r.err || 'Could not open installer', 'error'); else toast('Opening installer…', 'info'); };
  // This tab's download UI reflects the manager only for the version we're viewing.
  const dl = (download.status !== 'idle' && (!latest || download.version === latest.version)) ? download : null;
  const pct = dl ? dl.pct : 0;

  return (
    <>
      {/* App identity */}
      <Card style={{ alignItems: 'center', padding: 22 }}>
        <View style={[cs.heroIcon, { backgroundColor: C.blueSoft }]}><Icon name="truck-fast" size={34} color={C.blue} /></View>
        <Text style={[FONT.h2, { marginTop: 10 }]}>Truck Empire Tycoon</Text>
        <Row style={{ marginTop: 6 }}>
          <Pill text={`Installed ${APP_VERSION}`} icon="cellphone-check" color={C.sub} bg={C.bgSoft} />
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

        {/* Download / install flow — backed by the background download manager,
            so progress continues if you leave this screen and resumes here. */}
        {hasUpdate && (!dl || dl.status === 'error') && (
          <Btn title={`Download & Install ${latest.version}`} kind="green" icon="download" style={{ marginTop: 12 }} onPress={beginDownload} />
        )}
        {dl && dl.status !== 'error' && (
          <View style={{ marginTop: 12 }}>
            <Progress pct={pct} color={C.green} />
            <Row style={{ justifyContent: 'space-between', marginTop: 6 }}>
              <Text style={FONT.tiny}>
                {dl.status === 'done' ? 'Downloaded — ready to install'
                  : `${fmtMB(dl.loaded)}${dl.total ? ` / ${fmtMB(dl.total)}` : ''} downloaded`}
              </Text>
              <Text style={[FONT.tiny, { fontWeight: '700', color: C.green }]}>{pct}%</Text>
            </Row>
            {dl.status === 'downloading' && <Btn title="Cancel" kind="ghost" small style={{ marginTop: 6 }} onPress={cancelDownload} />}
            {dl.status === 'done' && (
              <>
                <Btn title="Install now" kind="green" icon="cellphone-arrow-down" style={{ marginTop: 8 }} onPress={doInstall} />
                <Text style={[FONT.tiny, { marginTop: 6 }]}>
                  Tap “Install now”. If Android asks, allow “Install unknown apps” for Truck Empire, then confirm the install.
                </Text>
              </>
            )}
          </View>
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
            {state.data.releases.slice(0, 12).map((r, i) => {
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
          </Card>
        </>
      ) : null}

      {/* Developers */}
      <Text style={cs.section}>Developed By</Text>
      <Row style={{ gap: 10 }}>
        {DEVELOPERS.map(dev => (
          <Card key={dev.name} style={{ flex: 1, alignItems: 'center', padding: 16 }}>
            <View style={[cs.heroIcon, { width: 52, height: 52, backgroundColor: dev.bg }]}><Icon name={dev.icon} size={28} color={dev.color} /></View>
            <Text style={[FONT.body, { fontWeight: '800', marginTop: 8, textAlign: 'center' }]}>{dev.name}</Text>
            <Text style={[FONT.tiny, { textAlign: 'center', marginTop: 2 }]}>{dev.title}</Text>
          </Card>
        ))}
      </Row>

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
    return base.filter(c => c.name.toLowerCase().includes(q) || c.state.toLowerCase().includes(q)).slice(0, 15);
  }, [query, hubs.length]);
  const buy = (c) => { const r = buyHub(c.id); toast(r.ok ? `Garage opened in ${c.name}!` : r.err, r.ok ? 'success' : 'error'); };

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

// ============ World Expansion (unlock countries) ============
export function CountriesModal({ visible, onClose }) {
  const toast = useToast();
  const unlocked = useGame(s => s.unlockedCountries || ['IN']);
  const balance = useGame(s => s.balance);
  const unlockCountry = useGame(s => s.unlockCountry);
  const [confirm, setConfirm] = useState(null);
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
              <Text style={[FONT.h3, { marginLeft: 6 }]}>Expand Across Asia</Text>
            </Row>
            <Pill text={`${have}/${total} unlocked`} color={C.blue} bg="#fff" />
          </Row>
          <Text style={[FONT.tiny, { marginTop: 6, color: C.text }]}>
            Unlock neighbouring countries to open hundreds of new cities. Each unlock pays a one-time welcome bonus. Cross-border hauls charge customs (extra time + fee per border) but pay big.
          </Text>
        </Card>

        {COUNTRIES.map(co => {
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
      </ScrollView>
    </Sheet>
  );
}

const cs = StyleSheet.create({
  section: { ...FONT.tiny, marginTop: 14, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: C.text, backgroundColor: '#fff' },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: '#fff' },
  truckCard: { width: 120, padding: 10, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.border, marginRight: 8, backgroundColor: '#fff' },
  heroIcon: { width: 64, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  resRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  pickerBox: { marginTop: 10, backgroundColor: C.bgSoft, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.border, padding: 10 },
  suggChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.bgSoft, alignItems: 'center' },
  notif: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: RADIUS.md, marginBottom: 6 },
  notifIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.blue },
  iconTile: { width: 52, height: 52, borderRadius: 14, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  scratchTile: { width: 78, height: 66, borderRadius: 14, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.bgSoft, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 },
});
