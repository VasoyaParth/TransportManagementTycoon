// Dashboard tab panels — Fleet / Routes / Staff / Economy / Marketing.
// Each is a scrollable panel rendered inside a bottom sheet.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, FlatList, Pressable, StyleSheet, TextInput } from 'react-native';
import { C, FONT, RADIUS } from '../theme';
import {
  Card, Btn, IconBtn, Pill, statusMeta, Progress, Money, Stat, Row, Icon, useToast, relTime, GameSlider, Sheet, useEasterEggTap, smartSearch, DropdownPicker,
} from '../components';
import Svg from 'react-native-svg';
import {
  useGame, modelById, cargoById, GAME_HOUR_MS, staffMood,
  ACHIEVEMENTS, ACHIEVEMENT_TIERS, ACHIEVEMENT_TIER_GOLD, achievementValue, EASTER_EGGS,
  LOAN_PRODUCTS, creditScoreOf, DRIVER_PERKS, driverLevel, driverXpForLevel, licenseHeldBy,
  CUSTOM_LOAN_MIN, customLoanMax, customLoanTerms,
  companyXP, companyLevelOf, companyXpForLevel, companyTitleOf, WEEKLY_JACKPOT, WEEKLY_CHALLENGE_COUNT, QUEST_CHAIN,
  DAILY_JACKPOT, DAILY_CHALLENGE_COUNT,
  STREAK_REWARDS, streakRewardFor,
  pledgedTruckIds, pledgedHubCityIds, collateralTotalValue, COLLATERAL_COVERAGE, MISSED_STREAK_FOR_REPO,
  LOAN_EMI_INTERVAL_DAYS,
} from '../../store/gameStore';
import { haptic } from '../../engine/haptics';
import { CAMPAIGNS, CARGO_TYPES } from '../../data/trucks';
import { STAFF_ROLES, STAFF_LEVELS, STAFF_AVATAR } from '../../data/staffNames';
import { inr, inrShort } from '../../engine/economy';
import { cityById } from '../../engine/routing';
import { TruckTopShapes, truckShapes, bodyTypeFor, defaultBodyColor, sizeScaleFor } from '../truckArt';

// Real truck-model thumbnail for a fleet card — same renderer used on the map
// and in the Showroom, so the fleet list shows the actual model, not a
// generic glyph. Scaled per model so bigger rigs read bigger even here.
// `accent`/`logoIcon` mirror a truck's Livery customization so a repaint
// shows up here instantly, same as everywhere else that renders this art.
const FLEET_ICON = 42;
function FleetTruckArt({ model, color, accent, logoIcon, pattern, booster, rimColor }) {
  const bt = bodyTypeFor(model);
  const body = color || defaultBodyColor(model);
  const trim = accent || '#9DB2D6';
  const { w, h } = truckShapes(bt, body, trim, { pattern, booster, rimColor });
  const scale = ((FLEET_ICON - 6) / h) * sizeScaleFor(model);
  return (
    <View style={{ width: FLEET_ICON, height: FLEET_ICON, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={w * scale} height={h * scale} viewBox={`0 0 ${w} ${h}`}>
        <TruckTopShapes type={bt} body={body} accent={trim} pattern={pattern} booster={booster} rimColor={rimColor} />
      </Svg>
      {logoIcon ? (
        <View style={{
          position: 'absolute', top: -2, right: -2, width: 14, height: 14, borderRadius: 7,
          backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
          borderWidth: 1.2, borderColor: trim,
        }}>
          <Icon name={logoIcon} size={9} color={trim} />
        </View>
      ) : null}
    </View>
  );
}

// 1s ticker for live countdowns/progress
function useNow(active = true) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

const clampPct = v => Math.max(0, Math.min(100, v));
const mmss = ms => {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};
const fuelColor = pct => (pct > 50 ? C.green : pct > 20 ? C.amber : C.red);

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

// "Load more" pagination footer.
function LoadMore({ shown, total, onMore }) {
  if (shown >= total) return null;
  return (
    <Pressable onPress={onMore} style={st.loadMore}>
      <Icon name="chevron-down" size={16} color={C.blue} />
      <Text style={{ color: C.blue, fontWeight: '700', marginLeft: 4 }}>Show more ({total - shown})</Text>
    </Pressable>
  );
}

function EmptyState({ icon, title, sub, action }) {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
      <Icon name={icon} size={40} color={C.faint} />
      <Text style={[FONT.h3, { marginTop: 10 }]}>{title}</Text>
      {sub ? <Text style={[FONT.sub, { marginTop: 4, textAlign: 'center' }]}>{sub}</Text> : null}
      {action ? <View style={{ marginTop: 14 }}>{action}</View> : null}
    </Card>
  );
}

// ============================== 1. FLEET ==============================
const FLEET_PAGE = 8;
export function FleetTab({ onTruckPress, onBuyTruck, onOpenFleetLivery }) {
  const trucks = useGame(s => s.trucks);
  const deliveries = useGame(s => s.deliveries);
  const fleetCapacity = useGame(s => s.fleetCapacity);
  const cap = fleetCapacity();
  const loansForPledge = useGame(s => s.loans);
  const pledged = useMemo(() => pledgedTruckIds({ loans: loansForPledge }), [loansForPledge]);
  const hasLive = trucks.some(t => t.status === 'delivering' || t.status === 'building');
  const now = useNow(hasLive);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [query]);

  const counts = useMemo(() => {
    const c = { delivering: 0, parked: 0, building: 0, broken: 0 };
    trucks.forEach(t => { c[t.status] = (c[t.status] || 0) + 1; });
    return c;
  }, [trucks]);
  // Hero metrics: whole-fleet health at a glance.
  const fleetAvgFuel = trucks.length ? Math.round(trucks.reduce((a, t) => a + (t.fuelPct || 0), 0) / trucks.length) : 0;
  const fleetAvgCond = trucks.length ? Math.round(trucks.reduce((a, t) => a + (t.condition == null ? 100 : t.condition), 0) / trucks.length) : 0;
  const fleetKm = trucks.reduce((a, t) => a + (t.km || 0), 0);

  // Search replaces the old status filter chips — matches name/model/brand/
  // status as text, and tonnage/speed/condition%/fuel% as numbers (so "45"
  // with nothing exactly at 45t still surfaces the trucks around it).
  const filtered = useMemo(() => trucks.filter(t => {
    const model = modelById(t.modelId);
    const meta = statusMeta[t.status] || statusMeta.parked;
    const text = [t.customName, model?.name, model?.brand, meta.label].filter(Boolean).join(' ').toLowerCase();
    return smartSearch(query, text, [model?.cargo, model?.speed, t.condition, t.fuelPct]);
  }), [trucks, query]);
  const visible = filtered.slice(0, page * FLEET_PAGE);

  const renderTruck = ({ item: t }) => {
    const model = modelById(t.modelId);
    const meta = statusMeta[t.status] || statusMeta.parked;
    let livePct = null;
    let buildLeft = null;
    let curFuel = Math.round(t.fuelPct);
    if (t.status === 'delivering') {
      const d = deliveries.find(x => x.truckId === t.id);
      if (d) {
        livePct = clampPct(((now - d.startedAt) / (d.endsAt - d.startedAt)) * 100);
        const sf = d.startFuelPct != null ? d.startFuelPct : t.fuelPct;
        const af = d.arriveFuelPct != null ? d.arriveFuelPct : sf;
        curFuel = Math.max(3, Math.round(sf + (af - sf) * (livePct / 100)));
      }
    } else if (t.status === 'building' && t.buildEndsAt) {
      buildLeft = Math.max(0, Math.ceil((t.buildEndsAt - now) / 1000));
    }
    return (
      <Card style={{ marginBottom: 10 }} onPress={() => onTruckPress && onTruckPress(t)}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row style={{ flex: 1 }}>
            <View style={{ position: 'relative' }}>
              <View style={[st.iconCircle, { backgroundColor: meta.bg }]}>
                <FleetTruckArt model={model} color={t.color} accent={t.accentColor} logoIcon={t.logoIcon} pattern={t.pattern} booster={t.booster} rimColor={t.rimColor} />
              </View>
              {pledged.has(t.id) && (
                <View style={st.badgeDot}>
                  <Icon name="bank" size={10} color="#fff" />
                </View>
              )}
            </View>
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={FONT.h3} numberOfLines={1}>{model.name}</Text>
              <Text style={FONT.tiny}>{model.brand}</Text>
            </View>
          </Row>
          <Pill text={meta.label} color={meta.color} bg={meta.bg} icon={meta.icon} />
        </Row>
        <View style={{ marginTop: 12 }}>
          <Row style={{ justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={FONT.tiny}>FUEL</Text>
            <Text style={[FONT.tiny, { color: fuelColor(curFuel) }]}>{curFuel}%</Text>
          </Row>
          <Progress pct={curFuel} color={fuelColor(curFuel)} />
        </View>
        {livePct != null ? (
          <View style={{ marginTop: 10 }}>
            <Row style={{ justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={FONT.tiny}>DELIVERY PROGRESS</Text>
              <Text style={[FONT.tiny, { color: C.green }]}>{Math.round(livePct)}%</Text>
            </Row>
            <Progress pct={livePct} color={C.green} />
          </View>
        ) : null}
        {buildLeft != null ? (
          <View style={{ marginTop: 10 }}>
            <Row style={{ justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={FONT.tiny}>BUILDING</Text>
              <Text style={[FONT.tiny, { color: C.amber }]}>{buildLeft}s left</Text>
            </Row>
            <Progress
              pct={clampPct(100 - (buildLeft / (t.buildTotalSec || 1)) * 100)}
              color={C.amber}
            />
          </View>
        ) : null}
      </Card>
    );
  };

  return (
    <FlatList
      data={visible}
      keyExtractor={t => t.id}
      renderItem={renderTruck}
      contentContainerStyle={{ paddingBottom: 24 }}
      ListHeaderComponent={
        <View>
          {/* Fleet HQ hero — same dark command style as Economy/Routes/Rewards */}
          <Card style={{ marginBottom: 12, backgroundColor: '#0F172A', borderColor: '#1E293B' }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View>
                <Text style={[FONT.tiny, { color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1 }]}>Fleet Command</Text>
                <Row style={{ alignItems: 'flex-end', marginTop: 2 }}>
                  <Text style={[FONT.h1, { color: '#F8FAFC' }]}>{trucks.length}</Text>
                  <Text style={[FONT.tiny, { color: cap.used >= cap.total ? '#F87171' : '#94A3B8', marginLeft: 6, marginBottom: 5 }]}>
                    / {cap.total} capacity · {counts.delivering} earning now
                  </Text>
                </Row>
              </View>
              <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="truck" size={24} color="#5B8DF0" />
              </View>
            </Row>
            <Row style={{ marginTop: 10, backgroundColor: '#1E293B', borderRadius: RADIUS.md, paddingVertical: 8, justifyContent: 'space-around' }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={[FONT.body, { fontWeight: '800', color: fleetAvgFuel > 50 ? '#4ADE80' : '#F4D35E' }]}>{fleetAvgFuel}%</Text>
                <Text style={[FONT.tiny, { color: '#64748B' }]}>avg fuel</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={[FONT.body, { fontWeight: '800', color: fleetAvgCond > 60 ? '#4ADE80' : '#F87171' }]}>{fleetAvgCond}%</Text>
                <Text style={[FONT.tiny, { color: '#64748B' }]}>avg condition</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={[FONT.body, { fontWeight: '800', color: '#F8FAFC' }]}>{Math.round(fleetKm).toLocaleString('en-IN')}</Text>
                <Text style={[FONT.tiny, { color: '#64748B' }]}>fleet km</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={[FONT.body, { fontWeight: '800', color: counts.broken ? '#F87171' : '#4ADE80' }]}>{counts.broken || 0}</Text>
                <Text style={[FONT.tiny, { color: '#64748B' }]}>broken</Text>
              </View>
            </Row>
            <Row style={{ gap: 8, marginTop: 10 }}>
              <View style={{ flex: 1 }}><Btn title="Buy Truck" icon="plus" kind="blue" small onPress={() => onBuyTruck && onBuyTruck()} /></View>
              {trucks.length > 0 && (
                <View style={{ flex: 1 }}><Btn title="Fleet Livery" icon="palette" kind="soft" small onPress={() => onOpenFleetLivery && onOpenFleetLivery()} /></View>
              )}
            </Row>
          </Card>
          <Row style={{ marginBottom: 10, borderWidth: 1, borderColor: C.border, borderRadius: RADIUS.md, paddingHorizontal: 10 }}>
            <Icon name="magnify" size={16} color={C.faint} />
            <TextInput
              value={query} onChangeText={setQuery} placeholder="Search by name, status, tonnage, condition…" placeholderTextColor={C.faint}
              style={{ flex: 1, paddingVertical: 9, paddingHorizontal: 8, fontSize: 14, color: C.text }}
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={6}><Icon name="close-circle" size={16} color={C.faint} /></Pressable>
            )}
          </Row>
        </View>
      }
      ListFooterComponent={<LoadMore shown={visible.length} total={filtered.length} onMore={() => setPage(p => p + 1)} />}
      ListEmptyComponent={
        trucks.length === 0 ? (
          <EmptyState
            icon="truck-outline"
            title="No trucks yet"
            sub="Buy your first truck to start hauling cargo across India."
            action={<Btn title="Buy Truck" icon="plus" small onPress={() => onBuyTruck && onBuyTruck()} />}
          />
        ) : (
          <EmptyState icon="truck-outline" title="No matches" sub={`No trucks match "${query}".`} />
        )
      }
    />
  );
}

// ============================== 2. ROUTES ==============================
// v3.1.0 remaster: dark command-center hero + three views — Running (live),
// History (every past trip with driver, cargo & full expense breakdown) and
// Insights (network analytics).
const ROUTE_SORTS = [
  { key: 'eta', label: 'ETA' },
  { key: 'distance', label: 'Distance' },
  { key: 'profit', label: 'Profit' },
];

function HistoryEntry({ h, expanded, onToggle }) {
  const from = cityById(h.fromCityId), to = cityById(h.toCityId);
  const costs = (h.fuel || 0) + (h.maint || 0) + (h.tolls || 0) + (h.customs || 0);
  const hasDetail = h.fuel != null;
  return (
    <Card style={{ marginBottom: 8, padding: 12 }}>
      <Pressable onPress={() => { haptic('light'); onToggle(); }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Row>
              <Text style={FONT.body} numberOfLines={1}>{from ? from.name : '?'}</Text>
              <Icon name={h.ferry ? 'ferry' : 'arrow-right'} size={12} color={h.ferry ? C.blue : C.faint} style={{ marginHorizontal: 4 }} />
              <Text style={FONT.body} numberOfLines={1}>{to ? to.name : '?'}</Text>
            </Row>
            <Text style={FONT.tiny}>
              {h.km} km · {h.truckName || 'Truck'}{h.driver ? ` · ${h.driver}` : ''} · {relTime(h.ts)}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[FONT.mono, { fontWeight: '700', color: h.net >= 0 ? C.green : C.red }]}>{inr(h.net)}</Text>
            <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={15} color={C.faint} />
          </View>
        </Row>
      </Pressable>
      {expanded && (
        <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10 }}>
          <Row style={{ backgroundColor: C.bgSoft, borderRadius: RADIUS.md, paddingVertical: 8, marginBottom: 8, justifyContent: 'space-around' }}>
            <View style={{ alignItems: 'center' }}><Text style={[FONT.body, { fontWeight: '800' }]}>{h.cargoTons != null ? `${h.cargoTons}t` : '—'}</Text><Text style={[FONT.tiny, { fontSize: 9 }]}>{h.cargoType || 'cargo'}</Text></View>
            <View style={{ alignItems: 'center' }}><Text style={[FONT.body, { fontWeight: '800' }]}>{h.hours != null ? `${h.hours}h` : '—'}</Text><Text style={[FONT.tiny, { fontSize: 9 }]}>driving</Text></View>
            <View style={{ alignItems: 'center' }}><Text style={[FONT.body, { fontWeight: '800' }]}>{h.driver || '—'}</Text><Text style={[FONT.tiny, { fontSize: 9 }]}>driver</Text></View>
          </Row>
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
            <Text style={FONT.tiny}>Older trip — full expense breakdown is recorded for every new delivery from v3.1.0.</Text>
          )}
        </View>
      )}
    </Card>
  );
}

export function RoutesTab({ onTrack, onNewDelivery }) {
  const deliveries = useGame(s => s.deliveries);
  const history = useGame(s => s.history);
  const trucks = useGame(s => s.trucks);
  const stats = useGame(s => s.stats);
  const now = useNow(deliveries.length > 0);
  const [view, setView] = useState('running'); // running | history | insights
  const [sort, setSort] = useState('eta');
  const [histSort, setHistSort] = useState('recent');
  const [histPage, setHistPage] = useState(1);
  const [openId, setOpenId] = useState(null);

  const sortedDeliveries = useMemo(() => {
    const arr = [...deliveries];
    if (sort === 'eta') arr.sort((a, b) => a.endsAt - b.endsAt);
    else if (sort === 'distance') arr.sort((a, b) => b.route.roadKm - a.route.roadKm);
    else if (sort === 'profit') arr.sort((a, b) => b.econ.net - a.econ.net);
    return arr;
  }, [deliveries, sort]);

  const sortedHistory = useMemo(() => {
    const arr = [...history];
    if (histSort === 'recent') arr.sort((a, b) => b.ts - a.ts);
    else if (histSort === 'profit') arr.sort((a, b) => b.net - a.net);
    else if (histSort === 'distance') arr.sort((a, b) => b.km - a.km);
    return arr;
  }, [history, histSort]);

  // Network insights across recorded history.
  const insights = useMemo(() => {
    if (!history.length) return null;
    const totalNet = history.reduce((a, h) => a + h.net, 0);
    const totalKm = history.reduce((a, h) => a + h.km, 0);
    const best = [...history].sort((a, b) => b.net - a.net)[0];
    const longest = [...history].sort((a, b) => b.km - a.km)[0];
    const byDriver = new Map();
    for (const h of history) { if (h.driver) { const g = byDriver.get(h.driver) || { net: 0, trips: 0 }; g.net += h.net; g.trips++; byDriver.set(h.driver, g); } }
    const topDriver = [...byDriver.entries()].sort((a, b) => b[1].net - a[1].net)[0];
    const ferries = history.filter(h => h.ferry).length;
    return { totalNet, totalKm, best, longest, topDriver, ferries };
  }, [history]);

  const liveNet = deliveries.reduce((a, d) => a + d.econ.net, 0);
  const shownHist = sortedHistory.slice(0, histPage * 10);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
      {/* ---- Command-center hero ---- */}
      <Card style={{ marginBottom: 12, backgroundColor: '#0F172A', borderColor: '#1E293B' }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <Text style={[FONT.tiny, { color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1 }]}>Routes Command Center</Text>
            <Row style={{ alignItems: 'flex-end', marginTop: 2 }}>
              <Text style={[FONT.h1, { color: '#F8FAFC' }]}>{deliveries.length}</Text>
              <Text style={[FONT.tiny, { color: '#94A3B8', marginLeft: 6, marginBottom: 5 }]}>truck{deliveries.length === 1 ? '' : 's'} on the road</Text>
            </Row>
          </View>
          <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="routes" size={24} color="#5B8DF0" />
          </View>
        </Row>
        <Row style={{ marginTop: 10, backgroundColor: '#1E293B', borderRadius: RADIUS.md, paddingVertical: 8, justifyContent: 'space-around' }}>
          <View style={{ alignItems: 'center' }}><Text style={[FONT.body, { fontWeight: '800', color: '#4ADE80' }]}>{inrShort(liveNet)}</Text><Text style={[FONT.tiny, { color: '#64748B' }]}>incoming</Text></View>
          <View style={{ alignItems: 'center' }}><Text style={[FONT.body, { fontWeight: '800', color: '#F8FAFC' }]}>{stats.deliveries}</Text><Text style={[FONT.tiny, { color: '#64748B' }]}>lifetime trips</Text></View>
          <View style={{ alignItems: 'center' }}><Text style={[FONT.body, { fontWeight: '800', color: '#F8FAFC' }]}>{Math.round(stats.km).toLocaleString('en-IN')}</Text><Text style={[FONT.tiny, { color: '#64748B' }]}>km driven</Text></View>
        </Row>
      </Card>

      {/* ---- View switch ---- */}
      <DropdownPicker
        icon="view-list"
        options={[
          { key: 'running', label: `Running (${deliveries.length})` },
          { key: 'history', label: `History (${history.length})` },
          { key: 'insights', label: 'Insights' },
        ]}
        value={view} onChange={setView}
      />

      {view === 'running' && (
        <>
          {deliveries.length > 1 && (
            <DropdownPicker label="Sort" icon="sort" options={ROUTE_SORTS.map(o => ({ key: o.key, label: o.label }))} value={sort} onChange={setSort} />
          )}
          {deliveries.length === 0 ? (
            <EmptyState
              icon="truck-outline"
              title="No active deliveries"
              sub="Dispatch a parked truck to start earning."
              action={<Btn title="New Delivery" icon="plus" small onPress={() => onNewDelivery && onNewDelivery()} />}
            />
          ) : sortedDeliveries.map(d => {
            const truck = trucks.find(t => t.id === d.truckId);
            const model = truck ? modelById(truck.modelId) : null;
            const from = cityById(d.fromCityId);
            const to = cityById(d.toCityId);
            const pct = clampPct(((now - d.startedAt) / (d.endsAt - d.startedAt)) * 100);
            return (
              <Card key={d.id} style={{ marginBottom: 10 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={FONT.h3} numberOfLines={1}>{truck?.customName || (model ? model.name : 'Truck')}</Text>
                    <Row style={{ marginTop: 3 }}>
                      <Text style={[FONT.sub, { flexShrink: 1 }]} numberOfLines={1}>{from ? from.name : '?'}</Text>
                      <Icon name="arrow-right" size={13} color={C.faint} style={{ marginHorizontal: 5, flexShrink: 0 }} />
                      <Text style={[FONT.sub, { flexShrink: 1 }]} numberOfLines={1}>{to ? to.name : '?'}</Text>
                    </Row>
                  </View>
                  <Btn title="Track" icon="crosshairs-gps" kind="soft" small onPress={() => onTrack && onTrack(d)} />
                </Row>
                <Row style={{ justifyContent: 'space-between', marginTop: 10 }}>
                  <Row>
                    <Icon name="map-marker-distance" size={13} color={C.sub} />
                    <Text style={[FONT.tiny, { marginLeft: 4 }]}>{d.route.roadKm} km</Text>
                  </Row>
                  <Row>
                    <Icon name="timer-outline" size={13} color={C.sub} />
                    <Text style={[FONT.mono, { marginLeft: 4, fontSize: 12 }]}>{mmss(d.endsAt - now)}</Text>
                  </Row>
                  <Text style={[FONT.mono, { fontSize: 12, color: C.green, fontWeight: '700' }]}>{inr(d.econ.net)}</Text>
                </Row>
                <Progress pct={pct} color={C.green} style={{ marginTop: 8 }} />
              </Card>
            );
          })}
        </>
      )}

      {view === 'history' && (
        <>
          {history.length > 1 && (
            <DropdownPicker
              label="Sort" icon="sort"
              options={[
                { key: 'recent', label: 'Recent' },
                { key: 'profit', label: 'Profit' },
                { key: 'distance', label: 'Distance' },
              ]}
              value={histSort} onChange={setHistSort}
            />
          )}
          {history.length === 0 ? (
            <EmptyState icon="history" title="No trips yet" sub="Completed deliveries land here with the full story — driver, cargo, every rupee." />
          ) : (
            <>
              {shownHist.map(h => (
                <HistoryEntry key={h.id} h={h} expanded={openId === h.id}
                  onToggle={() => setOpenId(openId === h.id ? null : h.id)} />
              ))}
              <LoadMore shown={shownHist.length} total={sortedHistory.length} onMore={() => setHistPage(pg => pg + 1)} />
            </>
          )}
        </>
      )}

      {view === 'insights' && (
        insights ? (
          <>
            <Row style={{ marginBottom: 8 }}>
              <Stat icon="cash-check" label="History net" value={inrShort(insights.totalNet)} color={insights.totalNet >= 0 ? C.green : C.red} sub={`across last ${history.length} trips`} />
              <View style={{ width: 8 }} />
              <Stat icon="map-marker-distance" label="History km" value={`${Math.round(insights.totalKm).toLocaleString('en-IN')}`} />
            </Row>
            <SectionTitle icon="trophy-outline" text="Records" />
            <Card style={{ marginBottom: 12 }}>
              <Row style={{ justifyContent: 'space-between', paddingVertical: 7 }}>
                <Row style={{ flex: 1 }}><Icon name="cash-plus" size={17} color={C.gold} /><Text style={[FONT.body, { marginLeft: 8, flex: 1 }]}>Most profitable trip</Text></Row>
                <Text style={[FONT.tiny, { fontWeight: '700' }]}>{cityById(insights.best.toCityId)?.name} · {inrShort(insights.best.net)}</Text>
              </Row>
              <Row style={{ justifyContent: 'space-between', paddingVertical: 7, borderTopWidth: 1, borderTopColor: C.border }}>
                <Row style={{ flex: 1 }}><Icon name="highway" size={17} color={C.blue} /><Text style={[FONT.body, { marginLeft: 8, flex: 1 }]}>Longest haul</Text></Row>
                <Text style={[FONT.tiny, { fontWeight: '700' }]}>{insights.longest.km} km · {cityById(insights.longest.toCityId)?.name}</Text>
              </Row>
              {insights.topDriver ? (
                <Row style={{ justifyContent: 'space-between', paddingVertical: 7, borderTopWidth: 1, borderTopColor: C.border }}>
                  <Row style={{ flex: 1 }}><Icon name="account-star" size={17} color={C.green} /><Text style={[FONT.body, { marginLeft: 8, flex: 1 }]}>Top earning driver</Text></Row>
                  <Text style={[FONT.tiny, { fontWeight: '700' }]}>{insights.topDriver[0]} · {inrShort(insights.topDriver[1].net)} in {insights.topDriver[1].trips} trips</Text>
                </Row>
              ) : null}
              <Row style={{ justifyContent: 'space-between', paddingVertical: 7, borderTopWidth: 1, borderTopColor: C.border }}>
                <Row style={{ flex: 1 }}><Icon name="ferry" size={17} color={C.blue} /><Text style={[FONT.body, { marginLeft: 8, flex: 1 }]}>Sea crossings</Text></Row>
                <Text style={[FONT.tiny, { fontWeight: '700' }]}>{insights.ferries} of last {history.length} trips</Text>
              </Row>
            </Card>
            <Text style={[FONT.tiny, { textAlign: 'center' }]}>Insights cover the last {history.length} recorded trips.</Text>
          </>
        ) : <EmptyState icon="chart-line" title="No data yet" sub="Complete a few deliveries and the analytics light up." />
      )}
    </ScrollView>
  );
}

// ============================== 3. STAFF ==============================
function DriverStat({ icon, label, value }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Icon name={icon} size={15} color={C.sub} />
      <Text style={[FONT.body, { fontWeight: '800', marginTop: 2 }]}>{value}</Text>
      <Text style={FONT.tiny}>{label}</Text>
    </View>
  );
}

function StaffCard({ member, trucks, onAssign, onFire, onOpen, onPromote }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmFire, setConfirmFire] = useState(false);
  useEffect(() => {
    if (!confirmFire) return undefined;
    const id = setTimeout(() => setConfirmFire(false), 2500);
    return () => clearTimeout(id);
  }, [confirmFire]);

  const role = STAFF_ROLES.find(r => r.id === member.role);
  const level = STAFF_LEVELS.find(l => l.id === member.level);
  const avatar = STAFF_AVATAR[`${member.role}:${member.gender}`] || 'account';
  const assignedTruck = member.truckId ? trucks.find(t => t.id === member.truckId) : null;
  const parked = trucks.filter(t => t.status === 'parked');

  // Live in-progress trip for this driver (drives the real-time km/hours below).
  const deliveries = useGame(s => s.deliveries);
  const activeDelivery = assignedTruck ? deliveries.find(x => x.truckId === assignedTruck.id) : null;
  useNow(!!activeDelivery); // 1s ticker only while a trip is running
  const active = activeDelivery ? {
    d: activeDelivery,
    prog: Math.min(1, Math.max(0, (Date.now() - activeDelivery.startedAt) / (activeDelivery.endsAt - activeDelivery.startedAt))),
    tripHrs: activeDelivery.route.roadKm / (modelById(assignedTruck.modelId).speed || 60),
  } : null;

  return (
    <Card style={{ marginBottom: 10 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Pressable style={[{ flexDirection: 'row', alignItems: 'center', flex: 1 }]} onPress={() => onOpen && onOpen(member)}>
          <View style={[st.iconCircle, { backgroundColor: C.blueSoft }]}>
            <Icon name={avatar} size={22} color={C.blue} />
          </View>
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={FONT.h3} numberOfLines={1}>{member.name}</Text>
            {/* Wrapping pill row — uniform gap in BOTH directions so pills
                never overlap when they spill onto a second line. */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5, marginTop: 5 }}>
              <Pill
                text={`${level ? level.name : member.level} ${role ? role.name : member.role}`}
                icon={role ? role.icon : 'account'}
              />
              {/* Mood — tired after a trip, energetic when rested, busy when fixing */}
              {(() => { const mood = staffMood(member, { trucks, deliveries }); return (
                <Pill text={mood.label} icon={mood.icon} color={mood.color} bg={mood.color + '22'} />
              ); })()}
              {member.role === 'driver' ? (
                <>
                  <Pill text={`Lv ${driverLevel(member.xp)}`} icon="star" color={C.gold} bg={C.amberSoft} />
                  <Pill text={licenseHeldBy(member.xp).name} icon={licenseHeldBy(member.xp).icon} color={C.blue} bg={C.blueSoft} />
                </>
              ) : null}
              {(member.promoBoostUntil || 0) > Date.now() ? (
                <Pill text="2× promo" icon="rocket-launch" color={C.gold} bg={C.amberSoft} />
              ) : null}
            </View>
          </View>
        </Pressable>
        <IconBtn
          name="account-remove"
          color={C.red}
          onPress={() => {
            if (confirmFire) { setConfirmFire(false); onFire(member); }
            else setConfirmFire(true);
          }}
        />
      </Row>
      {confirmFire ? (
        <Text style={[FONT.tiny, { color: C.red, marginTop: 6, fontWeight: '700' }]}>Tap again to confirm</Text>
      ) : null}
      <View style={{ marginTop: 10 }}>
        <Row style={{ justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={FONT.tiny}>SKILL</Text>
          <Text style={[FONT.tiny, { color: C.blue }]}>{member.skill}/100</Text>
        </Row>
        <Progress pct={member.skill} color={C.blue} />
      </View>
      {/* Driver XP & perks (v2.4.0): level from career km, perks apply live. */}
      {member.role === 'driver' ? (() => {
        const lv = driverLevel(member.xp);
        const nextAt = driverXpForLevel(lv + 1);
        const curAt = driverXpForLevel(lv);
        const perks = DRIVER_PERKS.filter(pk => pk.level <= lv);
        return (
          <View style={{ marginTop: 10 }}>
            <Row style={{ justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={FONT.tiny}>DRIVER LEVEL {lv}{lv >= 10 ? ' — MAX' : ''}</Text>
              {lv < 10 ? <Text style={[FONT.tiny, { color: C.gold }]}>{(member.xp || 0) - curAt}/{nextAt - curAt} XP</Text> : null}
            </Row>
            <Progress pct={lv >= 10 ? 100 : (((member.xp || 0) - curAt) / (nextAt - curAt)) * 100} color={C.gold} height={4} />
            {perks.length > 0 && (
              <Row style={{ marginTop: 6, flexWrap: 'wrap', gap: 4 }}>
                {perks.map(pk => <Pill key={pk.id} text={pk.name} icon={pk.icon} color={C.blue} bg={C.blueSoft} />)}
              </Row>
            )}
          </View>
        );
      })() : null}
      {/* Manual promotion: junior → senior → expert. Salary lands in the next
          level's min–max band and the promo buzz doubles output for 3 days. */}
      {(() => {
        const ladder = ['junior', 'senior', 'expert'];
        const idx = ladder.indexOf(member.level);
        if (idx === -1 || idx >= ladder.length - 1) return null;
        const next = STAFF_LEVELS.find(l => l.id === ladder[idx + 1]);
        return (
          <Btn
            title={`Promote to ${next.name} · ${inrShort(Math.max(member.salary * 1.1, next.salary[0]))}–${inrShort(next.salary[1])}/mo`}
            kind="soft" small icon="account-arrow-up"
            style={{ marginTop: 10 }}
            onPress={() => onPromote && onPromote(member)}
          />
        );
      })()}
      {/* Driver career profile — live: the active trip is added in real time. */}
      {member.role === 'driver' && (member.deliveries || member.hoursDriven || active) ? (() => {
        const liveKm = (member.kmDriven || 0) + (active ? active.d.route.roadKm * active.prog : 0);
        const liveHrs = Math.round(((member.hoursDriven || 0) + (active ? active.tripHrs * active.prog : 0)) * 10) / 10;
        return (
          <Row style={{ marginTop: 10, backgroundColor: C.bgSoft, borderRadius: RADIUS.md, paddingVertical: 8 }}>
            <DriverStat icon="steering" label="Drive hrs" value={`${liveHrs}h`} />
            <DriverStat icon="sleep" label="Sleep hrs" value={`${member.sleepHours || 0}h`} />
            <DriverStat icon="package-variant-closed-check" label="Trips" value={String(member.deliveries || 0)} />
            <DriverStat icon="map-marker-distance" label="Distance" value={liveKm >= 1000 ? `${(liveKm / 1000).toFixed(1)}k km` : `${Math.round(liveKm)} km`} />
          </Row>
        );
      })() : null}
      <Row style={{ justifyContent: 'space-between', marginTop: 10 }}>
        <Text style={FONT.sub}>{inrShort(member.salary)}/month</Text>
        {member.role === 'driver' ? (
          <Btn
            title={assignedTruck ? modelById(assignedTruck.modelId).name : 'Assign'}
            icon={assignedTruck ? 'truck-check' : 'truck-plus-outline'}
            kind="soft" small
            onPress={() => setPickerOpen(o => !o)}
          />
        ) : null}
      </Row>
      {pickerOpen && member.role === 'driver' ? (
        <View style={st.pickerBox}>
          {parked.length === 0 ? (
            <Text style={FONT.sub}>No parked trucks available.</Text>
          ) : parked.map(t => {
            const m = modelById(t.modelId);
            return (
              <Pressable
                key={t.id}
                style={st.pickerRow}
                onPress={() => { onAssign(member, t); setPickerOpen(false); }}
              >
                <Icon name={m.icon} size={16} color={C.sub} style={{ marginRight: 8 }} />
                <Text style={[FONT.body, { flex: 1 }]}>{m.name}</Text>
                {member.truckId === t.id ? <Icon name="check" size={16} color={C.green} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </Card>
  );
}

const STAFF_PAGE = 6;
export function StaffTab({ onOpenDriver }) {
  const staff = useGame(s => s.staff);
  const candidates = useGame(s => s.candidates);
  const trucks = useGame(s => s.trucks);
  const balance = useGame(s => s.balance);
  const hire = useGame(s => s.hire);
  const fire = useGame(s => s.fire);
  const assignDriver = useGame(s => s.assignDriver);
  const refreshCandidates = useGame(s => s.refreshCandidates);
  const promoteStaff = useGame(s => s.promoteStaff);
  const toast = useToast();

  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [query]);

  const [hireQuery, setHireQuery] = useState('');
  const [hireSort, setHireSort] = useState('skill');

  // Managers are disabled for now (no gameplay use yet).
  const counts = useMemo(() => ({
    salary: staff.reduce((a, x) => a + x.salary, 0),
  }), [staff]);

  // Search replaces the old role filter chips — matches name/role/level as
  // text, and driver level/skill/salary as numbers (numeric fallback range
  // means "45" with nothing exactly at 45 skill still shows what's close).
  const roster = useMemo(() => staff.filter(x => {
    if (x.role === 'manager') return false;
    const role = STAFF_ROLES.find(r => r.id === x.role);
    const level = STAFF_LEVELS.find(l => l.id === x.level);
    const text = [x.name, role?.name, level?.name, x.role === 'driver' ? `level ${driverLevel(x.xp)}` : ''].filter(Boolean).join(' ').toLowerCase();
    return smartSearch(query, text, [x.skill, x.salary, x.role === 'driver' ? driverLevel(x.xp) : null]);
  }), [staff, query]);
  const shown = roster.slice(0, page * STAFF_PAGE);

  const filteredCandidates = useMemo(() => {
    // managers filtered out while the role is disabled
    const arr = candidates.filter(x => {
      if (x.role === 'manager') return false;
      const role = STAFF_ROLES.find(r => r.id === x.role);
      const level = STAFF_LEVELS.find(l => l.id === x.level);
      const text = [x.name, role?.name, level?.name].filter(Boolean).join(' ').toLowerCase();
      return smartSearch(hireQuery, text, [x.skill, x.salary, x.bonus]);
    });
    if (hireSort === 'skill') arr.sort((a, b) => b.skill - a.skill);
    else if (hireSort === 'salary-asc') arr.sort((a, b) => a.salary - b.salary);
    else if (hireSort === 'salary-desc') arr.sort((a, b) => b.salary - a.salary);
    else if (hireSort === 'bonus') arr.sort((a, b) => a.bonus - b.bonus);
    return arr;
  }, [candidates, hireQuery, hireSort]);

  // Two screens like Fleet -> Buy Truck: default roster ("My Staff"), and a
  // dedicated Hire screen you switch into with the header button.
  const [screen, setScreen] = useState('mine'); // 'mine' | 'hire'

  // Hero metrics: crew health at a glance.
  const avgSkill = staff.length ? Math.round(staff.reduce((a, x) => a + (x.skill || 0), 0) / staff.length) : 0;
  const bestDriver = [...staff].filter(x => x.role === 'driver').sort((a, b) => (b.xp || 0) - (a.xp || 0))[0];
  const busy = staff.filter(x => x.truckId && trucks.find(t => t.id === x.truckId && t.status === 'delivering')).length;

  if (screen === 'mine') {
    return (
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Crew HQ hero — same dark command style as the other tabs */}
        <Card style={{ marginBottom: 12, backgroundColor: '#0F172A', borderColor: '#1E293B' }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View>
              <Text style={[FONT.tiny, { color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1 }]}>Crew Command</Text>
              <Row style={{ alignItems: 'flex-end', marginTop: 2 }}>
                <Text style={[FONT.h1, { color: '#F8FAFC' }]}>{staff.length}</Text>
                <Text style={[FONT.tiny, { color: '#94A3B8', marginLeft: 6, marginBottom: 5 }]}>on payroll · {busy} out driving now</Text>
              </Row>
            </View>
            <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="account-group" size={24} color="#5B8DF0" />
            </View>
          </Row>
          <Row style={{ marginTop: 10, backgroundColor: '#1E293B', borderRadius: RADIUS.md, paddingVertical: 8, justifyContent: 'space-around' }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={[FONT.body, { fontWeight: '800', color: '#F4D35E' }]}>{inrShort(counts.salary)}</Text>
              <Text style={[FONT.tiny, { color: '#64748B' }]}>salaries / mo</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={[FONT.body, { fontWeight: '800', color: avgSkill >= 60 ? '#4ADE80' : '#F8FAFC' }]}>{avgSkill}</Text>
              <Text style={[FONT.tiny, { color: '#64748B' }]}>avg skill</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={[FONT.body, { fontWeight: '800', color: '#F8FAFC' }]} numberOfLines={1}>{bestDriver ? `${bestDriver.name.split(' ')[0]} Lv${driverLevel(bestDriver.xp)}` : '—'}</Text>
              <Text style={[FONT.tiny, { color: '#64748B' }]}>top driver</Text>
            </View>
          </Row>
          <Btn title="Hire Staff" icon="account-plus" kind="blue" small style={{ marginTop: 10 }} onPress={() => setScreen('hire')} />
        </Card>
        <Row style={{ marginBottom: 10, borderWidth: 1, borderColor: C.border, borderRadius: RADIUS.md, paddingHorizontal: 10 }}>
          <Icon name="magnify" size={16} color={C.faint} />
          <TextInput
            value={query} onChangeText={setQuery} placeholder="Search by name, role, level, skill…" placeholderTextColor={C.faint}
            style={{ flex: 1, paddingVertical: 9, paddingHorizontal: 8, fontSize: 14, color: C.text }}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={6}><Icon name="close-circle" size={16} color={C.faint} /></Pressable>
          )}
        </Row>
        {staff.length === 0 ? (
          <EmptyState icon="account-group-outline" title="No staff yet" sub="Hire drivers and mechanics to grow your team."
            action={<Btn title="Hire Staff" icon="account-plus" small onPress={() => setScreen('hire')} />} />
        ) : roster.length === 0 ? (
          <EmptyState icon="account-search-outline" title="No matches" sub={`No staff match "${query}".`} />
        ) : (
          <>
            {shown.map(m => (
              <StaffCard
                key={m.id}
                member={m}
                trucks={trucks}
                onAssign={(mem, t) => { assignDriver(mem.id, t.id); toast && toast(`${mem.name} assigned to ${modelById(t.modelId).name}`, 'success'); }}
                onFire={mem => { fire(mem.id); toast && toast(`${mem.name} has been let go`, 'warn'); }}
                onOpen={mem => onOpenDriver && onOpenDriver(mem)}
                onPromote={mem => {
                  const r = promoteStaff(mem.id);
                  toast && toast(r.ok
                    ? `${mem.name} is now ${r.level} — ${inrShort(r.newSalary)}/mo, skill ${r.newSkill}, 2× boost for 3 days!`
                    : r.err, r.ok ? 'success' : 'error');
                }}
              />
            ))}
            <LoadMore shown={shown.length} total={roster.length} onMore={() => setPage(p => p + 1)} />
          </>
        )}
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
      <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <Row>
          <IconBtn name="arrow-left" onPress={() => setScreen('mine')} />
          <Text style={[FONT.h2, { marginLeft: 6 }]}>Hire Staff</Text>
        </Row>
        <IconBtn name="refresh" onPress={() => { refreshCandidates(); toast && toast('New candidates available', 'info'); }} />
      </Row>
      <Row style={{ marginBottom: 10, borderWidth: 1, borderColor: C.border, borderRadius: RADIUS.md, paddingHorizontal: 10 }}>
        <Icon name="magnify" size={16} color={C.faint} />
        <TextInput
          value={hireQuery} onChangeText={setHireQuery} placeholder="Search by name, role, level, skill, salary…" placeholderTextColor={C.faint}
          style={{ flex: 1, paddingVertical: 9, paddingHorizontal: 8, fontSize: 14, color: C.text }}
        />
        {hireQuery.length > 0 && (
          <Pressable onPress={() => setHireQuery('')} hitSlop={6}><Icon name="close-circle" size={16} color={C.faint} /></Pressable>
        )}
      </Row>
      <DropdownPicker
        label="Sort" icon="sort"
        options={[
          { key: 'skill', label: 'Skill' },
          { key: 'salary-asc', label: 'Salary Low-High' },
          { key: 'salary-desc', label: 'Salary High-Low' },
          { key: 'bonus', label: 'Signing Bonus' },
        ]}
        value={hireSort} onChange={setHireSort}
      />
      {candidates.length > 0 && filteredCandidates.length === 0 ? (
        <EmptyState icon="account-search-outline" title="No matches" sub={`No candidates match "${hireQuery}".`} />
      ) : filteredCandidates.map(c => {
        const role = STAFF_ROLES.find(r => r.id === c.role);
        const level = STAFF_LEVELS.find(l => l.id === c.level);
        const cannot = balance < c.bonus;
        return (
          <Card key={c.id} style={{ marginBottom: 8, padding: 12 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row style={{ flex: 1 }}>
                <Icon name={STAFF_AVATAR[`${c.role}:${c.gender}`] || 'account'} size={20} color={C.sub} />
                <View style={{ marginLeft: 8, flex: 1 }}>
                  <Text style={FONT.body} numberOfLines={1}>{c.name}</Text>
                  <Text style={FONT.tiny}>
                    {(level ? level.name : c.level)} {(role ? role.name : c.role)} · Skill {c.skill} · {inrShort(c.salary)}/mo
                  </Text>
                  <Text style={FONT.tiny}>Signing bonus {inrShort(c.bonus)}</Text>
                </View>
              </Row>
              <Btn
                title={cannot ? 'Low funds' : 'Hire'}
                kind="green" small disabled={cannot}
                onPress={() => {
                  const r = hire(c.id);
                  toast && toast(r.ok ? `${c.name} hired!` : r.err, r.ok ? 'success' : 'error');
                }}
              />
            </Row>
          </Card>
        );
      })}
    </ScrollView>
  );
}

// ============================== 4. ECONOMY ==============================
// Full redesign (v2.3.0): profit & loss hero, income/expense split fed by the
// company ledger, deeper insights (cost/km, avg profit, fleet utilisation,
// top routes) and a premium day-wise Ledger book behind one button.

function InsightRow({ icon, label, value, color = C.text, sub, divider }) {
  return (
    <View style={[{ paddingVertical: 9 }, divider && st.divider]}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row style={{ flex: 1 }}>
          <Icon name={icon} size={17} color={C.sub} />
          <View style={{ marginLeft: 9, flex: 1 }}>
            <Text style={[FONT.body, { fontWeight: '600' }]}>{label}</Text>
            {sub ? <Text style={FONT.tiny}>{sub}</Text> : null}
          </View>
        </Row>
        <Text style={[FONT.mono, { fontWeight: '800', color }]}>{value}</Text>
      </Row>
    </View>
  );
}

// Premium day-wise ledger book — every rupee in/out, grouped per game day
// with a daily net subtotal, newest day first.
const LEDGER_PAGE = 5; // days shown per "Show more" tap
function LedgerSheet({ visible, onClose }) {
  const ledger = useGame(s => s.ledger || []);
  const tapLedgerEgg = useEasterEggTap('ledger_lord', 12);
  const [page, setPage] = useState(1);
  // Days start CLOSED — tap a day's header to expand and see its entries.
  // Keeps the initial render light even with months of history, and lets
  // you scan day-by-day totals at a glance before drilling into any one.
  const [expanded, setExpanded] = useState(() => new Set());
  useEffect(() => { if (visible) { setPage(1); setExpanded(new Set()); } }, [visible]);
  const groups = useMemo(() => {
    const m = new Map();
    for (const e of ledger) {
      if (!m.has(e.day)) m.set(e.day, { day: e.day, entries: [], net: 0, income: 0, expense: 0 });
      const g = m.get(e.day);
      g.entries.push(e); g.net += e.amount;
      if (e.amount >= 0) g.income += e.amount; else g.expense += -e.amount;
    }
    return [...m.values()].sort((a, b) => b.day - a.day);
  }, [ledger]);
  const shownGroups = groups.slice(0, page * LEDGER_PAGE);
  const toggleDay = day => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(day)) next.delete(day); else next.add(day);
    return next;
  });

  return (
    <Sheet visible={visible} onClose={onClose} title="Company Ledger" height="88%">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
        <Card style={{ marginBottom: 12, backgroundColor: '#0F172A', borderColor: '#1E293B' }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row>
              <Pressable onPress={tapLedgerEgg}>
                <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="notebook-outline" size={22} color={C.gold} />
                </View>
              </Pressable>
              <View style={{ marginLeft: 10 }}>
                <Text style={[FONT.h3, { color: '#F8FAFC' }]}>The Books</Text>
                <Text style={[FONT.tiny, { color: '#94A3B8' }]}>Every rupee, day by day · last {ledger.length} entries</Text>
              </View>
            </Row>
            <Icon name="check-decagram" size={18} color={C.gold} />
          </Row>
        </Card>
        {groups.length === 0 ? (
          <EmptyState icon="notebook-outline" title="No entries yet" sub="Deliveries, salaries and every purchase will be booked here automatically." />
        ) : shownGroups.map(g => {
          const open = expanded.has(g.day);
          return (
            <View key={g.day} style={{ marginBottom: 10 }}>
              <Pressable onPress={() => toggleDay(g.day)}>
                <Card style={{ padding: 0, overflow: 'hidden' }}>
                  <Row style={{ justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 12 }}>
                    <Row>
                      <Icon name={open ? 'chevron-down' : 'chevron-right'} size={16} color={C.sub} />
                      <Icon name="calendar" size={14} color={C.sub} style={{ marginLeft: 6 }} />
                      <Text style={[FONT.body, { fontWeight: '800', marginLeft: 5 }]}>Day {g.day}</Text>
                      <Text style={[FONT.tiny, { marginLeft: 8, color: C.faint }]}>{g.entries.length} entr{g.entries.length === 1 ? 'y' : 'ies'}</Text>
                    </Row>
                    <Text style={[FONT.mono, { fontWeight: '800', color: g.net >= 0 ? C.green : C.red }]}>
                      {g.net >= 0 ? '+' : '−'}{inrShort(Math.abs(g.net))}
                    </Text>
                  </Row>
                  {open ? (
                    <>
                      {g.entries.map((e, i) => (
                        <Row key={e.id} style={[{ paddingVertical: 10, paddingHorizontal: 12, justifyContent: 'space-between' }, st.divider]}>
                          <Row style={{ flex: 1, marginRight: 8 }}>
                            <View style={{
                              width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
                              backgroundColor: e.amount >= 0 ? C.greenSoft : C.redSoft,
                            }}>
                              <Icon name={e.icon || 'cash'} size={15} color={e.amount >= 0 ? C.green : C.red} />
                            </View>
                            <View style={{ marginLeft: 9, flex: 1 }}>
                              <Text style={FONT.body} numberOfLines={1}>{e.label}</Text>
                              <Text style={FONT.tiny}>{relTime(e.ts)}</Text>
                            </View>
                          </Row>
                          <Text style={[FONT.mono, { fontWeight: '700', color: e.amount >= 0 ? C.green : C.red }]}>
                            {e.amount >= 0 ? '+' : '−'}{inrShort(Math.abs(e.amount))}
                          </Text>
                        </Row>
                      ))}
                      <Row style={[st.divider, { paddingVertical: 8, paddingHorizontal: 12, justifyContent: 'space-between', backgroundColor: C.bgSoft }]}>
                        <Text style={[FONT.tiny, { fontWeight: '800' }]}>IN {inrShort(g.income)} · OUT {inrShort(g.expense)}</Text>
                        <Text style={[FONT.tiny, { fontWeight: '800', color: g.net >= 0 ? C.green : C.red }]}>NET {g.net >= 0 ? '+' : '−'}{inrShort(Math.abs(g.net))}</Text>
                      </Row>
                    </>
                  ) : null}
                </Card>
              </Pressable>
            </View>
          );
        })}
        {shownGroups.length < groups.length && (
          <Btn title={`Show more (${groups.length - shownGroups.length} more day${groups.length - shownGroups.length === 1 ? '' : 's'})`}
            kind="soft" icon="chevron-down" onPress={() => setPage(p => p + 1)} />
        )}
      </ScrollView>
    </Sheet>
  );
}

// Truck Empire Bank — credit score, loan products gated by score, active
// loans with EMI progress and early settlement. Premium dark banking look.
// Quick-amount repay row — no free-text keyboard needed, just fast presets
// plus a "Max" button, so partial repayment stays impossible to fat-finger.
function RepayQuickAmounts({ remaining, balance, value, onChange }) {
  const cap = Math.max(1, Math.min(remaining, balance));
  return (
    <View style={{ marginTop: 8 }}>
      <GameSlider min={0} max={cap} step={Math.max(1, Math.round(cap / 100))} value={Math.min(value, cap)} color={C.green}
        onChange={onChange} minLabel="₹0" maxLabel={inrShort(cap)} />
      <Text style={[FONT.tiny, { marginTop: 2 }]}>Drag to pick any amount, up to whichever is smaller — what's left owed or your balance.</Text>
    </View>
  );
}

// Collateral picker — trucks + non-HQ garages the player can pledge, with a
// live running total vs the 70% coverage bar so overshooting/undershooting
// the requirement is obvious before they tap Apply.
const COLLATERAL_PAGE = 5;
function CollateralPicker({ amount, trucks, hubs, pledgedT, pledgedH, selTrucks, selHubs, onToggleTruck, onToggleHub }) {
  const [page, setPage] = useState(1);
  const required = Math.ceil((amount || 0) * COLLATERAL_COVERAGE);
  const pledgeable = { truckIds: [...selTrucks], hubCityIds: [...selHubs] };
  const s = { trucks, hubs };
  const value = collateralTotalValue(s, pledgeable);
  const met = value >= required && required > 0;
  const availTrucks = trucks.filter(t => !pledgedT.has(t.id));
  const availHubs = hubs.filter(h => !h.hq && !pledgedH.has(h.cityId));
  // One combined lazy-loaded list — 5 rows at a time — so pledging against
  // a big fleet never renders (or lags on) the whole thing at once.
  const items = useMemo(() => [
    ...availTrucks.map(t => ({ kind: 'truck', t })),
    ...availHubs.map(h => ({ kind: 'hub', h })),
  ], [availTrucks, availHubs]);
  const visible = items.slice(0, page * COLLATERAL_PAGE);

  return (
    <Card style={{ marginBottom: 10 }}>
      <Text style={[FONT.body, { fontWeight: '800' }]}>Pledge Collateral</Text>
      <Text style={[FONT.tiny, { marginTop: 2 }]}>Trucks & garages stay in service — pledged assets just carry a small bank badge and get repossessed if this loan defaults.</Text>
      <Row style={{ justifyContent: 'space-between', marginTop: 10 }}>
        <Text style={FONT.tiny}>Pledged value</Text>
        <Text style={[FONT.tiny, { fontWeight: '800', color: met ? C.green : C.red }]}>{inrShort(value)} / {inrShort(required)} needed</Text>
      </Row>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: C.bgSoft, marginTop: 4, overflow: 'hidden' }}>
        <View style={{ width: `${Math.min(100, required ? (value / required) * 100 : 0)}%`, height: 6, backgroundColor: met ? C.green : C.amber }} />
      </View>
      <View style={[st.pickerBox, { marginTop: 10 }]}>
        {items.length === 0 ? (
          <Text style={[FONT.tiny, { padding: 8 }]}>No free (unpledged) trucks or garages to offer as collateral.</Text>
        ) : visible.map(item => {
          if (item.kind === 'truck') {
            const t = item.t;
            const model = modelById(t.modelId);
            const val = collateralTotalValue(s, { truckIds: [t.id], hubCityIds: [] });
            const on = selTrucks.includes(t.id);
            return (
              <Pressable key={t.id} style={st.pickerRow} onPress={() => onToggleTruck(t.id)}>
                <Icon name={on ? 'checkbox-marked' : 'checkbox-blank-outline'} size={18} color={on ? C.blue : C.faint} />
                <Text style={[FONT.tiny, { marginLeft: 8, flex: 1 }]} numberOfLines={1}>{t.customName || model.name}</Text>
                <Text style={[FONT.tiny, { color: C.faint }]}>{inrShort(val)}</Text>
              </Pressable>
            );
          }
          const h = item.h;
          const val = collateralTotalValue(s, { truckIds: [], hubCityIds: [h.cityId] });
          const on = selHubs.includes(h.cityId);
          return (
            <Pressable key={h.cityId} style={st.pickerRow} onPress={() => onToggleHub(h.cityId)}>
              <Icon name={on ? 'checkbox-marked' : 'checkbox-blank-outline'} size={18} color={on ? C.blue : C.faint} />
              <Text style={[FONT.tiny, { marginLeft: 8, flex: 1 }]} numberOfLines={1}>{h.name}</Text>
              <Text style={[FONT.tiny, { color: C.faint }]}>{inrShort(val)}</Text>
            </Pressable>
          );
        })}
      </View>
      {visible.length < items.length ? (
        <Pressable onPress={() => setPage(p => p + 1)} style={{ paddingVertical: 10, alignItems: 'center' }}>
          <Text style={[FONT.tiny, { color: C.blue, fontWeight: '700' }]}>Show more ({items.length - visible.length})</Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

function BankSheet({ visible, onClose }) {
  const toast = useToast();
  const balance = useGame(s => s.balance);
  const gold = useGame(s => s.gold);
  const tapDonorEgg = useEasterEggTap('donor', 5);
  const loans = useGame(s => s.loans || []);
  const credit = useGame(s => s.credit);
  const trucks = useGame(s => s.trucks);
  const hubs = useGame(s => s.hubs || []);
  const pledgedT = useMemo(() => pledgedTruckIds({ loans }), [loans]);
  const pledgedH = useMemo(() => pledgedHubCityIds({ loans }), [loans]);
  const takeLoan = useGame(s => s.takeLoan);
  const takeCustomLoan = useGame(s => s.takeCustomLoan);
  const prepayLoan = useGame(s => s.prepayLoan);
  const payLoanPartial = useGame(s => s.payLoanPartial);
  const donateMoney = useGame(s => s.donateMoney);
  const donateGold = useGame(s => s.donateGold);
  const [confirm, setConfirm] = useState(null);
  const [view, setView] = useState('overview'); // 'overview' | 'borrow'
  const [customAmt, setCustomAmt] = useState(500000); // slider default — exactly the ₹5L example
  const [selTrucks, setSelTrucks] = useState([]);
  const [selHubs, setSelHubs] = useState([]);
  const [repayAmt, setRepayAmt] = useState({}); // loanId -> picked amount
  const [donateCash, setDonateCash] = useState(0);
  const [donateGoldAmt, setDonateGoldAmt] = useState(0);
  const [confirmDonate, setConfirmDonate] = useState(null); // 'cash' | 'gold' | null
  useEffect(() => { if (!visible) { setConfirm(null); setView('overview'); setSelTrucks([]); setSelHubs([]); setConfirmDonate(null); } }, [visible]);
  const score = creditScoreOf(credit);
  const scorePct = ((score - 300) / 600) * 100;
  const scoreColor = score >= 720 ? C.green : score >= 600 ? C.amber : C.red;
  const scoreLabel = score >= 780 ? 'Excellent' : score >= 720 ? 'Very Good' : score >= 650 ? 'Good' : score >= 600 ? 'Fair' : 'Poor';
  const customMax = customLoanMax(score);
  const customClamped = Math.min(Math.max(CUSTOM_LOAN_MIN, customAmt), customMax);
  const customTerms = customLoanTerms(customClamped, score);
  const canCustom = loans.length < 2;

  const toggleTruck = id => setSelTrucks(a => a.includes(id) ? a.filter(x => x !== id) : [...a, id]);
  const toggleHub = id => setSelHubs(a => a.includes(id) ? a.filter(x => x !== id) : [...a, id]);
  const collateral = { truckIds: selTrucks, hubCityIds: selHubs };
  const resetPicker = () => { setSelTrucks([]); setSelHubs([]); setConfirm(null); };

  return (
    <Sheet visible={visible} onClose={onClose} title="Truck Empire Bank" height="88%">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
        {/* Credit score */}
        <Card style={{ marginBottom: 12, backgroundColor: '#0F172A', borderColor: '#1E293B' }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View>
              <Text style={[FONT.tiny, { color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1 }]}>Credit Score</Text>
              <Row style={{ alignItems: 'flex-end', marginTop: 2 }}>
                <Text style={[FONT.h1, { color: '#F8FAFC' }]}>{score}</Text>
                <Text style={[FONT.tiny, { color: scoreColor, fontWeight: '800', marginLeft: 8, marginBottom: 5 }]}>{scoreLabel}</Text>
              </Row>
            </View>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="bank" size={24} color="#5B8DF0" />
            </View>
          </Row>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: '#1E293B', marginTop: 12, overflow: 'hidden' }}>
            <View style={{ width: `${scorePct}%`, height: 8, backgroundColor: scoreColor, borderRadius: 4 }} />
          </View>
          <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
            <Text style={[FONT.tiny, { color: '#64748B' }]}>300</Text>
            <Text style={[FONT.tiny, { color: '#64748B' }]}>{(credit?.paid || 0)} EMIs paid · {(credit?.missed || 0)} missed</Text>
            <Text style={[FONT.tiny, { color: '#64748B' }]}>900</Text>
          </Row>
        </Card>

        {view === 'overview' ? (
          <>
            {loans.length > 0 ? <SectionTitle icon="file-clock-outline" text="Active Loans" /> : null}
            {loans.map(ln => {
              const p = LOAN_PRODUCTS.find(x => x.id === ln.productId);
              const done = ln.paidMonths / ln.months;
              const settle = Math.round(ln.remaining * 0.98);
              const pledgeCount = (ln.collateral?.truckIds?.length || 0) + (ln.collateral?.hubCityIds?.length || 0);
              const picked = repayAmt[ln.id] || 0;
              return (
                <Card key={ln.id} style={{ marginBottom: 10 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Row style={{ flex: 1 }}>
                      <Icon name={p?.icon || 'bank'} size={20} color={C.blue} />
                      <View style={{ marginLeft: 8, flex: 1 }}>
                        <Text style={[FONT.body, { fontWeight: '800' }]}>{ln.name}</Text>
                        <Text style={FONT.tiny}>EMI {inrShort(ln.emi)} / {LOAN_EMI_INTERVAL_DAYS} days · {ln.paidMonths}/{ln.months} paid</Text>
                      </View>
                    </Row>
                    <Text style={[FONT.mono, { fontWeight: '800', color: C.red }]}>{inrShort(ln.remaining)}</Text>
                  </Row>
                  <Progress pct={done * 100} color={C.green} style={{ marginTop: 10 }} />
                  {ln.missedStreak > 0 ? (
                    <Row style={{ marginTop: 8, backgroundColor: C.redSoft || C.amberSoft, borderRadius: RADIUS.sm, padding: 6 }}>
                      <Icon name="alert" size={14} color={C.red} />
                      <Text style={[FONT.tiny, { marginLeft: 6, color: C.red, flex: 1 }]}>
                        {ln.missedStreak} missed EMI{ln.missedStreak > 1 ? 's' : ''} in a row — {MISSED_STREAK_FOR_REPO - ln.missedStreak <= 0 ? 'pledged assets at risk NOW' : `${MISSED_STREAK_FOR_REPO - ln.missedStreak} more miss and a pledged asset gets repossessed`}.
                      </Text>
                    </Row>
                  ) : null}
                  {pledgeCount > 0 ? (
                    <Text style={[FONT.tiny, { marginTop: 6, color: C.faint }]}>{pledgeCount} asset{pledgeCount > 1 ? 's' : ''} pledged as collateral on this loan.</Text>
                  ) : null}
                  <Text style={[FONT.tiny, { marginTop: 10 }]}>Repay any amount now:</Text>
                  <RepayQuickAmounts remaining={ln.remaining} balance={balance} value={picked} onChange={v => setRepayAmt(a => ({ ...a, [ln.id]: v }))} />
                  <Row style={{ gap: 8, marginTop: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Btn title={picked ? `Pay ${inrShort(picked)} now` : 'Pick an amount above'} kind={picked ? 'primary' : 'ghost'} small icon="cash-check"
                        disabled={!picked || balance < picked}
                        onPress={() => {
                          const r = payLoanPartial(ln.id, picked);
                          toast(r.ok ? `Paid ${inrShort(picked)} toward ${ln.name}` : r.err, r.ok ? 'success' : 'error');
                          if (r.ok) setRepayAmt(a => ({ ...a, [ln.id]: 0 }));
                        }} />
                    </View>
                  </Row>
                  <Btn title={confirm === ln.id ? `Confirm — pay ${inrShort(settle)}` : `Settle in full · ${inrShort(settle)} (2% off)`}
                    kind={balance >= settle ? 'soft' : 'ghost'} small icon="bank-check" style={{ marginTop: 8 }}
                    disabled={balance < settle}
                    onPress={() => {
                      if (confirm === ln.id) { const r = prepayLoan(ln.id); toast(r.ok ? 'Loan settled — credit score up!' : r.err, r.ok ? 'success' : 'error'); setConfirm(null); }
                      else setConfirm(ln.id);
                    }} />
                </Card>
              );
            })}

            {loans.length === 0 ? (
              <EmptyState icon="bank-outline" title="No active loans" sub="Borrow against your trucks or garages when you need a cash injection." />
            ) : null}

            <Card style={{ backgroundColor: C.amberSoft, marginTop: 4, marginBottom: 12 }}>
              <Row>
                <Icon name="lightbulb-on-outline" size={14} color={C.amber} />
                <Text style={[FONT.tiny, { marginLeft: 6, flex: 1, color: C.text }]}>
                  Tips: EMIs auto-deduct every {LOAN_EMI_INTERVAL_DAYS} game days. Repay any amount anytime to shrink what's owed. Miss {MISSED_STREAK_FOR_REPO} EMIs in a row and the bank seizes a pledged truck or garage — keep an eye on the reminder notifications.
                </Text>
              </Row>
            </Card>

            {/* Charity Drive — a deliberate cash/gold sink for players who've
                piled up more than they'll ever spend. No reward, on purpose —
                the point is just to get rid of the excess. Slider to pick the
                amount, separate confirm tap before anything actually happens
                (same staged pattern as loan repayment above). */}
            <Card style={{ marginBottom: 12 }}>
              <Row>
                <Pressable onPress={tapDonorEgg}><Icon name="hand-heart" size={18} color={C.red} /></Pressable>
                <Text style={[FONT.body, { fontWeight: '800', marginLeft: 8 }]}>Charity Drive</Text>
              </Row>
              <Text style={[FONT.tiny, { marginTop: 2 }]}>Got more cash or gold than you'll ever spend? Donate it away — no reward, just a clean account.</Text>
              <Text style={[FONT.tiny, { marginTop: 10, fontWeight: '700' }]}>Cash — {inrShort(balance)} available</Text>
              <GameSlider min={0} max={Math.max(1, balance)} step={Math.max(1, Math.round(balance / 100))} value={Math.min(donateCash, balance)}
                color={C.red} onChange={setDonateCash} minLabel="₹0" maxLabel={inrShort(balance)} />
              <Btn title={donateCash > 0 ? (confirmDonate === 'cash' ? `Confirm — donate ${inrShort(donateCash)}` : `Donate ${inrShort(donateCash)}`) : 'Drag the slider to pick an amount'}
                kind={donateCash > 0 ? 'soft' : 'ghost'} small disabled={donateCash <= 0} style={{ marginTop: 8 }}
                onPress={() => {
                  if (confirmDonate === 'cash') {
                    const r = donateMoney(donateCash);
                    toast(r.ok ? `Donated ${inrShort(donateCash)}` : r.err, r.ok ? 'success' : 'error');
                    if (r.ok) setDonateCash(0);
                    setConfirmDonate(null);
                  } else setConfirmDonate('cash');
                }} />
              <Text style={[FONT.tiny, { marginTop: 14, fontWeight: '700' }]}>Gold — {gold} available</Text>
              <GameSlider min={0} max={Math.max(1, gold)} step={1} value={Math.min(donateGoldAmt, gold)}
                color={C.gold} onChange={setDonateGoldAmt} minLabel="0" maxLabel={String(gold)} />
              <Btn title={donateGoldAmt > 0 ? (confirmDonate === 'gold' ? `Confirm — donate ${donateGoldAmt} Gold` : `Donate ${donateGoldAmt} Gold`) : 'Drag the slider to pick an amount'}
                kind={donateGoldAmt > 0 ? 'soft' : 'ghost'} small disabled={donateGoldAmt <= 0} style={{ marginTop: 8 }}
                onPress={() => {
                  if (confirmDonate === 'gold') {
                    const r = donateGold(donateGoldAmt);
                    toast(r.ok ? `Donated ${donateGoldAmt} Gold` : r.err, r.ok ? 'success' : 'error');
                    if (r.ok) setDonateGoldAmt(0);
                    setConfirmDonate(null);
                  } else setConfirmDonate('gold');
                }} />
            </Card>

            <Btn title="Borrow Loan" icon="bank-plus" kind="green" onPress={() => setView('borrow')} />
          </>
        ) : (
          <>
            <Pressable onPress={() => { setView('overview'); resetPicker(); }} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <Icon name="chevron-left" size={18} color={C.blue} />
              <Text style={[FONT.body, { color: C.blue, fontWeight: '700', marginLeft: 2 }]}>Back</Text>
            </Pressable>

            {/* Custom Loan — pick ANY amount on a slider instead of only the
                fixed catalog tiers. Terms recompute live as you drag. */}
            <SectionTitle icon="tune-variant" text="Custom Loan" />
            <Card style={{ marginBottom: 10 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={FONT.sub}>Borrow exactly what you need</Text>
                <Text style={[FONT.h3, { color: C.green }]}>{inr(customClamped)}</Text>
              </Row>
              <GameSlider min={CUSTOM_LOAN_MIN} max={customMax} step={50000} value={customClamped} color={C.green}
                onChange={setCustomAmt} minLabel={inrShort(CUSTOM_LOAN_MIN)} maxLabel={inrShort(customMax)} />
              <Text style={[FONT.tiny, { marginTop: 4 }]}>Max scales with your credit score ({score}) — better score, bigger ceiling.</Text>
              <Row style={{ marginTop: 10, backgroundColor: C.bgSoft, borderRadius: RADIUS.md, paddingVertical: 8, justifyContent: 'space-around' }}>
                <View style={{ alignItems: 'center' }}><Text style={[FONT.body, { fontWeight: '800' }]}>{Math.round(customTerms.apr * 100)}%</Text><Text style={FONT.tiny}>interest</Text></View>
                <View style={{ alignItems: 'center' }}><Text style={[FONT.body, { fontWeight: '800' }]}>{customTerms.months}</Text><Text style={FONT.tiny}>months</Text></View>
                <View style={{ alignItems: 'center' }}><Text style={[FONT.body, { fontWeight: '800' }]}>{inrShort(customTerms.emi)}</Text><Text style={FONT.tiny}>EMI / {LOAN_EMI_INTERVAL_DAYS}d</Text></View>
                <View style={{ alignItems: 'center' }}><Text style={[FONT.body, { fontWeight: '800' }]}>{inrShort(customTerms.totalDue)}</Text><Text style={FONT.tiny}>total repay</Text></View>
              </Row>
            </Card>
            <CollateralPicker amount={customClamped} trucks={trucks} hubs={hubs} pledgedT={pledgedT} pledgedH={pledgedH}
              selTrucks={selTrucks} selHubs={selHubs} onToggleTruck={toggleTruck} onToggleHub={toggleHub} />
            <Btn
              title={!canCustom ? 'Loan limit reached (2)' : confirm === 'custom' ? `Confirm — borrow ${inr(customClamped)}` : `Apply · repay ${inrShort(customTerms.totalDue)} total`}
              kind={canCustom ? 'green' : 'soft'} disabled={!canCustom} style={{ marginTop: 10, marginBottom: 16 }}
              onPress={() => {
                if (confirm === 'custom') {
                  const r = takeCustomLoan(customClamped, collateral);
                  toast(r.ok ? `Custom loan approved — ${inr(customClamped)} credited!` : r.err, r.ok ? 'success' : 'error');
                  if (r.ok) { setConfirm(null); setSelTrucks([]); setSelHubs([]); setView('overview'); } else setConfirm(null);
                } else setConfirm('custom');
              }} />

            {/* Products */}
            <SectionTitle icon="cash-plus" text="Loan Products" />
            {LOAN_PRODUCTS.map(p => {
              const active = loans.some(l => l.productId === p.id);
              const eligible = score >= p.minScore && loans.length < 2 && !active;
              const totalDue = Math.round(p.amount * (1 + p.apr));
              return (
                <Card key={p.id} style={{ marginBottom: 10, opacity: active ? 0.65 : 1 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Row style={{ flex: 1 }}>
                      <View style={[st.iconCircle, { backgroundColor: C.blueSoft }]}>
                        <Icon name={p.icon} size={20} color={C.blue} />
                      </View>
                      <View style={{ marginLeft: 10, flex: 1 }}>
                        <Text style={FONT.h3}>{p.name}</Text>
                        <Text style={FONT.tiny} numberOfLines={2}>{p.blurb}</Text>
                      </View>
                    </Row>
                    <Text style={[FONT.h3, { color: C.green }]}>{inrShort(p.amount)}</Text>
                  </Row>
                  <Row style={{ marginTop: 10, backgroundColor: C.bgSoft, borderRadius: RADIUS.md, paddingVertical: 8, justifyContent: 'space-around' }}>
                    <View style={{ alignItems: 'center' }}><Text style={[FONT.body, { fontWeight: '800' }]}>{Math.round(p.apr * 100)}%</Text><Text style={FONT.tiny}>interest</Text></View>
                    <View style={{ alignItems: 'center' }}><Text style={[FONT.body, { fontWeight: '800' }]}>{p.months}</Text><Text style={FONT.tiny}>months</Text></View>
                    <View style={{ alignItems: 'center' }}><Text style={[FONT.body, { fontWeight: '800' }]}>{inrShort(Math.round(totalDue / p.months))}</Text><Text style={FONT.tiny}>EMI / {LOAN_EMI_INTERVAL_DAYS}d</Text></View>
                    <View style={{ alignItems: 'center' }}><Text style={[FONT.body, { fontWeight: '800', color: score >= p.minScore ? C.green : C.red }]}>{p.minScore || '—'}</Text><Text style={FONT.tiny}>min score</Text></View>
                  </Row>
                  {confirm === p.id ? (
                    <CollateralPicker amount={p.amount} trucks={trucks} hubs={hubs} pledgedT={pledgedT} pledgedH={pledgedH}
                      selTrucks={selTrucks} selHubs={selHubs} onToggleTruck={toggleTruck} onToggleHub={toggleHub} />
                  ) : null}
                  <Btn
                    title={active ? 'Already running' : loans.length >= 2 && !active ? 'Loan limit reached (2)'
                      : score < p.minScore ? `Score too low (need ${p.minScore})`
                        : confirm === p.id ? `Confirm — borrow ${inrShort(p.amount)}` : `Apply · repay ${inrShort(totalDue)} total`}
                    kind={eligible ? 'primary' : 'soft'} small={false} icon="bank-plus" disabled={!eligible}
                    style={{ marginTop: 10 }}
                    onPress={() => {
                      if (confirm === p.id) {
                        const r = takeLoan(p.id, collateral);
                        toast(r.ok ? `${p.name} approved — ${inrShort(p.amount)} credited!` : r.err, r.ok ? 'success' : 'error');
                        if (r.ok) { setConfirm(null); setSelTrucks([]); setSelHubs([]); setView('overview'); } else setConfirm(null);
                      } else { setConfirm(p.id); setSelTrucks([]); setSelHubs([]); }
                    }} />
                </Card>
              );
            })}
          </>
        )}
      </ScrollView>
    </Sheet>
  );
}

export function EconomyTab() {
  const balance = useGame(s => s.balance);
  const gold = useGame(s => s.gold);
  const stats = useGame(s => s.stats);
  const staff = useGame(s => s.staff);
  const trucks = useGame(s => s.trucks);
  const deliveries = useGame(s => s.deliveries);
  const history = useGame(s => s.history);
  const ledger = useGame(s => s.ledger || []);
  const hubs = useGame(s => s.hubs || []);
  const pricing = useGame(s => s.pricing);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const customCount = useMemo(() => CARGO_TYPES.filter(cg => pricing[cg.id] != null && pricing[cg.id] !== cg.rate).length, [pricing]);
  const [barSel, setBarSel] = useState(null);   // tapped profit bar
  const [fuelSel, setFuelSel] = useState(null); // tapped fuel-history bar
  const fuelToday = useGame(s => s.fuelToday);
  const loans = useGame(s => s.loans || []);
  const tapDistanceEgg = useEasterEggTap('long_hauler', 10);
  const fuel = fuelToday();

  const now = useNow(deliveries.length > 0);
  const salaryBurden = useMemo(() => staff.reduce((a, x) => a + x.salary, 0), [staff]);
  const upkeepBurden = useMemo(() => hubs.filter(h => !h.hq).reduce((a, h) => a + (h.maint || 40000), 0), [hubs]);
  const bars = useMemo(() => history.slice(0, 10).reverse(), [history]);
  const maxAbs = useMemo(() => Math.max(1, ...bars.map(b => Math.abs(b.net))), [bars]);
  const liveKm = useMemo(() => deliveries.reduce((a, d) => {
    const prog = Math.max(0, Math.min(1, (now - d.startedAt) / (d.endsAt - d.startedAt)));
    return a + d.route.roadKm * prog;
  }, 0), [deliveries, now]);

  // Cash-flow split from the ledger (all recorded entries).
  const flow = useMemo(() => {
    let income = 0, expense = 0;
    for (const e of ledger) { if (e.amount >= 0) income += e.amount; else expense += -e.amount; }
    return { income, expense, net: income - expense };
  }, [ledger]);
  const flowTotal = Math.max(1, flow.income + flow.expense);

  // Insights derived from live state + history.
  const avgProfit = history.length ? Math.round(history.reduce((a, h) => a + h.net, 0) / history.length) : 0;
  const costPerKm = stats.km > 0 ? stats.fuelSpend / stats.km : 0;
  const running = trucks.filter(t => t.status === 'delivering').length;
  const utilisation = trucks.length ? Math.round((running / trucks.length) * 100) : 0;
  const topRoutes = useMemo(() => {
    const m = new Map();
    for (const h of history) {
      const key = `${h.fromCityId}~${h.toCityId}`;
      const g = m.get(key) || { key, from: h.fromCityId, to: h.toCityId, net: 0, runs: 0 };
      g.net += h.net; g.runs += 1; m.set(key, g);
    }
    return [...m.values()].sort((a, b) => b.net - a.net).slice(0, 3);
  }, [history]);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
      {/* ---- P&L hero: cash-flow split from the ledger ---- */}
      <Card style={{ marginBottom: 10, backgroundColor: '#0F172A', borderColor: '#1E293B' }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <Text style={[FONT.tiny, { color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1 }]}>Cash Balance</Text>
            <Text style={[FONT.h1, { color: '#F8FAFC', marginTop: 2 }]}>{inrShort(balance)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Row><Icon name="gold" size={14} color={C.gold} /><Text style={[FONT.h3, { color: C.gold, marginLeft: 4 }]}>{gold}</Text></Row>
            <Text style={[FONT.tiny, { color: flow.net >= 0 ? '#4ADE80' : '#F87171', marginTop: 4, fontWeight: '800' }]}>
              {flow.net >= 0 ? '▲' : '▼'} {inrShort(Math.abs(flow.net))} net flow
            </Text>
          </View>
        </Row>
        {/* Income vs expense split bar */}
        <View style={{ height: 8, borderRadius: 4, flexDirection: 'row', overflow: 'hidden', marginTop: 12, backgroundColor: '#1E293B' }}>
          <View style={{ width: `${(flow.income / flowTotal) * 100}%`, backgroundColor: '#22C55E' }} />
          <View style={{ width: `${(flow.expense / flowTotal) * 100}%`, backgroundColor: '#EF4444' }} />
        </View>
        <Row style={{ justifyContent: 'space-between', marginTop: 6 }}>
          <Text style={[FONT.tiny, { color: '#4ADE80', fontWeight: '700' }]}>IN {inrShort(flow.income)}</Text>
          <Text style={[FONT.tiny, { color: '#F87171', fontWeight: '700' }]}>OUT {inrShort(flow.expense)}</Text>
        </Row>
        <Row style={{ marginTop: 12, gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Btn title="Company Ledger" icon="notebook-outline" kind="blue" small onPress={() => setLedgerOpen(true)} />
          </View>
          <View style={{ flex: 1 }}>
            <Btn title={loans.length ? `Bank (${loans.length})` : 'Bank & Loans'} icon="bank" kind="green" small onPress={() => setBankOpen(true)} />
          </View>
        </Row>
      </Card>

      <Row style={{ marginBottom: 8 }}>
        <Stat icon="chart-line" label="Lifetime Revenue" value={inrShort(stats.revenue)} color={C.green} />
        <View style={{ width: 8 }} />
        <Stat icon="gas-station" label="Fuel Spend" value={inrShort(stats.fuelSpend)} color={C.red} />
      </Row>
      <Row style={{ marginBottom: 14 }}>
        <Stat icon="package-variant-closed-check" label="Deliveries"
          value={deliveries.length ? `${stats.deliveries} (+${deliveries.length})` : String(stats.deliveries)} />
        <View style={{ width: 8 }} />
        <Pressable style={{ flex: 1 }} onPress={tapDistanceEgg}>
          <Stat icon="map-marker-distance" label="Distance" value={`${Math.round(stats.km + liveKm).toLocaleString('en-IN')} km`} />
        </Pressable>
      </Row>

      {/* ---- Daily fuel market ---- */}
      <SectionTitle icon="gas-station" text="Fuel Market" right={
        <Pill text={fuel.factor <= 0.95 ? 'CHEAP — fill up!' : fuel.factor >= 1.12 ? 'SPIKE' : 'Normal'}
          color={fuel.factor <= 0.95 ? C.green : fuel.factor >= 1.12 ? C.red : C.sub}
          bg={fuel.factor <= 0.95 ? C.greenSoft : fuel.factor >= 1.12 ? C.redSoft : C.bgSoft} />
      } />
      <Card style={{ marginBottom: 14 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <Text style={FONT.tiny}>TODAY'S DIESEL</Text>
            <Row style={{ alignItems: 'flex-end' }}>
              <Text style={[FONT.h2, { color: fuel.factor >= 1.12 ? C.red : fuel.factor <= 0.95 ? C.green : C.text }]}>₹{fuel.price}/L</Text>
              <Text style={[FONT.tiny, { marginLeft: 6, marginBottom: 3 }]}>base ₹{fuel.base}</Text>
            </Row>
          </View>
          <Text style={[FONT.h3, { color: fuel.factor > 1 ? C.red : C.green }]}>
            {fuel.factor > 1 ? '+' : ''}{Math.round((fuel.factor - 1) * 100)}%
          </Text>
        </Row>
        {/* 7-day price bars — tap any bar for that day's exact price */}
        <Row style={{ alignItems: 'flex-end', height: 46, marginTop: 10, gap: 4 }}>
          {fuel.history.map((f, i) => (
            <Pressable key={i} onPress={() => { haptic('light'); setFuelSel(fuelSel === i ? null : i); }} style={{ flex: 1 }}>
              <View style={{
                borderRadius: 3,
                height: 8 + ((f - 0.85) / 0.4) * 38,
                backgroundColor: fuelSel === i ? '#0F172A'
                  : i === fuel.history.length - 1 ? (f >= 1.12 ? C.red : f <= 0.95 ? C.green : C.blue) : C.border,
              }} />
            </Pressable>
          ))}
        </Row>
        <Text style={[FONT.tiny, { marginTop: 6, textAlign: 'center' }]}>
          {fuelSel != null
            ? `Day ${fuel.day - (fuel.history.length - 1 - fuelSel)} · ₹${Math.round(fuel.base * fuel.history[fuelSel])}/L (${fuel.history[fuelSel] > 1 ? '+' : ''}${Math.round((fuel.history[fuelSel] - 1) * 100)}%)`
            : `Last 7 days · tap a bar for that day's price`}
        </Text>
      </Card>

      {/* ---- Business insights ---- */}
      <SectionTitle icon="lightbulb-on-outline" text="Business Insights" />
      <Card style={{ marginBottom: 14 }}>
        <InsightRow icon="cash-check" label="Avg profit per delivery" sub={`across last ${history.length} trips`}
          value={inrShort(avgProfit)} color={avgProfit >= 0 ? C.green : C.red} />
        <InsightRow divider icon="gas-station-outline" label="Fuel cost per km" sub="lifetime fuel ÷ km driven"
          value={`₹${costPerKm.toFixed(1)}`} color={costPerKm > 30 ? C.red : C.text} />
        <InsightRow divider icon="truck-fast" label="Fleet utilisation" sub={`${running} of ${trucks.length} trucks on the road`}
          value={`${utilisation}%`} color={utilisation >= 50 ? C.green : C.amber} />
        <InsightRow divider icon="cash-clock" label="Monthly fixed costs" sub={`${inrShort(salaryBurden)} salaries + ${inrShort(upkeepBurden)} upkeep`}
          value={inrShort(salaryBurden + upkeepBurden)} color={C.amber} />
      </Card>

      {/* ---- Most profitable routes ---- */}
      {topRoutes.length > 0 && (
        <>
          <SectionTitle icon="trophy-outline" text="Top Earning Routes" />
          <Card style={{ marginBottom: 14 }}>
            {topRoutes.map((r, i) => {
              const from = cityById(r.from), to = cityById(r.to);
              return (
                <Row key={r.key} style={[{ paddingVertical: 9, justifyContent: 'space-between' }, i > 0 && st.divider]}>
                  <Row style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[FONT.h3, { color: i === 0 ? C.gold : C.sub, width: 24 }]}>#{i + 1}</Text>
                    <View style={{ flex: 1 }}>
                      <Row>
                        <Text style={FONT.body} numberOfLines={1}>{from?.name || '?'}</Text>
                        <Icon name="arrow-right" size={12} color={C.faint} style={{ marginHorizontal: 4 }} />
                        <Text style={FONT.body} numberOfLines={1}>{to?.name || '?'}</Text>
                      </Row>
                      <Text style={FONT.tiny}>{r.runs} run{r.runs > 1 ? 's' : ''}</Text>
                    </View>
                  </Row>
                  <Text style={[FONT.mono, { fontWeight: '800', color: C.green }]}>{inrShort(r.net)}</Text>
                </Row>
              );
            })}
          </Card>
        </>
      )}

      <SectionTitle icon="chart-bar" text="Recent Net Profit" />
      {bars.length === 0 ? (
        <Text style={[FONT.sub, { textAlign: 'center', paddingVertical: 16 }]}>Complete deliveries to see your profit trend.</Text>
      ) : (
        <Card style={{ marginBottom: 14 }}>
          {/* Interactive: tap any bar and its exact value pops above it. */}
          <Row style={{ alignItems: 'flex-end', height: 130, justifyContent: 'space-between' }}>
            {bars.map((b, i) => {
              const h = Math.max(6, (Math.abs(b.net) / maxAbs) * 96);
              const active = barSel != null ? barSel === i : Math.abs(b.net) === maxAbs;
              return (
                <Pressable key={b.id} onPress={() => { haptic('light'); setBarSel(barSel === i ? null : i); }}
                  style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', marginHorizontal: 3 }}>
                  {active ? (
                    <View style={{ backgroundColor: '#0F172A', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, marginBottom: 3 }}>
                      <Text style={[FONT.tiny, { fontWeight: '800', color: b.net >= 0 ? '#4ADE80' : '#F87171' }]} numberOfLines={1}>
                        {inrShort(b.net)}
                      </Text>
                    </View>
                  ) : null}
                  <View style={{
                    width: '100%', height: h, borderRadius: 4,
                    backgroundColor: b.net >= 0 ? C.green : C.red,
                    opacity: active ? 1 : 0.65,
                    borderWidth: barSel === i ? 1.5 : 0, borderColor: '#0F172A',
                  }} />
                </Pressable>
              );
            })}
          </Row>
          <Text style={[FONT.tiny, { marginTop: 8, textAlign: 'center' }]}>
            {barSel != null ? `${cityById(bars[barSel].fromCityId)?.name || '?'} → ${cityById(bars[barSel].toCityId)?.name || '?'} · ${bars[barSel].km} km · profit ${inrShort(bars[barSel].net)} · ${relTime(bars[barSel].ts)}` : `Last ${bars.length} deliveries — tap a bar for details`}
          </Text>
        </Card>
      )}

      <SectionTitle icon="tune" text="Freight Pricing" />
      <Card style={{ marginBottom: 10 }} onPress={() => setPricingOpen(true)}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row style={{ flex: 1 }}>
            <View style={[st.iconCircle, { backgroundColor: C.blueSoft }]}>
              <Icon name="tune" size={20} color={C.blue} />
            </View>
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={FONT.h3}>Set Your Rates</Text>
              <Text style={FONT.tiny} numberOfLines={2}>Custom ₹/km·ton pricing per cargo type — {customCount > 0 ? `${customCount} customized` : 'all at default'}</Text>
            </View>
          </Row>
          <Icon name="chevron-right" size={20} color={C.faint} />
        </Row>
      </Card>

      <LedgerSheet visible={ledgerOpen} onClose={() => setLedgerOpen(false)} />
      <BankSheet visible={bankOpen} onClose={() => setBankOpen(false)} />
      <PricingSheet visible={pricingOpen} onClose={() => setPricingOpen(false)} />
    </ScrollView>
  );
}

// Freight pricing — pulled out of the Economy tab into its own sheet so the
// tab itself reads as a dashboard, not a settings page.
function PricingSheet({ visible, onClose }) {
  const pricing = useGame(s => s.pricing);
  const savePricing = useGame(s => s.savePricing);
  const [priceEdit, setPriceEdit] = useState(null);
  useEffect(() => { if (!visible) setPriceEdit(null); }, [visible]);

  return (
    <Sheet visible={visible} onClose={onClose} title="Freight Pricing" height="85%">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
        <Card style={{ marginBottom: 10, backgroundColor: C.blueSoft }}>
          <Row>
            <Icon name="information-outline" size={14} color={C.blue} />
            <Text style={[FONT.tiny, { marginLeft: 6, flex: 1, color: C.text }]}>
              Set your own rate per cargo type. It applies instantly to every new delivery's freight revenue and profit preview — raise a rate to ₹20 and that cargo pays far more per ton per km.
            </Text>
          </Row>
        </Card>
        <Card>
          {CARGO_TYPES.map((cg, i) => {
            const custom = pricing[cg.id] != null && pricing[cg.id] !== cg.rate;
            const v = pricing[cg.id] != null ? pricing[cg.id] : cg.rate;
            const MINR = 2, MAXR = 25;
            const open = priceEdit === cg.id;
            return (
              <View key={cg.id} style={[{ paddingVertical: 10 }, i > 0 && st.divider]}>
                <Pressable onPress={() => { haptic('light'); setPriceEdit(open ? null : cg.id); }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Row style={{ flex: 1 }}>
                      <Icon name={cg.icon} size={18} color={C.sub} />
                      <View style={{ marginLeft: 8, flex: 1 }}>
                        <Row>
                          <Text style={[FONT.body, { fontWeight: '600' }]} numberOfLines={1}>{cg.name}</Text>
                          {custom ? <View style={{ marginLeft: 6 }}><Pill text="Custom" icon="tune" color={C.green} bg={C.greenSoft} /></View> : null}
                        </Row>
                        <Text style={FONT.tiny}>Default ₹{cg.rate}</Text>
                      </View>
                    </Row>
                    <Row style={{ alignItems: 'center' }}>
                      <Text style={[FONT.mono, { fontWeight: '800', minWidth: 52, textAlign: 'right', color: custom ? C.green : C.text }]}>₹{v}</Text>
                      <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} color={C.faint} style={{ marginLeft: 6 }} />
                    </Row>
                  </Row>
                </Pressable>
                {open && (
                  <View style={{ marginTop: 4 }}>
                    <GameSlider min={MINR} max={MAXR} step={0.5} value={v} color={custom ? C.green : C.blue}
                      onChange={nv => savePricing({ [cg.id]: nv })}
                      minLabel={`₹${MINR}`} maxLabel={`₹${MAXR}`} />
                    {custom && (
                      <Btn title={`Reset to default ₹${cg.rate}`} kind="soft" small icon="restore"
                        onPress={() => savePricing({ [cg.id]: cg.rate })} style={{ alignSelf: 'flex-start', marginTop: 4 }} />
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </Card>
      </ScrollView>
    </Sheet>
  );
}

// ============================== 5. MARKETING ==============================
export function MarketingTab() {
  const campaigns = useGame(s => s.campaigns);
  const balance = useGame(s => s.balance);
  const settings = useGame(s => s.settings);
  const launchCampaign = useGame(s => s.launchCampaign);
  const cancelCampaign = useGame(s => s.cancelCampaign);
  const [confirmCancel, setConfirmCancel] = useState(null);
  const [view, setView] = useState('overview'); // 'overview' | 'launch' — clean separation, matches Bank pattern
  const toast = useToast();
  const active = campaigns.filter(a => a.endsAt > Date.now());
  const now = useNow(active.length > 0);
  const dayMs = 24 * GAME_HOUR_MS / settings.speed;

  // ---- Marketing intelligence (v3.0.0): what the boost is actually worth.
  // Average daily gross from recent history → estimated extra revenue per
  // campaign → ROI and payback, so launching is a decision, not a guess.
  const history = useGame(s => s.history);
  const stats = useGame(s => s.stats);
  const marketingBoost = useGame(s => s.marketingBoost);
  const curBoost = marketingBoost();
  const dailyGross = useMemo(() => {
    const recent = history.slice(0, 12);
    if (!recent.length) return 0;
    const spanDays = Math.max(0.5, (Date.now() - recent[recent.length - 1].ts) / (24 * GAME_HOUR_MS / (settings.speed || 1)));
    return recent.reduce((a, h) => a + (h.gross || h.net), 0) / spanDays;
  }, [history, settings.speed]);
  const roiFor = (def) => {
    const extra = dailyGross * def.boost * def.days;
    const profit = extra - def.cost;
    return { extra, profit, ratio: def.cost > 0 ? extra / def.cost : 0 };
  };
  const bestId = useMemo(() => {
    if (!dailyGross) return null;
    let best = null, bp = -Infinity;
    for (const def of CAMPAIGNS) { const r = roiFor(def); if (r.profit > bp) { bp = r.profit; best = def.id; } }
    return bp > 0 ? best : null;
  }, [dailyGross]);
  const soonest = active.length ? Math.min(...active.map(a => a.endsAt)) : 0;

  if (view === 'launch') {
    return (
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <Pressable onPress={() => setView('overview')} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
          <Icon name="chevron-left" size={18} color={C.blue} />
          <Text style={[FONT.body, { color: C.blue, fontWeight: '700', marginLeft: 2 }]}>Back to overview</Text>
        </Pressable>
        <SectionTitle icon="rocket-launch-outline" text="Available Campaigns" />
        {CAMPAIGNS.map(def => {
          const isActive = active.some(a => a.campaignId === def.id);
          const cannot = balance < def.cost;
          const disabled = isActive || cannot;
          return (
            <Card key={def.id} style={{ marginBottom: 10 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Row style={{ flex: 1 }}>
                  <View style={[st.iconCircle, { backgroundColor: C.blueSoft }]}>
                    <Icon name={def.icon} size={20} color={C.blue} />
                  </View>
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={FONT.h3}>{def.name}</Text>
                    <Text style={FONT.tiny} numberOfLines={2}>{def.desc}</Text>
                  </View>
                </Row>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Pill text={`+${Math.round(def.boost * 100)}%`} color={C.green} bg={C.greenSoft} />
                  {bestId === def.id ? <Pill text="Best value" icon="star" color={C.gold} bg={C.amberSoft} /> : null}
                </View>
              </Row>
              {dailyGross > 0 && (() => { const r = roiFor(def); return (
                <Row style={{ marginTop: 10, backgroundColor: C.bgSoft, borderRadius: RADIUS.md, paddingVertical: 7, justifyContent: 'space-around' }}>
                  <View style={{ alignItems: 'center' }}><Text style={[FONT.tiny, { fontWeight: '800', color: C.green }]}>{inrShort(r.extra)}</Text><Text style={[FONT.tiny, { fontSize: 9 }]}>est. extra revenue</Text></View>
                  <View style={{ alignItems: 'center' }}><Text style={[FONT.tiny, { fontWeight: '800', color: r.profit >= 0 ? C.green : C.red }]}>{r.profit >= 0 ? '+' : '−'}{inrShort(Math.abs(r.profit))}</Text><Text style={[FONT.tiny, { fontSize: 9 }]}>est. net gain</Text></View>
                  <View style={{ alignItems: 'center' }}><Text style={[FONT.tiny, { fontWeight: '800' }]}>{r.ratio.toFixed(1)}×</Text><Text style={[FONT.tiny, { fontSize: 9 }]}>return on spend</Text></View>
                </Row>
              ); })()}
              <Row style={{ justifyContent: 'space-between', marginTop: 12 }}>
                <Text style={FONT.sub}>{inr(def.cost)} · {def.days} days</Text>
                <Btn
                  title={isActive ? 'Running' : cannot ? 'Low funds' : 'Launch'}
                  kind="blue" small disabled={disabled}
                  onPress={() => {
                    const r = launchCampaign(def.id);
                    toast && toast(r.ok ? `${def.name} launched!` : r.err, r.ok ? 'success' : 'error');
                    if (r.ok) setView('overview');
                  }}
                />
              </Row>
            </Card>
          );
        })}
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
      {/* ---- Marketing HQ hero ---- */}
      <Card style={{ marginBottom: 12, backgroundColor: '#0F172A', borderColor: '#1E293B' }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <Text style={[FONT.tiny, { color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1 }]}>Active Revenue Boost</Text>
            <Row style={{ alignItems: 'flex-end', marginTop: 2 }}>
              <Text style={[FONT.h1, { color: curBoost > 0 ? '#4ADE80' : '#F8FAFC' }]}>+{Math.round(curBoost * 100)}%</Text>
              {curBoost > 0 && soonest ? <Text style={[FONT.tiny, { color: '#94A3B8', marginLeft: 8, marginBottom: 5 }]}>ends in {Math.max(0, Math.ceil((soonest - now) / dayMs))}d</Text> : null}
            </Row>
          </View>
          <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="bullhorn" size={24} color="#5B8DF0" />
          </View>
        </Row>
        <Row style={{ marginTop: 10, backgroundColor: '#1E293B', borderRadius: RADIUS.md, paddingVertical: 8, justifyContent: 'space-around' }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={[FONT.body, { fontWeight: '800', color: '#F8FAFC' }]}>{inrShort(dailyGross)}</Text>
            <Text style={[FONT.tiny, { color: '#64748B' }]}>avg gross / day</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={[FONT.body, { fontWeight: '800', color: '#4ADE80' }]}>{inrShort(dailyGross * curBoost)}</Text>
            <Text style={[FONT.tiny, { color: '#64748B' }]}>extra / day now</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={[FONT.body, { fontWeight: '800', color: '#F8FAFC' }]}>{stats.campaigns || 0}</Text>
            <Text style={[FONT.tiny, { color: '#64748B' }]}>campaigns run</Text>
          </View>
        </Row>
        <Text style={[FONT.tiny, { color: '#64748B', marginTop: 8 }]}>
          Only the strongest active campaign applies — stack end dates, not boosts. Estimates use your last {Math.min(history.length, 12)} deliveries.
        </Text>
      </Card>

      <SectionTitle icon="bullhorn" text="Active Campaigns" />
      {active.length === 0 ? (
        <EmptyState icon="bullhorn-outline" title="No active campaigns" sub="Launch a campaign below to boost delivery revenue." />
      ) : active.map(a => {
        const def = CAMPAIGNS.find(c => c.id === a.campaignId);
        if (!def) return null;
        const daysLeft = Math.max(0, Math.ceil((a.endsAt - now) / dayMs));
        const elapsed = clampPct(((now - a.startedAt) / (a.endsAt - a.startedAt)) * 100);
        return (
          <Card key={a.id} style={{ marginBottom: 10 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row style={{ flex: 1 }}>
                <View style={[st.iconCircle, { backgroundColor: C.greenSoft }]}>
                  <Icon name={def.icon} size={20} color={C.green} />
                </View>
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={FONT.h3}>{def.name}</Text>
                  <Text style={FONT.tiny}>{daysLeft} {daysLeft === 1 ? 'day' : 'days'} left</Text>
                </View>
              </Row>
              <Pill text={`+${Math.round(def.boost * 100)}%`} color={C.green} bg={C.greenSoft} icon="trending-up" />
            </Row>
            <Progress pct={elapsed} color={C.green} style={{ marginTop: 12 }} />
            <Btn title={confirmCancel === a.id ? 'Confirm — end this campaign' : 'Cancel campaign'}
              kind={confirmCancel === a.id ? 'danger' : 'ghost'} small icon="bullhorn-off" style={{ marginTop: 10 }}
              onPress={() => {
                if (confirmCancel === a.id) {
                  const r = cancelCampaign(a.id);
                  toast(r.ok ? (r.refund > 0 ? `Cancelled — ${inr(r.refund)} refunded` : 'Cancelled') : r.err, r.ok ? 'success' : 'error');
                  setConfirmCancel(null);
                } else setConfirmCancel(a.id);
              }} />
          </Card>
        );
      })}

      <Btn title="Launch New Campaign" icon="rocket-launch-outline" kind="green" onPress={() => setView('launch')} />
    </ScrollView>
  );
}

// ============================== 6. REWARDS ==============================
// Daily login streak, achievements and hidden-gem progress in one place —
// everything the game pays you for showing up.
const STREAK_MAX = 30;

function TierDots({ reached, total }) {
  return (
    <Row style={{ gap: 3 }}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={{
          width: 7, height: 7, borderRadius: 4,
          backgroundColor: i < reached ? C.gold : C.border,
        }} />
      ))}
    </Row>
  );
}

export function RewardsTab({ onOpenGames }) {
  const login = useGame(s => s.login || { streak: 0, lastDay: '' });
  const gold = useGame(s => s.gold);
  const state = useGame(s => s);
  const unlocked = state.achievements?.unlocked || {};
  const found = state.easterEggs?.found || [];
  const tapStreakEgg = useEasterEggTap('streak_freak', 11);
  const [showAll, setShowAll] = useState(false);
  const weeklyProgress = useGame(s => s.weeklyProgress);
  const claimWeekly = useGame(s => s.claimWeekly);
  const weekly = useGame(s => s.weekly);
  const dailyProgress = useGame(s => s.dailyProgress);
  const claimDaily = useGame(s => s.claimDaily);
  const daily = useGame(s => s.daily);
  const questProgress = useGame(s => s.questProgress);
  const claimQuest = useGame(s => s.claimQuest);
  const [questsExpanded, setQuestsExpanded] = useState(false);
  const claimStockRemovalGift = useGame(s => s.claimStockRemovalGift);
  const giftClaimed = useGame(s => s.settings?.stockRemovalGiftClaimed);
  const toast = useToast();
  const xp = companyXP(state);
  const level = companyLevelOf(xp);
  const nextXp = companyXpForLevel(level + 1);
  const curXp = companyXpForLevel(level);
  const deliveriesActive = useGame(s => s.deliveries.length);
  useNow(deliveriesActive > 0); // 1s re-render: weekly/daily km/₹ tick LIVE while trucks drive
  const weeklyList = weeklyProgress();
  const dailyList = dailyProgress();
  const questList = questProgress();
  const activeQuest = questList.find(q => q.active);
  const questsDone = questList.filter(q => q.claimed).length;
  const sweepDone = weekly && weekly.claimed.length === (weekly.challenges || []).length && weekly.challenges.length > 0;
  const dailySweepDone = daily && daily.claimed.length === (daily.challenges || []).length && daily.challenges.length > 0;

  const streak = login.streak || 0;
  const todayReward = streakRewardFor(Math.max(streak, 1));
  const tomorrowReward = streakRewardFor(streak + 1);
  const claimedToday = login.lastDay === new Date().toDateString();

  const doneTiers = Object.keys(unlocked).length;
  const totalTiers = ACHIEVEMENTS.length * 5;
  const nextHint = EASTER_EGGS.find(e => !found.includes(e.id));

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
      {/* ---- Stock Market removal thank-you gift (one-time claim) ---- */}
      {!giftClaimed && (
        <Card style={{ marginBottom: 12, backgroundColor: '#111827', borderColor: '#1F2937' }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row style={{ flex: 1 }}>
              <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#3B2F0B', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="gift" size={24} color="#F4D35E" />
              </View>
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={[FONT.h3, { color: '#F8FAFC' }]}>A thank-you for your patience</Text>
                <Text style={[FONT.tiny, { color: '#94A3B8', marginTop: 2 }]}>The Stock Market's gone — here's ₹2 Crore + 123 Gold on us.</Text>
              </View>
            </Row>
          </Row>
          <Btn title="Claim ₹2,00,00,000 + 123 Gold" kind="green" icon="gift" style={{ marginTop: 12 }}
            onPress={() => { const r = claimStockRemovalGift(); toast(r.ok ? 'Gift claimed!' : r.err, r.ok ? 'success' : 'error'); }} />
        </Card>
      )}

      {/* ---- Daily streak hero ---- */}
      <Card style={{ marginBottom: 12, backgroundColor: '#0F172A', borderColor: '#1E293B' }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row style={{ flex: 1 }}>
            <Pressable onPress={tapStreakEgg}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#7C2D12', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="fire" size={30} color="#FB923C" />
              </View>
            </Pressable>
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={[FONT.h2, { color: '#F8FAFC' }]}>{streak} day streak</Text>
              <Text style={[FONT.tiny, { color: '#94A3B8' }]}>
                {claimedToday ? `${todayReward.label} claimed today` : 'Open the game daily to keep it alive'}
                {streak >= STREAK_MAX ? ' · calendar complete!' : ` · tomorrow: ${tomorrowReward.label}`}
              </Text>
            </View>
          </Row>
          <Row><Icon name="gold" size={15} color={C.gold} /><Text style={[FONT.h3, { color: C.gold, marginLeft: 4 }]}>{gold}</Text></Row>
        </Row>
        {/* 30-day reward calendar — every day shows its ACTUAL reward icon:
            gold, cash, speed boost, shield, 2× trip, and the day-30 chest. */}
        <View style={{ marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 }}>
          {STREAK_REWARDS.map(rw => {
            const hit = streak >= rw.day;
            const isNext = streak + 1 === rw.day && !claimedToday;
            const mega = rw.type === 'mega';
            return (
              <View key={rw.day} style={{ width: '16%', alignItems: 'center' }}>
                <View style={{
                  width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: hit ? '#7C2D12' : mega ? '#3B2F0B' : '#1E293B',
                  borderWidth: isNext || mega ? 1.5 : 0, borderColor: mega ? '#F4D35E' : '#FB923C',
                }}>
                  {hit ? <Icon name="check-bold" size={15} color="#FB923C" />
                    : <Icon name={rw.icon} size={16} color={mega ? '#F4D35E' : rw.type === 'gold' ? '#C9A227' : rw.type === 'cash' ? '#4ADE80' : '#7DA9F5'} />}
                </View>
                <Text style={[FONT.tiny, { color: '#64748B', marginTop: 2, fontSize: 8 }]} numberOfLines={1}>
                  {rw.day}· {rw.type === 'gold' ? `${rw.amount}G` : rw.type === 'cash' ? inrShort(rw.amount) : rw.type === 'mega' ? 'MEGA' : rw.type === 'speed' ? '2×spd' : rw.type === 'shield' ? 'shield' : '2×trip'}
                </Text>
              </View>
            );
          })}
        </View>
        <Text style={[FONT.tiny, { color: '#64748B', marginTop: 8, textAlign: 'center' }]}>
          Best streak: {Math.max(login.bestStreak || 0, streak)} days · miss a day and the flame resets to day 1
        </Text>
      </Card>

      {/* ---- Company level ---- */}
      <Card style={{ marginBottom: 12 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row style={{ flex: 1 }}>
            <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: C.blueSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="medal" size={24} color={C.blue} />
            </View>
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={FONT.h3}>Level {level} · {companyTitleOf(level)}</Text>
              <Text style={FONT.tiny}>{(xp - curXp).toLocaleString('en-IN')} / {(nextXp - curXp).toLocaleString('en-IN')} XP to "{companyTitleOf(level + 1)}"</Text>
            </View>
          </Row>
          <Pill text={`+${(level + 1) * 10}G next`} color={C.gold} bg={C.amberSoft} icon="gold" />
        </Row>
        <Progress pct={((xp - curXp) / Math.max(1, nextXp - curXp)) * 100} color={C.blue} style={{ marginTop: 10 }} />
        <Text style={[FONT.tiny, { marginTop: 6 }]}>Everything earns XP — revenue, deliveries, km, garages, trucks. Each level pays a one-time gold reward.</Text>
      </Card>

      {/* ---- Career quests — permanent questline, one active step at a time ---- */}
      <SectionTitle icon="map-marker-path" text={`Career Quests — ${questsDone}/${QUEST_CHAIN.length}`}
        right={questsDone === QUEST_CHAIN.length ? <Pill text="ALL DONE!" icon="crown" color={C.gold} bg={C.amberSoft} /> : null} />
      <Card style={{ marginBottom: 12 }}>
        {activeQuest ? (
          <>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row style={{ flex: 1, marginRight: 8 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.blueSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={activeQuest.icon} size={20} color={C.blue} />
                </View>
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={[FONT.h3]} numberOfLines={1}>{activeQuest.title}</Text>
                  <Text style={FONT.tiny} numberOfLines={2}>{activeQuest.flavor}</Text>
                </View>
              </Row>
            </Row>
            <Text style={[FONT.tiny, { marginTop: 8 }]}>
              {Math.min(activeQuest.progress, activeQuest.target).toLocaleString('en-IN')} / {activeQuest.target.toLocaleString('en-IN')} · pays +{activeQuest.gold}G + {inrShort(activeQuest.cash)}
            </Text>
            <Progress pct={Math.min(100, (activeQuest.progress / activeQuest.target) * 100)} color={C.blue} style={{ marginTop: 8 }} height={4} />
            <Btn title={activeQuest.progress >= activeQuest.target ? 'Claim reward!' : 'In progress…'} kind={activeQuest.progress >= activeQuest.target ? 'green' : 'soft'}
              small disabled={activeQuest.progress < activeQuest.target} style={{ marginTop: 10, alignSelf: 'flex-start' }}
              onPress={() => { const r = claimQuest(activeQuest.id); toast(r.ok ? (r.allDone ? 'Questline complete!' : 'Quest reward claimed!') : r.err, r.ok ? 'success' : 'error'); }} />
          </>
        ) : (
          <Row><Icon name="crown" size={20} color={C.gold} /><Text style={[FONT.body, { marginLeft: 8, fontWeight: '700' }]}>Every career quest cleared — you've built a true transport empire!</Text></Row>
        )}
        <Pressable onPress={() => setQuestsExpanded(v => !v)} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
          <Icon name={questsExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={C.sub} />
          <Text style={[FONT.tiny, { marginLeft: 4, fontWeight: '700' }]}>{questsExpanded ? 'Hide' : 'Show'} full questline ({QUEST_CHAIN.length} steps)</Text>
        </Pressable>
        {questsExpanded && (
          <View style={{ marginTop: 8 }}>
            {questList.map((q, i) => (
              <Row key={q.id} style={[{ paddingVertical: 6 }, i > 0 && st.divider]}>
                <Icon name={q.claimed ? 'check-circle' : q.active ? q.icon : 'lock-outline'}
                  size={16} color={q.claimed ? C.green : q.active ? C.blue : C.faint} />
                <Text style={[FONT.tiny, { marginLeft: 8, flex: 1, fontWeight: q.active ? '700' : '400', color: q.claimed || q.active ? C.text : C.faint }]} numberOfLines={1}>
                  {q.title} — {q.target.toLocaleString('en-IN')} {q.key === 'revenue' ? 'revenue' : q.key === 'km' ? 'km' : q.key === 'fleetSize' ? 'trucks' : q.key === 'hubCount' ? 'hubs' : q.key}
                </Text>
                <Text style={[FONT.tiny, { color: C.faint }]}>+{q.gold}G</Text>
              </Row>
            ))}
          </View>
        )}
      </Card>

      {/* ---- Daily challenges ---- */}
      <SectionTitle icon="calendar-today" text={`Daily Challenges${daily ? ` — ${daily.claimed.length}/${daily.challenges.length}` : ''}`}
        right={dailySweepDone ? <Pill text="SWEPT!" icon="trophy-award" color={C.gold} bg={C.amberSoft} /> : null} />
      <Card style={{ marginBottom: 12 }}>
        {dailyList.length === 0 ? (
          <Text style={FONT.sub}>Today's challenges unlock on your next delivery day.</Text>
        ) : dailyList.map((ch, i) => {
          const done = ch.progress >= ch.target;
          return (
            <View key={ch.key} style={[{ paddingVertical: 10 }, i > 0 && st.divider]}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Row style={{ flex: 1, marginRight: 8 }}>
                  <Icon name={ch.icon} size={18} color={ch.claimed ? C.green : done ? C.gold : C.sub} />
                  <View style={{ marginLeft: 8, flex: 1 }}>
                    <Text style={[FONT.body, { fontWeight: '700' }]} numberOfLines={1}>{ch.label}</Text>
                    <Text style={FONT.tiny}>{Math.min(ch.progress, ch.target).toLocaleString('en-IN')} / {ch.target.toLocaleString('en-IN')} · pays +{ch.gold}G + {inrShort(ch.cash)}</Text>
                  </View>
                </Row>
                {ch.claimed
                  ? <Pill text="Claimed" icon="check-circle" color={C.green} bg={C.greenSoft} />
                  : <Btn title={done ? 'Claim!' : '—'} kind={done ? 'green' : 'soft'} small disabled={!done}
                      onPress={() => { const r = claimDaily(ch.key); toast(r.ok ? (r.sweep ? 'DAILY SWEEP! Bonus paid!' : 'Reward claimed!') : r.err, r.ok ? 'success' : 'error'); }} />}
              </Row>
              <Progress pct={Math.min(100, (ch.progress / ch.target) * 100)} color={ch.claimed ? C.green : C.blue} style={{ marginTop: 8 }} height={4} />
            </View>
          );
        })}
        <Row style={{ marginTop: 8, backgroundColor: C.amberSoft, borderRadius: RADIUS.md, padding: 10 }}>
          <Icon name="trophy-award" size={16} color={C.gold} />
          <Text style={[FONT.tiny, { marginLeft: 6, flex: 1, color: C.text }]}>
            Resets every calendar day. Clean sweep bonus: finish all {daily?.challenges?.length || DAILY_CHALLENGE_COUNT} today for an extra +{DAILY_JACKPOT.gold} Gold + {inrShort(DAILY_JACKPOT.cash)}!
          </Text>
        </Row>
      </Card>

      {/* ---- Weekly challenges ---- */}
      <SectionTitle icon="calendar-week" text={`Weekly Challenges${weekly ? ` — ${weekly.claimed.length}/${weekly.challenges.length}` : ''}`}
        right={sweepDone ? <Pill text="SWEPT!" icon="trophy-award" color={C.gold} bg={C.amberSoft} /> : null} />
      <Card style={{ marginBottom: 12 }}>
        {weeklyList.length === 0 ? (
          <Text style={FONT.sub}>This week's challenges unlock on your next delivery day.</Text>
        ) : weeklyList.map((ch, i) => {
          const done = ch.progress >= ch.target;
          return (
            <View key={ch.key} style={[{ paddingVertical: 10 }, i > 0 && st.divider]}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Row style={{ flex: 1, marginRight: 8 }}>
                  <Icon name={ch.icon} size={18} color={ch.claimed ? C.green : done ? C.gold : C.sub} />
                  <View style={{ marginLeft: 8, flex: 1 }}>
                    <Text style={[FONT.body, { fontWeight: '700' }]} numberOfLines={1}>{ch.label}</Text>
                    <Text style={FONT.tiny}>{Math.min(ch.progress, ch.target).toLocaleString('en-IN')} / {ch.target.toLocaleString('en-IN')} · pays +{ch.gold}G + {inrShort(ch.cash)}</Text>
                  </View>
                </Row>
                {ch.claimed
                  ? <Pill text="Claimed" icon="check-circle" color={C.green} bg={C.greenSoft} />
                  : <Btn title={done ? 'Claim!' : '—'} kind={done ? 'green' : 'soft'} small disabled={!done}
                      onPress={() => { const r = claimWeekly(ch.key); toast(r.ok ? (r.sweep ? 'CLEAN SWEEP! Jackpot paid!' : 'Reward claimed!') : r.err, r.ok ? 'success' : 'error'); }} />}
              </Row>
              <Progress pct={Math.min(100, (ch.progress / ch.target) * 100)} color={ch.claimed ? C.green : C.blue} style={{ marginTop: 8 }} height={4} />
            </View>
          );
        })}
        <Row style={{ marginTop: 8, backgroundColor: C.amberSoft, borderRadius: RADIUS.md, padding: 10 }}>
          <Icon name="trophy-award" size={16} color={C.gold} />
          <Text style={[FONT.tiny, { marginLeft: 6, flex: 1, color: C.text }]}>
            Counts LIVE across the whole fleet — km and ₹ tick up while trucks are still driving. Clean sweep bonus: finish all {weekly?.challenges?.length || WEEKLY_CHALLENGE_COUNT} this week for an extra +{WEEKLY_JACKPOT.gold} Gold + {inrShort(WEEKLY_JACKPOT.cash)}!
          </Text>
        </Row>
      </Card>

      {/* ---- Free gold quick actions ---- */}
      <Row style={{ gap: 8, marginBottom: 14 }}>
        <View style={{ flex: 1 }}>
          <Btn title="Mini-Games" icon="dice-multiple" kind="green" onPress={() => onOpenGames && onOpenGames()} />
        </View>
      </Row>

      {/* ---- Achievements ---- */}
      <SectionTitle icon="trophy" text={`Achievements — ${doneTiers}/${totalTiers} tiers`} />
      <Card style={{ marginBottom: 14 }}>
        {(showAll ? ACHIEVEMENTS : ACHIEVEMENTS.slice(0, 8)).map((a, idx) => {
          const v = achievementValue(state, a.id);
          let reached = 0;
          for (let t = 0; t < a.levels.length; t++) if (unlocked[`${a.id}:${t}`]) reached = t + 1;
          const next = reached < a.levels.length ? a.levels[reached] : null;
          const pct = next ? Math.min(100, (v / next) * 100) : 100;
          return (
            <View key={a.id} style={[{ paddingVertical: 10 }, idx > 0 && st.divider]}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Row style={{ flex: 1, marginRight: 8 }}>
                  <Icon name={a.icon} size={19} color={reached > 0 ? C.gold : C.sub} />
                  <View style={{ marginLeft: 9, flex: 1 }}>
                    <Row style={{ justifyContent: 'space-between' }}>
                      <Text style={[FONT.body, { fontWeight: '700' }]} numberOfLines={1}>{a.title}</Text>
                      <TierDots reached={reached} total={a.levels.length} />
                    </Row>
                    <Text style={FONT.tiny} numberOfLines={1}>
                      {next != null
                        ? `${v.toLocaleString('en-IN')} / ${next.toLocaleString('en-IN')} ${a.unit} → ${ACHIEVEMENT_TIERS[reached]} (+${ACHIEVEMENT_TIER_GOLD[reached]}G)`
                        : `Legend complete — ${v.toLocaleString('en-IN')} ${a.unit}`}
                    </Text>
                  </View>
                </Row>
              </Row>
              <Progress pct={pct} color={reached >= a.levels.length ? C.gold : C.blue} style={{ marginTop: 6 }} height={4} />
            </View>
          );
        })}
        <Btn title={showAll ? 'Show less' : `Show all ${ACHIEVEMENTS.length} tracks`} kind="soft" small
          icon={showAll ? 'chevron-up' : 'chevron-down'} style={{ marginTop: 8 }} onPress={() => setShowAll(v => !v)} />
      </Card>

      {/* ---- Hidden gems ---- */}
      <SectionTitle icon="diamond-stone" text={`Hidden Gems — ${found.length}/${EASTER_EGGS.length}`} />
      <Card>
        <Progress pct={(found.length / EASTER_EGGS.length) * 100} color={C.gold} style={{ marginBottom: 10 }} />
        <Text style={FONT.sub}>
          {found.length === EASTER_EGGS.length
            ? 'Every gem found. You know this app better than its developer.'
            : nextHint ? `Next clue: "${nextHint.hint}"` : ''}
        </Text>
        <Text style={[FONT.tiny, { marginTop: 6 }]}>Each gem pays ₹10 lakhs + 15 Gold, once. The full checklist lives in Settings → Hidden Gems.</Text>
      </Card>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  iconCircle: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
  },
  // Small "pledged to bank" badge — same corner-circle treatment as an
  // on-road incident badge, distinct icon/color so it never gets confused
  // with one.
  badgeDot: {
    position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: 9,
    backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: C.bg,
  },
  pickerBox: {
    marginTop: 10, backgroundColor: C.bgSoft, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: C.border, padding: 6,
  },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 9, paddingHorizontal: 8, borderRadius: RADIUS.sm,
  },
  divider: { borderTopWidth: 1, borderTopColor: C.border },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 22, borderWidth: 1, borderColor: C.border, backgroundColor: '#fff',
    flexShrink: 0, flexGrow: 0,
  },
  filterCount: { marginLeft: 6, minWidth: 20, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10, alignItems: 'center' },
  loadMore: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, marginTop: 2, borderRadius: 22, borderWidth: 1, borderColor: C.border, backgroundColor: C.bgSoft,
  },
});
