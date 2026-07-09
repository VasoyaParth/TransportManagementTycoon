// Main game view: header (company, clock, money), full-screen India map,
// bottom navigation into dashboard tabs, and all modal flows.
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native';
import { C, FONT, SHADOW, RADIUS } from '../theme';
import { IconBtn, Icon, Money, Sheet, useToast, Row } from '../components';
import MapContainer from '../MapContainer';
import { useGame, modelById, GAME_HOUR_MS } from '../../store/gameStore';
import { cityById } from '../../engine/routing';
import { FleetTab, RoutesTab, StaffTab, EconomyTab, MarketingTab, CollabTab } from './tabs';
import {
  NewDeliveryModal, TruckDetailModal, BuyTruckModal, ContractsModal,
  PowerupsModal, NotificationsModal, SettingsModal, HubsModal,
} from './modals';
import { haptic } from '../../engine/haptics';
import Tutorial from './Tutorial';
import FleetSidebar from './FleetSidebar';

const TABS = [
  { id: 'fleet', icon: 'truck', label: 'Fleet' },
  { id: 'routes', icon: 'map-marker-path', label: 'Routes' },
  { id: 'staff', icon: 'account-group', label: 'Staff' },
  { id: 'economy', icon: 'chart-areaspline', label: 'Economy' },
  { id: 'marketing', icon: 'bullhorn', label: 'Marketing' },
  { id: 'collab', icon: 'handshake', label: 'Partners' },
];

export default function GameScreen() {
  const toast = useToast();
  const { width } = useWindowDimensions();
  const company = useGame(s => s.company);
  const balance = useGame(s => s.balance);
  const gold = useGame(s => s.gold);
  const unread = useGame(s => s.notifications.filter(n => !n.read).length);
  const trucks = useGame(s => s.trucks);
  const deliveries = useGame(s => s.deliveries);
  const settings = useGame(s => s.settings);
  const [tab, setTab] = useState(null);
  const [modal, setModal] = useState(null); // {kind, ...props}
  const [picking, setPicking] = useState(null); // {truckId, contract}
  const [focus, setFocus] = useState(null);
  const [sidebar, setSidebar] = useState(false);
  const [clock, setClock] = useState({ day: 1, hour: 8 });
  const lastToastN = useRef(null);

  // ---- Game loop: 1s tick — finish builds/deliveries, day events ----
  useEffect(() => {
    const s = useGame.getState();
    s.settleOffline();
    const iv = setInterval(() => {
      const g = useGame.getState();
      const now = Date.now();
      for (const t of g.trucks) {
        if (t.status === 'building' && t.buildEndsAt <= now) g.finishBuildIfDue(t.id);
      }
      for (const d of g.deliveries) {
        if (d.endsAt <= now) g.completeDelivery(d.id);
      }
      g.dailyTick();
      setClock(g.gameDay());
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  // surface new notifications as toasts
  const notifications = useGame(s => s.notifications);
  useEffect(() => {
    if (!notifications.length) return;
    const top = notifications[0];
    if (lastToastN.current === null) { lastToastN.current = top.id; return; }
    if (top.id !== lastToastN.current) {
      lastToastN.current = top.id;
      toast(top.message, top.message.includes('earned') || top.message.includes('ready') ? 'success' : 'info');
    }
  }, [notifications]);

  const hq = company ? cityById(company.hqCityId) : null;

  const openNewDelivery = useCallback((truckId, dest, contract) => {
    setTab(null);
    setModal({ kind: 'delivery', truckId, dest, contract });
  }, []);

  const handleCityPick = useCallback((city) => {
    const p = picking;
    setPicking(null);
    setModal({ kind: 'delivery', truckId: p?.truckId, dest: city.id, contract: p?.contract });
  }, [picking]);

  const showOnMap = useCallback((truck) => {
    setModal(null); setTab(null);
    setFocus({ lat: truck.lat, lng: truck.lng, scale: 5, key: Date.now() });
  }, []);

  const narrow = width < 420;

  // Live real-world weekday/date/time shown under the game day (updates each 1s tick).
  const _now = new Date();
  const _days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const _mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const realClock = `${_days[_now.getDay()]}, ${_now.getDate()} ${_mon[_now.getMonth()]} · ${String(_now.getHours()).padStart(2, '0')}:${String(_now.getMinutes()).padStart(2, '0')}`;

  // Real-world time of day → day/night phase (map tint + indicator icon).
  const rh = clock ? new Date().getHours() : 12;
  const phase = rh < 6 ? { icon: 'weather-night', color: C.blue, label: 'Night', tint: 0.30 }
    : rh < 12 ? { icon: 'weather-sunset-up', color: C.amber, label: 'Morning', tint: 0 }
    : rh < 17 ? { icon: 'weather-sunny', color: C.amber, label: 'Afternoon', tint: 0 }
    : rh < 20 ? { icon: 'weather-sunset-down', color: C.amber, label: 'Evening', tint: 0.14 }
    : { icon: 'weather-night', color: C.blue, label: 'Night', tint: 0.30 };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      {/* ---- Map (full height; header floats over it as one frosted pill) ---- */}
      <View style={{ flex: 1 }}>
        <MapContainer
          pickingMode={!!picking}
          onCityPick={handleCityPick}
          onCancelPick={() => setPicking(null)}
          focus={focus}
          onTruckTap={(t) => setModal({ kind: 'truck', truckId: t.id })}
        />
        {/* Night tint overlay — follows the player's real local time */}
        {phase.tint > 0 && (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#0A1A3A', opacity: phase.tint }]} />
        )}
        {/* Single floating frosted header pill — balance/gold/time left, bell+settings right */}
        <View style={st.hdrPill}>
          <View style={{ flex: 1 }}>
            <Row style={{ alignItems: 'center' }}>
              <Money value={balance} short size={19} />
              <Pressable onPress={() => { haptic('light'); setModal({ kind: 'powerups' }); }} style={st.goldChip}>
                <Icon name="gold" size={12} color={C.gold} />
                <Text style={[FONT.tiny, { fontWeight: '800', color: C.gold, marginLeft: 3 }]}>{gold}</Text>
              </Pressable>
            </Row>
            <Row style={{ alignItems: 'center', marginTop: 2 }}>
              <Icon name={phase.icon} size={10} color={phase.color} />
              <Text style={[FONT.tiny, { fontWeight: '800', marginLeft: 3 }]}>Day {clock.day}</Text>
              <Text style={[FONT.tiny, { color: C.faint, marginHorizontal: 3 }]}>·</Text>
              <Text style={[FONT.tiny, { color: C.sub }]}>{realClock}</Text>
            </Row>
          </View>
          <IconBtn name="bell-outline" badge={unread} onPress={() => setModal({ kind: 'notifications' })} size={20} />
          <IconBtn name="cog-outline" onPress={() => setModal({ kind: 'settings' })} size={20} />
        </View>
        {/* Right-side action stack (garage / contracts / power-ups) */}
        <View style={st.actionStack}>
          <Pressable style={st.actionBtn} onPress={() => { haptic('light'); setModal({ kind: 'hubs' }); }}>
            <Icon name="garage" size={19} color={C.text} />
          </Pressable>
          <Pressable style={st.actionBtn} onPress={() => { haptic('light'); setModal({ kind: 'contracts' }); }}>
            <Icon name="file-document-outline" size={19} color={C.text} />
          </Pressable>
          <Pressable style={st.actionBtn} onPress={() => { haptic('light'); setModal({ kind: 'powerups' }); }}>
            <Icon name="star-four-points" size={19} color={C.gold} />
          </Pressable>
        </View>
        {/* Floating company profile capsule (opens Settings → Profile) */}
        <Pressable style={st.profileCap} onPress={() => { haptic('light'); setModal({ kind: 'settings', tab: 'profile' }); }}>
          <View style={st.logoCircle}><Icon name={company?.logo || 'truck'} size={16} color={C.blue} /></View>
          <View style={{ marginLeft: 7, flexShrink: 1 }}>
            <Text style={[FONT.tiny, { fontWeight: '800' }]} numberOfLines={1}>{company?.name}</Text>
            <Text style={[FONT.tiny, { color: C.sub }]} numberOfLines={1}>{hq?.name}, {hq?.state}</Text>
          </View>
        </Pressable>
        {/* Left-edge fleet-manager strip with arrow (opens sidebar) */}
        <Pressable style={[st.mgrStrip, SHADOW.pop]} onPress={() => { haptic('light'); setSidebar(true); }}>
          <Icon name="truck" size={18} color={C.blue} />
          <Icon name="chevron-right" size={18} color={C.sub} />
        </Pressable>
        {/* Delivery action — matches the map toggle buttons (same size/style) */}
        <Pressable style={st.fab} onPress={() => { haptic('medium'); openNewDelivery(); }}>
          <Icon name="truck-plus" size={19} color={C.text} />
        </Pressable>
      </View>

      {/* ---- Bottom nav ---- */}
      <View style={st.nav}>
        {TABS.map(t => (
          <Pressable key={t.id} style={st.navItem} onPress={() => { haptic('light'); setTab(t.id); }}>
            <Icon name={t.icon} size={22} color={tab === t.id ? C.blue : C.sub} />
            <Text style={[st.navTxt, tab === t.id && { color: C.blue }]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* ---- Dashboard sheet ---- */}
      <Sheet visible={!!tab} onClose={() => setTab(null)} title={TABS.find(t => t.id === tab)?.label || ''} height="78%">
        {tab === 'fleet' && <FleetTab onTruckPress={t => setModal({ kind: 'truck', truckId: t.id })} onBuyTruck={() => setModal({ kind: 'buy' })} />}
        {tab === 'routes' && <RoutesTab
          onTrack={d => { setTab(null); const t = trucks.find(x => x.id === d.truckId); if (t) showOnMap(t); }}
          onNewDelivery={() => openNewDelivery()} />}
        {tab === 'staff' && <StaffTab />}
        {tab === 'economy' && <EconomyTab />}
        {tab === 'marketing' && <MarketingTab />}
        {tab === 'collab' && <CollabTab />}
      </Sheet>

      {/* ---- Modals ---- */}
      <NewDeliveryModal
        visible={modal?.kind === 'delivery'}
        onClose={() => setModal(null)}
        presetTruckId={modal?.truckId}
        presetDest={modal?.dest}
        contract={modal?.contract}
        onPickOnMap={() => { setPicking({ truckId: modal?.truckId, contract: modal?.contract }); setModal(null); }}
      />
      <TruckDetailModal
        visible={modal?.kind === 'truck'} onClose={() => setModal(null)} truckId={modal?.truckId}
        onNewDelivery={(tid) => openNewDelivery(tid)}
        onShowOnMap={showOnMap}
      />
      <BuyTruckModal visible={modal?.kind === 'buy'} onClose={() => setModal(null)} />
      <ContractsModal visible={modal?.kind === 'contracts'} onClose={() => setModal(null)}
        onAccept={(c) => openNewDelivery(undefined, c.destCityId, c)} />
      <PowerupsModal visible={modal?.kind === 'powerups'} onClose={() => setModal(null)} />
      <NotificationsModal visible={modal?.kind === 'notifications'} onClose={() => setModal(null)} />
      <HubsModal visible={modal?.kind === 'hubs'} onClose={() => setModal(null)} onShowOnMap={(f) => { setModal(null); setFocus(f); }} />
      <SettingsModal visible={modal?.kind === 'settings'} onClose={() => setModal(null)} initialTab={modal?.tab} />

      {/* Left fleet-management drawer */}
      <FleetSidebar
        visible={sidebar}
        onClose={() => setSidebar(false)}
        onTruckPress={(t) => setModal({ kind: 'truck', truckId: t.id })}
        onToast={toast}
      />

      {/* First-time guided tour */}
      {settings.tutorialSeen !== true && (
        <Tutorial onDone={() => useGame.getState().saveSettings({ tutorialSeen: true })} />
      )}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  logoCircle: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: C.blueSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  // Single floating frosted header pill (Samsung-style glass) over the map.
  hdrPill: {
    position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', alignItems: 'center',
    paddingLeft: 14, paddingRight: 4, paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: 26,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#0B0F14', shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  // Right-side vertical action stack (garage / contracts / power-ups).
  actionStack: { position: 'absolute', top: 76, right: 12, gap: 8 },
  actionBtn: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)',
  },
  // Gold chip beside the balance.
  goldChip: {
    flexDirection: 'row', alignItems: 'center', marginLeft: 10,
    backgroundColor: C.bgSoft, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 14,
  },
  // Floating company profile capsule (top-left, below the header pill).
  profileCap: {
    position: 'absolute', top: 76, left: 12, maxWidth: 210, flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)', paddingLeft: 6, paddingRight: 12, paddingVertical: 5,
    borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#0B0F14', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  // Left-edge fleet-manager strip tab with arrow.
  mgrStrip: {
    position: 'absolute', left: 0, top: '46%', flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)', paddingLeft: 8, paddingRight: 4, paddingVertical: 12,
    borderTopRightRadius: 18, borderBottomRightRadius: 18, borderWidth: 1, borderLeftWidth: 0, borderColor: 'rgba(255,255,255,0.7)',
  },
  // Floating pill navigation (Samsung-style) — not edge-to-edge, frosted glass.
  nav: {
    position: 'absolute', left: 12, right: 12, bottom: 14, flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: 30, paddingVertical: 9, paddingHorizontal: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#0B0F14', shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 10,
  },
  navItem: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 2 },
  navTxt: { fontSize: 9.5, fontWeight: '700', color: C.sub },
  // Delivery button — identical chrome to the map toggle buttons (one right-column set).
  fab: {
    position: 'absolute', right: 14, bottom: 84, width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)', borderWidth: 1, borderColor: C.border,
  },
});
