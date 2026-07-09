// Left-side management drawer floating over the map. Groups the fleet into
// Running / Parked / Pending (building+broken), with a one-tap "Depart All"
// to dispatch every idle truck. Pill-shaped, frosted, Samsung-style.
import React, { useRef, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, ScrollView, Dimensions } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { C, FONT, SHADOW } from '../theme';
import { useGame, modelById } from '../../store/gameStore';
import { cityById } from '../../engine/routing';
import { haptic } from '../../engine/haptics';
import { play } from '../../engine/sound';

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

export default function FleetSidebar({ visible, onClose, onTruckPress, onToast }) {
  const trucks = useGame(s => s.trucks);
  const deliveries = useGame(s => s.deliveries);
  const departAll = useGame(s => s.departAll);
  const slide = useRef(new Animated.Value(-W)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);
  const [tab, setTab] = useState('running');

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

        {/* 3 tabs — Running / Parked / Pending */}
        <View style={st.tabBar}>
          {GROUPS.map(g => {
            const count = trucks.filter(g.match).length;
            const on = tab === g.key;
            return (
              <Pressable key={g.key} style={[st.tab, on && { backgroundColor: g.color }]}
                onPress={() => { haptic('light'); setTab(g.key); }}>
                <Icon name={g.icon} size={15} color={on ? '#fff' : g.color} />
                <Text style={[st.tabTxt, { color: on ? '#fff' : C.sub }]}>{g.title}</Text>
                <View style={[st.countPill, { backgroundColor: on ? 'rgba(255,255,255,0.25)' : g.color + '22' }]}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: on ? '#fff' : g.color }}>{count}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 30, paddingTop: 12 }} showsVerticalScrollIndicator={false}>
          {(() => {
            const g = GROUPS.find(x => x.key === tab);
            const items = trucks.filter(g.match);
            if (items.length === 0) {
              return <Text style={[FONT.tiny, { color: C.faint, paddingVertical: 20, textAlign: 'center' }]}>No {g.title.toLowerCase()} trucks.</Text>;
            }
            return items.map(t => {
              const model = modelById(t.modelId);
              const d = deliveries.find(x => x.truckId === t.id);
              const to = d ? cityById(d.toCityId) : cityById(t.cityId);
              return (
                <Pressable key={t.id} style={st.row} onPress={() => { haptic('light'); onTruckPress(t); onClose(); }}>
                  <View style={[st.rowIcon, { backgroundColor: g.color + '18' }]}>
                    <Icon name={model.icon} size={18} color={g.color} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[FONT.body, { fontWeight: '700' }]} numberOfLines={1}>{t.customName || model.name}</Text>
                    <Text style={FONT.tiny} numberOfLines={1}>{statusLabel(t)}{to ? ` · ${to.name}` : ''}</Text>
                  </View>
                  <Icon name="chevron-right" size={18} color={C.faint} />
                </Pressable>
              );
            });
          })()}
        </ScrollView>
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
  tabBar: { flexDirection: 'row', gap: 6, marginTop: 4 },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 9, borderRadius: 16, backgroundColor: C.bgSoft,
  },
  tabTxt: { fontSize: 11, fontWeight: '800' },
  grpHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  countPill: { marginLeft: 8, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, minWidth: 22, alignItems: 'center' },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 8,
    borderRadius: 18, backgroundColor: C.bgSoft, marginBottom: 6,
  },
  rowIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
