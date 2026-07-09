// Left-side management drawer floating over the map. Groups the fleet into
// Running / Parked / Pending (building+broken), with a one-tap "Depart All"
// to dispatch every idle truck. Pill-shaped, frosted, Samsung-style.
import React, { useRef, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, ScrollView, FlatList, Dimensions } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Svg from 'react-native-svg';
import { C, FONT, SHADOW } from '../theme';
import { useGame, modelById } from '../../store/gameStore';
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
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <Icon name="view-dashboard" size={20} color={C.blue} />
            <Text style={[FONT.h3, { marginLeft: 8 }]}>Fleet Manager</Text>
          </View>
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

        {/* 3 tabs — Running / Parked / Pending (horizontal scroll, no overlap) */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }} contentContainerStyle={st.tabBar}>
          {GROUPS.map(g => {
            const count = trucks.filter(g.match).length;
            const on = tab === g.key;
            return (
              <Pressable key={g.key} style={[st.tab, on && { backgroundColor: g.color }]}
                onPress={() => { haptic('light'); if (g.key === 'parked' && tab === 'parked') tapPatientParkerEgg(); setTab(g.key); }}>
                <Icon name={g.icon} size={15} color={on ? '#fff' : g.color} />
                <Text style={[st.tabTxt, { color: on ? '#fff' : C.sub }]}>{g.title}</Text>
                <View style={[st.countPill, { backgroundColor: on ? 'rgba(255,255,255,0.25)' : g.color + '22' }]}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: on ? '#fff' : g.color }}>{count}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

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
                const d = deliveries.find(x => x.truckId === t.id);
                const to = d ? cityById(d.toCityId) : cityById(t.cityId);
                return (
                  <Pressable style={st.row} onPress={() => { haptic('light'); onTruckPress(t); onClose(); }}>
                    <View style={[st.rowIcon, { backgroundColor: g.color + '18' }]}>
                      <RowTruckArt model={model} color={t.color} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={[FONT.body, { fontWeight: '700' }]} numberOfLines={1}>{t.customName || model.name}</Text>
                      <Text style={FONT.tiny} numberOfLines={1}>{statusLabel(t)}{to ? ` · ${to.name}` : ''}</Text>
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
  tabBar: { flexDirection: 'row', gap: 6, marginTop: 4, paddingRight: 4 },
  tab: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 9, paddingHorizontal: 14, borderRadius: 16, backgroundColor: C.bgSoft,
  },
  tabTxt: { fontSize: 11, fontWeight: '800' },
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
