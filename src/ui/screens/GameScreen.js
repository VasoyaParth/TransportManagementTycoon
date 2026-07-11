// Main game view: header (company, clock, money), full-screen India map,
// bottom navigation into dashboard tabs, and all modal flows.
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions, AppState, Linking, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native';
import { C, FONT, RADIUS } from '../theme';
import { IconBtn, Icon, Money, Sheet, useToast, Row, useEasterEggTap } from '../components';
import MapContainer from '../MapContainer';
import { useGame, modelById, GAME_HOUR_MS } from '../../store/gameStore';
import { cityById } from '../../engine/routing';
import { FleetTab, RoutesTab, StaffTab, EconomyTab, MarketingTab, RewardsTab } from './tabs';
import {
  NewDeliveryModal, TruckDetailModal, BuyTruckModal, ContractsModal,
  PowerupsModal, NotificationsModal, SettingsModal, HubsModal, DriverDetailModal, CountriesModal, MiniGamesModal, HubInfoModal,
  CompanyInsightsModal, NewsModal, PhotoModeModal, StockMarketModal, FinaleModal,
} from './modals';
import { haptic } from '../../engine/haptics';
import { play } from '../../engine/sound';
import Tutorial from './Tutorial';
import { checkForUpdate } from '../../net/updates';

const TABS = [
  { id: 'fleet', icon: 'truck', label: 'Fleet' },
  { id: 'routes', icon: 'map-marker-path', label: 'Routes' },
  { id: 'staff', icon: 'account-group', label: 'Staff' },
  { id: 'economy', icon: 'chart-areaspline', label: 'Economy' },
  { id: 'marketing', icon: 'bullhorn', label: 'Marketing' },
  { id: 'rewards', icon: 'gift-outline', label: 'Rewards' },
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
  // The v4.0.0 Grand Finale gift (cash + gold) is granted by dailyTick,
  // which atomically flips settings.finaleSeen true in the same set() call
  // — this effect just reacts to that flip to show the celebration screen,
  // exactly once per save, ever (finaleSeen is persisted).
  const finaleSeen = useGame(s => s.settings.finaleSeen);
  const finaleShown = useRef(false);
  useEffect(() => {
    try {
      if (finaleSeen && !finaleShown.current) {
        finaleShown.current = true;
        setModal({ kind: 'finale' });
      }
    } catch (e) { /* never block the game on a celebration screen */ }
  }, [finaleSeen]);
  // Lazy modal mounting: every modal used to render (hidden) on first paint,
  // which made app start-up do the work of ten sheets. Instead a modal only
  // mounts once its kind has been opened, then stays mounted so the Sheet's
  // open/close animation keeps working on subsequent opens.
  const mountedModals = useRef(new Set());
  if (modal?.kind) mountedModals.current.add(modal.kind);
  const mounted = (kind) => mountedModals.current.has(kind);
  const [picking, setPicking] = useState(null); // {truckId, contract}
  const [focus, setFocus] = useState(null);
  const [clock, setClock] = useState({ day: 1, hour: 8 });
  const lastToastN = useRef(null);
  const tapMoneyEgg = useEasterEggTap('money_gazer', 6);
  const tapEconomyEgg = useEasterEggTap('number_cruncher', 7);
  const tapGhostEgg = useEasterEggTap('ghost_rider', 9);
  // Right-side action drawer: 2 pinned buttons + the rest folded behind a
  // toggle that expands upward smoothly. Open/closed state persists across
  // app restarts (settings.actionDrawerOpen).
  const saveSettings = useGame(s => s.saveSettings);
  const [drawerOpen, setDrawerOpen] = useState(settings.actionDrawerOpen === true);
  const drawerAnim = useRef(new Animated.Value(settings.actionDrawerOpen === true ? 1 : 0)).current;
  const toggleDrawer = () => {
    haptic('light');
    const next = !drawerOpen;
    setDrawerOpen(next);
    saveSettings({ actionDrawerOpen: next });
    Animated.timing(drawerAnim, { toValue: next ? 1 : 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  };

  // ---- Update prompt: check once on load; the download itself happens in the
  // browser (one tap on the pill), which hands the APK to Android's installer.
  const [update, setUpdate] = useState(null); // latest release when newer than installed
  const [updateDismissed, setUpdateDismissed] = useState(false);
  useEffect(() => {
    let alive = true;
    checkForUpdate().then(r => { if (alive && r.hasUpdate && r.latest) setUpdate(r.latest); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const beginUpdate = () => { if (update?.apkUrl) { haptic('light'); Linking.openURL(update.apkUrl).catch(() => {}); } };

  // ---- Game loop: 1s tick — finish builds/deliveries, day events ----
  // Fully frozen while the app is backgrounded (home button / screen off):
  // no timers burn battery, and because every delivery/build stores absolute
  // timestamps, settleOffline() catches everything up the moment you return —
  // trucks "kept driving" while the app was asleep, without the app running.
  useEffect(() => {
    let iv = null;
    const tick = () => {
      const g = useGame.getState();
      const now = Date.now();
      for (const t of g.trucks) {
        if (t.status === 'building' && t.buildEndsAt <= now) g.finishBuildIfDue(t.id);
      }
      for (const d of g.deliveries) {
        if (d.endsAt <= now) g.completeDelivery(d.id);
      }
      g.dailyTick();
      // PERF: the header only shows day + real-world minute, so only trigger a
      // React re-render when either actually changes — the whole GameScreen
      // (header, nav, overlays) used to re-render every single second.
      const gd = g.gameDay();
      const minute = Math.floor(now / 60000);
      setClock(prev => (prev.day === gd.day && prev.hour === gd.hour && prev._m === minute)
        ? prev : { ...gd, _m: minute });
    };
    const start = () => { if (!iv) { useGame.getState().settleOffline(); tick(); iv = setInterval(tick, 1000); } };
    const stop = () => { if (iv) { clearInterval(iv); iv = null; } };
    start();
    const sub = AppState.addEventListener('change', st => (st === 'active' ? start() : stop()));
    return () => { stop(); sub.remove(); };
  }, []);

  // Startup sound — plays once each time the game opens (not on every tab
  // switch or modal), picked from Settings > Sound. 'off' plays nothing.
  useEffect(() => {
    try {
      const choice = settings.startupSound || 'start';
      if (choice !== 'off') play(choice, settings.startupVolume ?? 0.7);
    } catch (e) { /* audio unavailable — never block startup on this */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  // PERF: stable handlers — inline arrows recreated every render forced the
  // map (and its WebView bridge effects) to reconcile once per second.
  const onTruckTap = useCallback((t) => setModal({ kind: 'truck', truckId: t.id }), []);
  const onHubTap = useCallback((cityId) => { haptic('light'); setModal({ kind: 'hubinfo', cityId }); }, []);

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
          onTruckTap={onTruckTap}
          onHubTap={onHubTap}
        />
        {/* Night tint overlay — follows the player's real local time */}
        {phase.tint > 0 && (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#0A1A3A', opacity: phase.tint }]} />
        )}
        {/* Single floating frosted header pill — balance/gold/time left, bell+settings right */}
        <View style={st.hdrPill}>
          <View style={{ flex: 1 }}>
            <Row style={{ alignItems: 'center' }}>
              <Pressable onPress={tapMoneyEgg}><Money value={balance} short size={19} /></Pressable>
              <Pressable onPress={() => { haptic('light'); setModal({ kind: 'powerups' }); }} style={st.goldChip}>
                <Icon name="gold" size={12} color={C.gold} />
                <Text style={[FONT.tiny, { fontWeight: '800', color: C.gold, marginLeft: 3 }]}>{gold}</Text>
              </Pressable>
            </Row>
            <Row style={{ alignItems: 'center', marginTop: 2 }}>
              <Pressable onPress={tapGhostEgg} hitSlop={6}><Icon name={phase.icon} size={10} color={phase.color} /></Pressable>
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
          {/* Pinned: news + garages */}
          <Pressable style={st.actionBtn} onPress={() => { haptic('light'); setModal({ kind: 'news' }); }}>
            <Icon name="newspaper-variant-outline" size={19} color="#C0161C" />
          </Pressable>
          <Pressable style={st.actionBtn} onPress={() => { haptic('light'); setModal({ kind: 'hubs' }); }}>
            <Icon name="garage" size={19} color={C.text} />
          </Pressable>
          {/* Folding drawer: expands smoothly above the toggle */}
          <Animated.View style={{
            overflow: 'hidden',
            height: drawerAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 4 * 48] }),
            opacity: drawerAnim,
          }}>
            <Pressable style={[st.actionBtn, { marginBottom: 8 }]} onPress={() => { haptic('light'); setModal({ kind: 'contracts' }); }}>
              <Icon name="file-document-outline" size={19} color={C.text} />
            </Pressable>
            <Pressable style={[st.actionBtn, { marginBottom: 8 }]} onPress={() => { haptic('light'); setModal({ kind: 'countries' }); }}>
              <Icon name="earth" size={19} color={C.blue} />
            </Pressable>
            <Pressable style={[st.actionBtn, { marginBottom: 8 }]} onPress={() => { haptic('light'); setModal({ kind: 'stocks' }); }}>
              <Icon name="finance" size={19} color={C.green} />
            </Pressable>
            <Pressable style={st.actionBtn} onPress={() => { haptic('light'); setModal({ kind: 'powerups' }); }}>
              <Icon name="star-four-points" size={19} color={C.gold} />
            </Pressable>
          </Animated.View>
          <Pressable style={[st.actionBtn, drawerOpen && { backgroundColor: C.blueSoft, borderColor: C.blue }]} onPress={toggleDrawer}>
            <Icon name={drawerOpen ? 'chevron-up' : 'dots-horizontal'} size={19} color={drawerOpen ? C.blue : C.text} />
          </Pressable>
        </View>
        {/* Floating company profile capsule (opens Settings → Profile) */}
        <Pressable style={st.profileCap} onPress={() => { haptic('light'); setModal({ kind: 'company' }); }}>
          <View style={st.logoCircle}><Icon name={company?.logo || 'truck'} size={16} color={C.blue} /></View>
          <View style={{ marginLeft: 7, flexShrink: 1 }}>
            <Text style={[FONT.tiny, { fontWeight: '800' }]} numberOfLines={1}>{company?.name}</Text>
            <Text style={[FONT.tiny, { color: C.sub }]} numberOfLines={1}>{hq?.name}, {hq?.state}</Text>
          </View>
        </Pressable>
        {/* Update pill under the profile: tap → APK opens in the browser. */}
        {(update && !updateDismissed) ? (
          <Pressable style={[st.updatePill, { borderColor: C.green }]} onPress={beginUpdate}>
            <Icon name="rocket-launch" size={14} color={C.green} />
            <Text style={[FONT.tiny, { fontWeight: '800', marginLeft: 5, color: C.text }]}>New {update.version} · Update</Text>
            <Pressable hitSlop={8} onPress={() => setUpdateDismissed(true)} style={{ marginLeft: 6 }}>
              <Icon name="close" size={13} color={C.faint} />
            </Pressable>
          </Pressable>
        ) : null}
        {/* Delivery action — matches the map toggle buttons (same size/style) */}
        <Pressable style={st.fab} onPress={() => { haptic('medium'); openNewDelivery(); }}>
          <Icon name="truck-plus" size={19} color={C.text} />
        </Pressable>
      </View>

      {/* ---- Bottom nav ---- */}
      <View style={st.nav}>
        {TABS.map(t => (
          <Pressable key={t.id} style={st.navItem} onPress={() => { haptic('light'); if (t.id === 'economy') tapEconomyEgg(); setTab(t.id); }}>
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
        {tab === 'staff' && <StaffTab onOpenDriver={(mem) => setModal({ kind: 'driver', staffId: mem.id })} />}
        {tab === 'economy' && <EconomyTab />}
        {tab === 'marketing' && <MarketingTab />}
        {tab === 'rewards' && <RewardsTab onOpenGames={() => { setTab(null); setModal({ kind: 'games' }); }} />}
      </Sheet>

      {/* ---- Modals (lazy — each mounts on first open, see mountedModals) ---- */}
      {mounted('delivery') && <NewDeliveryModal
        visible={modal?.kind === 'delivery'}
        onClose={() => setModal(null)}
        presetTruckId={modal?.truckId}
        presetDest={modal?.dest}
        contract={modal?.contract}
        onPickOnMap={() => { setPicking({ truckId: modal?.truckId, contract: modal?.contract }); setModal(null); }}
      />}
      {mounted('truck') && <TruckDetailModal
        visible={modal?.kind === 'truck'} onClose={() => setModal(null)} truckId={modal?.truckId}
        onNewDelivery={(tid) => openNewDelivery(tid)}
        onShowOnMap={showOnMap}
      />}
      {mounted('driver') && <DriverDetailModal
        visible={modal?.kind === 'driver'} onClose={() => setModal(null)} staffId={modal?.staffId}
        onShowOnMap={(t) => { setModal(null); setTab(null); showOnMap(t); }}
      />}
      {mounted('countries') && <CountriesModal visible={modal?.kind === 'countries'} onClose={() => setModal(null)} />}
      {mounted('games') && <MiniGamesModal visible={modal?.kind === 'games'} onClose={() => setModal(null)} />}
      {mounted('buy') && <BuyTruckModal visible={modal?.kind === 'buy'} onClose={() => setModal(null)} />}
      {mounted('contracts') && <ContractsModal visible={modal?.kind === 'contracts'} onClose={() => setModal(null)}
        onAccept={(c) => openNewDelivery(undefined, c.destCityId, c)} />}
      {mounted('powerups') && <PowerupsModal visible={modal?.kind === 'powerups'} onClose={() => setModal(null)} onOpenGames={() => setModal({ kind: 'games' })} />}
      {mounted('notifications') && <NotificationsModal visible={modal?.kind === 'notifications'} onClose={() => setModal(null)} />}
      {mounted('hubs') && <HubsModal visible={modal?.kind === 'hubs'} onClose={() => setModal(null)} onShowOnMap={(f) => { setModal(null); setFocus(f); }} />}
      {mounted('hubinfo') && <HubInfoModal
        visible={modal?.kind === 'hubinfo'} onClose={() => setModal(null)} cityId={modal?.cityId}
        onNewDelivery={(tid) => openNewDelivery(tid)}
        onOpenTruck={(tid) => setModal({ kind: 'truck', truckId: tid })}
      />}
      {mounted('settings') && <SettingsModal visible={modal?.kind === 'settings'} onClose={() => setModal(null)} initialTab={modal?.tab} />}
      {mounted('company') && <CompanyInsightsModal visible={modal?.kind === 'company'} onClose={() => setModal(null)}
        onOpenSettings={() => setModal({ kind: 'settings', tab: 'company' })}
        onOpenPhotoMode={() => setModal({ kind: 'photomode' })} />}
      {mounted('photomode') && <PhotoModeModal visible={modal?.kind === 'photomode'} onClose={() => setModal(null)} />}
      {mounted('news') && <NewsModal visible={modal?.kind === 'news'} onClose={() => setModal(null)} />}
      {mounted('stocks') && <StockMarketModal visible={modal?.kind === 'stocks'} onClose={() => setModal(null)} />}
      {mounted('finale') && <FinaleModal visible={modal?.kind === 'finale'} onClose={() => setModal(null)} />}

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
    // No border AND no Android elevation on purpose — both a solid near-white
    // border and Android's elevation shadow (rendered against this
    // translucent background) were showing up as a thin stray line across
    // the pill. iOS shadow props are harmless no-ops on Android, so iOS still
    // gets a soft shadow; Android renders perfectly flat with zero artifacts.
    shadowColor: '#0B0F14', shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 0,
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
  // Background-update pill, sits just under the profile capsule.
  updatePill: {
    position: 'absolute', top: 116, left: 12, flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)', paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 16, borderWidth: 1.5,
  },
  // Floating company profile capsule (top-left, below the header pill).
  profileCap: {
    position: 'absolute', top: 76, left: 12, maxWidth: 210, flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)', paddingLeft: 6, paddingRight: 12, paddingVertical: 5,
    borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#0B0F14', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
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
