// Left-side management drawer floating over the map. Groups the fleet into
// Running / Parked / Pending (building+broken), with a one-tap "Depart All"
// to dispatch every idle truck. Pill-shaped, frosted, Samsung-style.
import React, { useRef, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, FlatList, Dimensions } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Svg from 'react-native-svg';
import { C, FONT, SHADOW } from '../theme';
import { useGame, modelById, deliveryPhase, PHASE_LABELS } from '../../store/gameStore';
import { cityById } from '../../engine/routing';
import { haptic } from '../../engine/haptics';
import { play } from '../../engine/sound';
import { TruckTopShapes, truckShapes, bodyTypeFor, defaultBodyColor, sizeScaleFor } from '../truckArt';
import { useEasterEggTap } from '../components';

// Small side/3-quarter truck thumbnail for a fleet row — same renderer as the
// map/showroom (never a generic icon) so each model reads as its real shape,
// scaled up for bigger models so tonnage differences are visible at a glance.
const ROW_ICON = 46;
function RowTruckArt({ model, color }) {
  const bt = bodyTypeFor(model);
  const body = color || defaultBodyColor(model);
  const { w, h } = truckShapes(bt, body, '#9DB2D6');
  const scale = ((ROW_ICON - 6) / h) * sizeScaleFor(model);
  return (
    <View style={{ width: ROW_ICON, height: ROW_ICON, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={w * scale} height={h * scale} viewBox={`0 0 ${w} ${h}`}>
        <TruckTopShapes type={bt} body={body} accent="#9DB2D6" />
      </Svg>
    </View>
  );
}

const W = Math.min(300, Dimensions.get('window').width * 0.82);

const GROUPS = [
  { key: 'running', title: 'Running', icon: 'truck-fast', color: C.green, match: t => t.status === 'delivering' },
  { key: 'parked', title: 'Parked', icon: 'parking', color: C.blue, match: t => t.status === 'parked' },
  { key: 'pending', title: 'Pending', icon: 'progress-wrench', color: C.amber, match: t => t.status === 'building' || t.status === 'broken' },
];

// "2h 21m" / "34m" style countdown for row ETAs.
function fmtEta(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${sec}s`;
}

// Live trip strip for a running truck: origin → destination, current phase,
// progress bar, km covered and ETA — the details that used to need opening
// the truck sheet.
function TripDetails({ delivery, truck }) {
  const now = Date.now();
  const total = delivery.route.roadKm;
  const from = cityById(delivery.fromCityId), to = cityById(delivery.toCityId);
  const ph = deliveryPhase(delivery, now);
  // Phase-aware position: km stays at 0 while loading, freezes at the docks,
  // holds at 100% while unloading — no creeping while the truck is halted.
  const prog = Math.min(1, Math.max(0, ph.frac));
  const kmNow = Math.round(total * prog);
  const halted = (delivery.incident && delivery.incident.resolveAt > now);
  const phaseTxt = halted ? 'Halted — incident' : (ph.phase !== 'driving' ? PHASE_LABELS[ph.phase] : null);
  return (
    <View style={{ marginTop: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={[FONT.tiny, { fontWeight: '700', color: C.text }]} numberOfLines={1}>
          {from?.name || '?'} → {to?.name || '?'}
        </Text>
      </View>
      {phaseTxt ? (
        <Text style={[FONT.tiny, { color: halted ? C.red : C.blue, fontWeight: '700' }]} numberOfLines={1}>{phaseTxt}</Text>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
        <View style={st.condTrack}>
          <View style={[st.condFill, { width: `${Math.round(prog * 100)}%`, backgroundColor: C.green }]} />
        </View>
        <Text style={[FONT.tiny, { marginLeft: 6, width: 34, color: C.sub }]}>{Math.round(prog * 100)}%</Text>
      </View>
      <Text style={[FONT.tiny, { color: C.sub, marginTop: 2 }]} numberOfLines={1}>
        {kmNow}/{total} km · ETA {fmtEta((delivery.endsAt - now) / 1000)}
        {delivery.stops?.length ? ` · ${delivery.stops.length} fuel stop${delivery.stops.length > 1 ? 's' : ''}` : ''}
      </Text>
    </View>
  );
}

function statusLabel(t) {
  if (t.status === 'delivering') return 'On the road';
  if (t.status === 'parked') return 'Ready';
  if (t.status === 'building') return 'Building';
  if (t.status === 'broken') return 'Broken down';
  return t.status;
}

// Color-coded condition bar with a tap-to-service wrench when it's running low.
function ConditionBar({ truck, onService }) {
  const cond = Math.round(truck.condition == null ? 100 : truck.condition);
  const color = cond >= 70 ? C.green : cond >= 40 ? C.amber : C.red;
  const low = cond < 55 && truck.status !== 'delivering';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
      <View style={st.condTrack}>
        <View style={[st.condFill, { width: `${cond}%`, backgroundColor: color }]} />
      </View>
      <Text style={[FONT.tiny, { color, marginLeft: 6, width: 30 }]}>{cond}%</Text>
      {low && (
        <Pressable style={st.condBtn} onPress={onService}>
          <Icon name="wrench" size={11} color="#fff" />
        </Pressable>
      )}
    </View>
  );
}

export default function FleetSidebar({ visible, onClose, onTruckPress, onToast }) {
  const trucks = useGame(s => s.trucks);
  const deliveries = useGame(s => s.deliveries);
  const departAll = useGame(s => s.departAll);
  const serviceTruck = useGame(s => s.serviceTruck);
  const slide = useRef(new Animated.Value(-W)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);
  const [tab, setTab] = useState('running');
  const tapPatientParkerEgg = useEasterEggTap('patient_parker', 3);
  const tapFleetBossEgg = useEasterEggTap('fleet_boss', 5);

  // 1s tick while the drawer is open so live progress/ETA rows stay current.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!visible) return;
    const iv = setInterval(() => setTick(x => x + 1), 1000);
    return () => clearInterval(iv);
  }, [visible]);

  useEffect(() => {
    if (visible) setMounted(true);
    Animated.parallel([
      Animated.timing(slide, { toValue: visible ? 0 : -W, duration: 240, useNativeDriver: true }),
      Animated.timing(fade, { toValue: visible ? 1 : 0, duration: 240, useNativeDriver: true }),
    ]).start(() => { if (!visible) setMounted(false); });
  }, [visible]);

  if (!mounted) return null;

  const parkedCount = trucks.filter(t => t.status === 'parked').length;

  const doDepartAll = () => {
    haptic('medium');
    const r = departAll();
    if (r.ok) { play('start', 0.7); onToast && onToast(`Dispatched ${r.dispatched} truck${r.dispatched > 1 ? 's' : ''}`, 'success'); onClose(); }
    else onToast && onToast(r.err, 'error');
  };

  const doService = (t) => {
    haptic('medium');
    const r = serviceTruck(t.id);
    if (r.ok) { play('coin', 0.6); onToast && onToast('Truck serviced — condition restored', 'success'); }
    else onToast && onToast(r.err, 'error');
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#0B0F14', opacity: fade.interpolate({ inputRange: [0, 1], outputRange: [0, 0.35] }) }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[st.drawer, SHADOW.pop, { transform: [{ translateX: slide }] }]}>
        <View style={st.head}>
          <Pressable onPress={tapFleetBossEgg} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <Icon name="view-dashboard" size={20} color={C.blue} />
            <Text style={[FONT.h3, { marginLeft: 8 }]}>Fleet Manager</Text>
          </Pressable>
          <Pressable style={st.closeBtn} onPress={() => { haptic('light'); onClose(); }}>
            <Icon name="close" size={18} color={C.sub} />
          </Pressable>
        </View>

        <Pressable
          style={[st.departBtn, parkedCount === 0 && { opacity: 0.5 }]}
          disabled={parkedCount === 0}
          onPress={doDepartAll}>
          <Icon name="truck-fast" size={18} color="#fff" />
          <Text style={st.departTxt}>Depart All ({parkedCount})</Text>
        </Pressable>

        {/* 3 tabs — Running / Parked / Pending. A fixed equal-width row (not a
            horizontal scroller): each pill gets exactly a third of the drawer,
            with single-line labels, so nothing squishes, wraps or overlaps. */}
        <View style={st.tabBar}>
          {GROUPS.map(g => {
            const count = trucks.filter(g.match).length;
            const on = tab === g.key;
            return (
              <Pressable key={g.key} style={[st.tab, on && { backgroundColor: g.color }]}
                onPress={() => { haptic('light'); if (g.key === 'parked' && tab === 'parked') tapPatientParkerEgg(); setTab(g.key); }}>
                <Icon name={g.icon} size={14} color={on ? '#fff' : g.color} />
                <Text style={[st.tabTxt, { color: on ? '#fff' : C.sub }]} numberOfLines={1}>{g.title}</Text>
                <View style={[st.countPill, { backgroundColor: on ? 'rgba(255,255,255,0.25)' : g.color + '22' }]}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: on ? '#fff' : g.color }}>{count}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {(() => {
          const g = GROUPS.find(x => x.key === tab);
          const items = trucks.filter(g.match);
          if (items.length === 0) {
            return <Text style={[FONT.tiny, { color: C.faint, paddingVertical: 20, textAlign: 'center' }]}>No {g.title.toLowerCase()} trucks.</Text>;
          }
          // FlatList lazily renders/recycles rows instead of mounting the whole
          // fleet at once — keeps the drawer smooth once a fleet grows large.
          return (
            <FlatList
              data={items}
              keyExtractor={t => t.id}
              contentContainerStyle={{ paddingBottom: 30, paddingTop: 12 }}
              showsVerticalScrollIndicator={false}
              initialNumToRender={8}
              maxToRenderPerBatch={8}
              windowSize={7}
              removeClippedSubviews
              renderItem={({ item: t }) => {
                const model = modelById(t.modelId);
                const d = t.status === 'delivering' ? deliveries.find(x => x.truckId === t.id) : null;
                const here = cityById(t.cityId);
                const fuel = Math.round(t.fuelPct == null ? 100 : t.fuelPct);
                const buildLeft = t.status === 'building' ? Math.max(0, (t.buildEndsAt - Date.now()) / 1000) : 0;
                return (
                  <Pressable style={st.row} onPress={() => { haptic('light'); onTruckPress(t); onClose(); }}>
                    <View style={[st.rowIcon, { backgroundColor: g.color + '18' }]}>
                      <RowTruckArt model={model} color={t.color} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={[FONT.body, { fontWeight: '700' }]} numberOfLines={1}>{t.customName || model.name}</Text>
                      {d ? (
                        // Running: full live trip strip (route, phase, progress, ETA).
                        <TripDetails delivery={d} truck={t} />
                      ) : (
                        <Text style={FONT.tiny} numberOfLines={1}>
                          {statusLabel(t)}
                          {t.status === 'building' ? ` · ready in ${fmtEta(buildLeft)}` : here ? ` · ${here.name}` : ''}
                          {t.status === 'parked' ? ` · ${fuel}% fuel · ~${Math.round((fuel / 100) * model.range)} km range` : ''}
                        </Text>
                      )}
                      <ConditionBar truck={t} onService={() => doService(t)} />
                    </View>
                    <Icon name="chevron-right" size={18} color={C.faint} />
                  </Pressable>
                );
              }}
            />
          );
        })()}
      </Animated.View>
    </View>
  );
}

const st = StyleSheet.create({
  drawer: {
    position: 'absolute', top: 0, bottom: 0, left: 0, width: W,
    backgroundColor: C.bg, borderTopRightRadius: 28, borderBottomRightRadius: 28,
    paddingTop: 52, paddingHorizontal: 16,
  },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: C.bgSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  departBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.green, paddingVertical: 13, borderRadius: 26,
  },
  departTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  tabBar: { flexDirection: 'row', gap: 6, marginTop: 12 },
  tab: {
    flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 9, paddingHorizontal: 4, borderRadius: 16, backgroundColor: C.bgSoft,
  },
  tabTxt: { fontSize: 11, fontWeight: '800', flexShrink: 1 },
  grpHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  countPill: { marginLeft: 8, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, minWidth: 22, alignItems: 'center' },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 8,
    borderRadius: 18, backgroundColor: C.bgSoft, marginBottom: 6,
  },
  rowIcon: { width: ROW_ICON + 6, height: ROW_ICON + 6, borderRadius: (ROW_ICON + 6) / 2, alignItems: 'center', justifyContent: 'center' },
  condTrack: { flex: 1, height: 5, borderRadius: 3, backgroundColor: C.border, overflow: 'hidden' },
  condFill: { height: 5, borderRadius: 3 },
  condBtn: {
    marginLeft: 6, width: 20, height: 20, borderRadius: 10, backgroundColor: C.blue,
    alignItems: 'center', justifyContent: 'center',
  },
});
