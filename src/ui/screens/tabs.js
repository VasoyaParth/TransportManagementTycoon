// Dashboard tab panels — Fleet / Routes / Staff / Economy / Marketing.
// Each is a scrollable panel rendered inside a bottom sheet.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, FlatList, Pressable, StyleSheet } from 'react-native';
import { C, FONT, RADIUS } from '../theme';
import {
  Card, Btn, IconBtn, Pill, statusMeta, Progress, Money, Stat, Row, Icon, useToast, relTime, GameSlider, Sheet, useEasterEggTap,
} from '../components';
import Svg from 'react-native-svg';
import {
  useGame, modelById, cargoById, GAME_HOUR_MS, staffMood,
  ACHIEVEMENTS, ACHIEVEMENT_TIERS, ACHIEVEMENT_TIER_GOLD, achievementValue, EASTER_EGGS,
  LOAN_PRODUCTS, creditScoreOf, DRIVER_PERKS, driverLevel, driverXpForLevel,
  companyXP, companyLevelOf, companyXpForLevel, companyTitleOf, WEEKLY_JACKPOT,
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
const FLEET_ICON = 42;
function FleetTruckArt({ model, color }) {
  const bt = bodyTypeFor(model);
  const body = color || defaultBodyColor(model);
  const { w, h } = truckShapes(bt, body, '#9DB2D6');
  const scale = ((FLEET_ICON - 6) / h) * sizeScaleFor(model);
  return (
    <View style={{ width: FLEET_ICON, height: FLEET_ICON, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={w * scale} height={h * scale} viewBox={`0 0 ${w} ${h}`}>
        <TruckTopShapes type={bt} body={body} accent="#9DB2D6" />
      </Svg>
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

// Pill-shaped filter tabs (used by Fleet & Staff). options: [{key,label,count}]
function FilterChips({ options, value, onChange }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 12 }}>
      <Row style={{ gap: 6 }}>
        {options.map(o => {
          const on = value === o.key;
          return (
            <Pressable key={o.key} onPress={() => { haptic('light'); onChange(o.key); }}
              style={[st.filterChip, on && { backgroundColor: C.blue, borderColor: C.blue }]}>
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: on ? '#fff' : C.sub }} numberOfLines={1}>{o.label}</Text>
              {o.count != null && (
                <View style={[st.filterCount, { backgroundColor: on ? 'rgba(255,255,255,0.25)' : C.bgSoft }]}>
                  <Text style={{ fontSize: 10.5, fontWeight: '800', color: on ? '#fff' : C.sub }} numberOfLines={1}>{o.count}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </Row>
    </ScrollView>
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
export function FleetTab({ onTruckPress, onBuyTruck }) {
  const trucks = useGame(s => s.trucks);
  const deliveries = useGame(s => s.deliveries);
  const hasLive = trucks.some(t => t.status === 'delivering' || t.status === 'building');
  const now = useNow(hasLive);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [filter]);

  const counts = useMemo(() => {
    const c = { delivering: 0, parked: 0, building: 0, broken: 0 };
    trucks.forEach(t => { c[t.status] = (c[t.status] || 0) + 1; });
    return c;
  }, [trucks]);

  const filtered = useMemo(
    () => (filter === 'all' ? trucks : trucks.filter(t => t.status === filter)),
    [trucks, filter]
  );
  const visible = filtered.slice(0, page * FLEET_PAGE);
  const filterOpts = [
    { key: 'all', label: 'All', count: trucks.length },
    { key: 'delivering', label: 'Running', count: counts.delivering },
    { key: 'parked', label: 'Parked', count: counts.parked },
    { key: 'building', label: 'Building', count: counts.building },
    { key: 'broken', label: 'Broken', count: counts.broken },
  ];

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
            <View style={[st.iconCircle, { backgroundColor: meta.bg }]}>
              <FleetTruckArt model={model} color={t.color} />
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
          <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={FONT.h2}>Fleet</Text>
            <Btn title="Buy Truck" icon="plus" small onPress={() => onBuyTruck && onBuyTruck()} />
          </Row>
          <FilterChips options={filterOpts} value={filter} onChange={setFilter} />
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
          <EmptyState icon="truck-outline" title="None in this filter" sub="Try a different status filter above." />
        )
      }
    />
  );
}

// ============================== 2. ROUTES ==============================
const ROUTE_SORTS = [
  { key: 'eta', label: 'ETA' },
  { key: 'distance', label: 'Distance' },
  { key: 'profit', label: 'Profit' },
];

export function RoutesTab({ onTrack, onNewDelivery }) {
  const deliveries = useGame(s => s.deliveries);
  const history = useGame(s => s.history);
  const trucks = useGame(s => s.trucks);
  const now = useNow(deliveries.length > 0);
  const [sort, setSort] = useState('eta');
  const [histSort, setHistSort] = useState('recent');

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

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
      <SectionTitle icon="routes" text="Active Deliveries" />
      {deliveries.length > 0 && (
        <FilterChips options={ROUTE_SORTS.map(o => ({ key: o.key, label: `Sort: ${o.label}` }))} value={sort} onChange={setSort} />
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
                <Text style={FONT.h3} numberOfLines={1}>{model ? model.name : 'Truck'}</Text>
                <Row style={{ marginTop: 3 }}>
                  <Text style={FONT.sub}>{from ? from.name : '?'}</Text>
                  <Icon name="arrow-right" size={13} color={C.faint} style={{ marginHorizontal: 5 }} />
                  <Text style={FONT.sub}>{to ? to.name : '?'}</Text>
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

      <SectionTitle icon="history" text="Recent Deliveries" />
      {history.length > 0 && (
        <FilterChips
          options={[
            { key: 'recent', label: 'Sort: Recent' },
            { key: 'profit', label: 'Sort: Profit' },
            { key: 'distance', label: 'Sort: Distance' },
          ]}
          value={histSort} onChange={setHistSort}
        />
      )}
      {history.length === 0 ? (
        <Text style={[FONT.sub, { textAlign: 'center', paddingVertical: 16 }]}>Completed deliveries will appear here.</Text>
      ) : sortedHistory.map(h => {
        const from = cityById(h.fromCityId);
        const to = cityById(h.toCityId);
        return (
          <Card key={h.id} style={{ marginBottom: 8, padding: 12 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Row>
                  <Text style={FONT.body} numberOfLines={1}>{from ? from.name : '?'}</Text>
                  <Icon name="arrow-right" size={12} color={C.faint} style={{ marginHorizontal: 4 }} />
                  <Text style={FONT.body} numberOfLines={1}>{to ? to.name : '?'}</Text>
                </Row>
                <Text style={FONT.tiny}>{h.km} km · {relTime(h.ts)}</Text>
              </View>
              <Text style={[FONT.mono, { fontWeight: '700', color: h.net >= 0 ? C.green : C.red }]}>{inr(h.net)}</Text>
            </Row>
          </Card>
        );
      })}
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
            <Row style={{ marginTop: 3, flexWrap: 'wrap' }}>
              <Pill
                text={`${level ? level.name : member.level} ${role ? role.name : member.role}`}
                icon={role ? role.icon : 'account'}
              />
              {/* Mood — tired after a trip, energetic when rested, busy when fixing */}
              {(() => { const mood = staffMood(member, { trucks, deliveries }); return (
                <View style={{ marginLeft: 6 }}>
                  <Pill text={mood.label} icon={mood.icon} color={mood.color} bg={mood.color + '22'} />
                </View>
              ); })()}
              {member.role === 'driver' ? (
                <View style={{ marginLeft: 6 }}>
                  <Pill text={`Lv ${driverLevel(member.xp)}`} icon="star" color={C.gold} bg={C.amberSoft} />
                </View>
              ) : null}
              {(member.promoBoostUntil || 0) > Date.now() ? (
                <View style={{ marginLeft: 6 }}>
                  <Pill text="2× promo boost" icon="rocket-launch" color={C.gold} bg={C.amberSoft} />
                </View>
              ) : null}
            </Row>
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

  const [role, setRole] = useState('all');
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [role]);

  const [hireRole, setHireRole] = useState('all');
  const [hireSort, setHireSort] = useState('skill');

  // Managers are disabled for now (no gameplay use yet) — their filter chips
  // and counts are commented out below; restore when managers get a purpose.
  const counts = useMemo(() => ({
    driver: staff.filter(x => x.role === 'driver').length,
    mechanic: staff.filter(x => x.role === 'mechanic').length,
    // manager: staff.filter(x => x.role === 'manager').length,
    salary: staff.reduce((a, x) => a + x.salary, 0),
  }), [staff]);

  const roster = role === 'all' ? staff.filter(x => x.role !== 'manager') : staff.filter(x => x.role === role);
  const shown = roster.slice(0, page * STAFF_PAGE);
  const roleOpts = [
    { key: 'all', label: 'All', count: staff.filter(x => x.role !== 'manager').length },
    { key: 'driver', label: 'Drivers', count: counts.driver },
    { key: 'mechanic', label: 'Mechanics', count: counts.mechanic },
    // { key: 'manager', label: 'Managers', count: counts.manager },
  ];

  const candCounts = useMemo(() => ({
    driver: candidates.filter(x => x.role === 'driver').length,
    mechanic: candidates.filter(x => x.role === 'mechanic').length,
    // manager: candidates.filter(x => x.role === 'manager').length,
  }), [candidates]);
  const hireRoleOpts = [
    { key: 'all', label: 'All', count: candidates.filter(x => x.role !== 'manager').length },
    { key: 'driver', label: 'Drivers', count: candCounts.driver },
    { key: 'mechanic', label: 'Mechanics', count: candCounts.mechanic },
    // { key: 'manager', label: 'Managers', count: candCounts.manager },
  ];
  const filteredCandidates = useMemo(() => {
    // managers filtered out while the role is disabled
    const pool = candidates.filter(x => x.role !== 'manager');
    const arr = hireRole === 'all' ? [...pool] : pool.filter(x => x.role === hireRole);
    if (hireSort === 'skill') arr.sort((a, b) => b.skill - a.skill);
    else if (hireSort === 'salary-asc') arr.sort((a, b) => a.salary - b.salary);
    else if (hireSort === 'salary-desc') arr.sort((a, b) => b.salary - a.salary);
    else if (hireSort === 'bonus') arr.sort((a, b) => a.bonus - b.bonus);
    return arr;
  }, [candidates, hireRole, hireSort]);

  // Two screens like Fleet -> Buy Truck: default roster ("My Staff"), and a
  // dedicated Hire screen you switch into with the header button.
  const [screen, setScreen] = useState('mine'); // 'mine' | 'hire'

  if (screen === 'mine') {
    return (
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={FONT.h2}>My Staff</Text>
          <Btn title="Hire Staff" icon="account-plus" small onPress={() => setScreen('hire')} />
        </Row>
        <Row style={{ marginBottom: 8 }}>
          <Stat icon="account-group" label="Team" value={String(staff.length)} />
          <View style={{ width: 8 }} />
          <Stat icon="cash-clock" label="Salaries / mo" value={inrShort(counts.salary)} color={C.amber} />
        </Row>
        <FilterChips options={roleOpts} value={role} onChange={setRole} />
        {staff.length === 0 ? (
          <EmptyState icon="account-group-outline" title="No staff yet" sub="Hire drivers and mechanics to grow your team."
            action={<Btn title="Hire Staff" icon="account-plus" small onPress={() => setScreen('hire')} />} />
        ) : roster.length === 0 ? (
          <EmptyState icon="account-search-outline" title="None in this role" sub="Switch the filter or hire more staff." />
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
      <FilterChips options={hireRoleOpts} value={hireRole} onChange={setHireRole} />
      <FilterChips
        options={[
          { key: 'skill', label: 'Sort: Skill' },
          { key: 'salary-asc', label: 'Sort: Salary Low-High' },
          { key: 'salary-desc', label: 'Sort: Salary High-Low' },
          { key: 'bonus', label: 'Sort: Signing Bonus' },
        ]}
        value={hireSort} onChange={setHireSort}
      />
      {candidates.length > 0 && filteredCandidates.length === 0 ? (
        <EmptyState icon="account-search-outline" title="None in this role" sub="Switch the filter to see other candidates." />
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
function LedgerSheet({ visible, onClose }) {
  const ledger = useGame(s => s.ledger || []);
  const tapLedgerEgg = useEasterEggTap('ledger_lord', 12);
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
        ) : groups.map(g => (
          <View key={g.day} style={{ marginBottom: 14 }}>
            <Row style={{ justifyContent: 'space-between', marginBottom: 6, paddingHorizontal: 2 }}>
              <Row>
                <Icon name="calendar" size={14} color={C.sub} />
                <Text style={[FONT.body, { fontWeight: '800', marginLeft: 5 }]}>Day {g.day}</Text>
              </Row>
              <Text style={[FONT.mono, { fontWeight: '800', color: g.net >= 0 ? C.green : C.red }]}>
                {g.net >= 0 ? '+' : '−'}{inrShort(Math.abs(g.net))}
              </Text>
            </Row>
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {g.entries.map((e, i) => (
                <Row key={e.id} style={[{ paddingVertical: 10, paddingHorizontal: 12, justifyContent: 'space-between' }, i > 0 && st.divider]}>
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
            </Card>
          </View>
        ))}
      </ScrollView>
    </Sheet>
  );
}

// Truck Empire Bank — credit score, loan products gated by score, active
// loans with EMI progress and early settlement. Premium dark banking look.
function BankSheet({ visible, onClose }) {
  const toast = useToast();
  const balance = useGame(s => s.balance);
  const loans = useGame(s => s.loans || []);
  const credit = useGame(s => s.credit);
  const takeLoan = useGame(s => s.takeLoan);
  const prepayLoan = useGame(s => s.prepayLoan);
  const [confirm, setConfirm] = useState(null);
  useEffect(() => { if (!visible) setConfirm(null); }, [visible]);
  const score = creditScoreOf(credit);
  const scorePct = ((score - 300) / 600) * 100;
  const scoreColor = score >= 720 ? C.green : score >= 600 ? C.amber : C.red;
  const scoreLabel = score >= 780 ? 'Excellent' : score >= 720 ? 'Very Good' : score >= 650 ? 'Good' : score >= 600 ? 'Fair' : 'Poor';

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

        {/* Active loans */}
        {loans.length > 0 && <SectionTitle icon="file-clock-outline" text="Active Loans" />}
        {loans.map(ln => {
          const p = LOAN_PRODUCTS.find(x => x.id === ln.productId);
          const done = ln.paidMonths / ln.months;
          const settle = Math.round(ln.remaining * 0.98);
          return (
            <Card key={ln.id} style={{ marginBottom: 10 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Row style={{ flex: 1 }}>
                  <Icon name={p?.icon || 'bank'} size={20} color={C.blue} />
                  <View style={{ marginLeft: 8, flex: 1 }}>
                    <Text style={[FONT.body, { fontWeight: '800' }]}>{ln.name}</Text>
                    <Text style={FONT.tiny}>EMI {inrShort(ln.emi)} / 30 days · {ln.paidMonths}/{ln.months} paid</Text>
                  </View>
                </Row>
                <Text style={[FONT.mono, { fontWeight: '800', color: C.red }]}>{inrShort(ln.remaining)}</Text>
              </Row>
              <Progress pct={done * 100} color={C.green} style={{ marginTop: 10 }} />
              <Btn title={confirm === ln.id ? `Confirm — pay ${inrShort(settle)}` : `Settle early · ${inrShort(settle)} (2% off)`}
                kind={balance >= settle ? 'soft' : 'ghost'} small icon="bank-check" style={{ marginTop: 10 }}
                disabled={balance < settle}
                onPress={() => {
                  if (confirm === ln.id) { const r = prepayLoan(ln.id); toast(r.ok ? 'Loan settled — credit score up!' : r.err, r.ok ? 'success' : 'error'); setConfirm(null); }
                  else setConfirm(ln.id);
                }} />
            </Card>
          );
        })}

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
                <View style={{ alignItems: 'center' }}><Text style={[FONT.body, { fontWeight: '800' }]}>{inrShort(Math.round(totalDue / p.months))}</Text><Text style={FONT.tiny}>EMI / 30d</Text></View>
                <View style={{ alignItems: 'center' }}><Text style={[FONT.body, { fontWeight: '800', color: score >= p.minScore ? C.green : C.red }]}>{p.minScore || '—'}</Text><Text style={FONT.tiny}>min score</Text></View>
              </Row>
              <Btn
                title={active ? 'Already running' : loans.length >= 2 && !active ? 'Loan limit reached (2)'
                  : score < p.minScore ? `Score too low (need ${p.minScore})`
                    : confirm === p.id ? `Confirm — borrow ${inrShort(p.amount)}` : `Apply · repay ${inrShort(totalDue)} total`}
                kind={eligible ? 'primary' : 'soft'} small={false} icon="bank-plus" disabled={!eligible}
                style={{ marginTop: 10 }}
                onPress={() => {
                  if (confirm === p.id) { const r = takeLoan(p.id); toast(r.ok ? `${p.name} approved — ${inrShort(p.amount)} credited!` : r.err, r.ok ? 'success' : 'error'); setConfirm(null); }
                  else setConfirm(p.id);
                }} />
            </Card>
          );
        })}
        <Card style={{ backgroundColor: C.amberSoft, marginTop: 4 }}>
          <Row>
            <Icon name="alert-circle-outline" size={14} color={C.amber} />
            <Text style={[FONT.tiny, { marginLeft: 6, flex: 1, color: C.text }]}>
              EMIs are auto-deducted every 30 game days with your monthly costs. A missed EMI adds 5% penalty interest and hurts your credit score.
            </Text>
          </Row>
        </Card>
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
  const savePricing = useGame(s => s.savePricing);
  const [priceEdit, setPriceEdit] = useState(null); // cargo id whose slider is open
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);
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
            <Btn title="Company Ledger" icon="notebook-outline" kind="soft" small
              style={{ backgroundColor: '#1E293B' }} onPress={() => setLedgerOpen(true)} />
          </View>
          <View style={{ flex: 1 }}>
            <Btn title={loans.length ? `Bank (${loans.length})` : 'Bank & Loans'} icon="bank" kind="soft" small
              style={{ backgroundColor: '#1E293B' }} onPress={() => setBankOpen(true)} />
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
        {/* 7-day price bars — today is the last (highlighted) bar */}
        <Row style={{ alignItems: 'flex-end', height: 46, marginTop: 10, gap: 4 }}>
          {fuel.history.map((f, i) => (
            <View key={i} style={{
              flex: 1, borderRadius: 3,
              height: 8 + ((f - 0.85) / 0.4) * 38,
              backgroundColor: i === fuel.history.length - 1 ? (f >= 1.12 ? C.red : f <= 0.95 ? C.green : C.blue) : C.border,
            }} />
          ))}
        </Row>
        <Text style={[FONT.tiny, { marginTop: 6, textAlign: 'center' }]}>
          Last 7 days · the market moves every game day and hits every delivery's fuel bill
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
          <Row style={{ alignItems: 'flex-end', height: 130, justifyContent: 'space-between' }}>
            {bars.map(b => {
              const h = Math.max(6, (Math.abs(b.net) / maxAbs) * 96);
              const tallest = Math.abs(b.net) === maxAbs;
              return (
                <View key={b.id} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', marginHorizontal: 3 }}>
                  {tallest ? (
                    <Text style={[FONT.tiny, { marginBottom: 3, fontWeight: '700', color: b.net >= 0 ? C.green : C.red }]} numberOfLines={1}>
                      {inrShort(b.net)}
                    </Text>
                  ) : null}
                  <View style={{
                    width: '100%', height: h, borderRadius: 4,
                    backgroundColor: b.net >= 0 ? C.green : C.red,
                    opacity: 0.9,
                  }} />
                </View>
              );
            })}
          </Row>
          <Text style={[FONT.tiny, { marginTop: 8, textAlign: 'center' }]}>Last {bars.length} deliveries — net profit</Text>
        </Card>
      )}

      <SectionTitle icon="tune" text="Freight Pricing (₹ / km · ton)" />
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

      <LedgerSheet visible={ledgerOpen} onClose={() => setLedgerOpen(false)} />
      <BankSheet visible={bankOpen} onClose={() => setBankOpen(false)} />
    </ScrollView>
  );
}

// ============================== 5. MARKETING ==============================
export function MarketingTab() {
  const campaigns = useGame(s => s.campaigns);
  const balance = useGame(s => s.balance);
  const settings = useGame(s => s.settings);
  const launchCampaign = useGame(s => s.launchCampaign);
  const toast = useToast();
  const active = campaigns.filter(a => a.endsAt > Date.now());
  const now = useNow(active.length > 0);
  const dayMs = 24 * GAME_HOUR_MS / settings.speed;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
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
          </Card>
        );
      })}

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
              <Pill text={`+${Math.round(def.boost * 100)}%`} color={C.green} bg={C.greenSoft} />
            </Row>
            <Row style={{ justifyContent: 'space-between', marginTop: 12 }}>
              <Text style={FONT.sub}>{inr(def.cost)} · {def.days} days</Text>
              <Btn
                title={isActive ? 'Running' : cannot ? 'Low funds' : 'Launch'}
                kind="blue" small disabled={disabled}
                onPress={() => {
                  const r = launchCampaign(def.id);
                  toast && toast(r.ok ? `${def.name} launched!` : r.err, r.ok ? 'success' : 'error');
                }}
              />
            </Row>
          </Card>
        );
      })}
    </ScrollView>
  );
}

// ============================== 6. REWARDS ==============================
// Daily login streak, achievements and hidden-gem progress in one place —
// everything the game pays you for showing up.
const STREAK_MAX = 7;

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
  const toast = useToast();
  const xp = companyXP(state);
  const level = companyLevelOf(xp);
  const nextXp = companyXpForLevel(level + 1);
  const curXp = companyXpForLevel(level);
  const weeklyList = weeklyProgress();
  const sweepDone = weekly && weekly.claimed.length === (weekly.challenges || []).length && weekly.challenges.length > 0;

  const streak = login.streak || 0;
  const todayBonus = Math.min(Math.max(streak, 1), STREAK_MAX) * 2;
  const tomorrowBonus = Math.min(streak + 1, STREAK_MAX) * 2;
  const claimedToday = login.lastDay === new Date().toDateString();

  const doneTiers = Object.keys(unlocked).length;
  const totalTiers = ACHIEVEMENTS.length * 5;
  const nextHint = EASTER_EGGS.find(e => !found.includes(e.id));

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
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
                {claimedToday ? `+${todayBonus} Gold claimed today` : 'Open the game daily to keep it alive'}
                {streak >= STREAK_MAX ? ' · MAX bonus!' : ` · tomorrow pays +${tomorrowBonus}`}
              </Text>
            </View>
          </Row>
          <Row><Icon name="gold" size={15} color={C.gold} /><Text style={[FONT.h3, { color: C.gold, marginLeft: 4 }]}>{gold}</Text></Row>
        </Row>
        {/* 7-day track */}
        <Row style={{ marginTop: 14, justifyContent: 'space-between' }}>
          {Array.from({ length: STREAK_MAX }, (_, i) => {
            const day = i + 1;
            const hit = streak >= day;
            return (
              <View key={day} style={{ alignItems: 'center', flex: 1 }}>
                <View style={{
                  width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: hit ? '#7C2D12' : '#1E293B',
                  borderWidth: streak + 1 === day && !claimedToday ? 1.5 : 0, borderColor: '#FB923C',
                }}>
                  {hit ? <Icon name="check-bold" size={15} color="#FB923C" />
                    : <Text style={[FONT.tiny, { color: '#64748B', fontWeight: '800' }]}>+{day * 2}</Text>}
                </View>
                <Text style={[FONT.tiny, { color: '#64748B', marginTop: 3, fontSize: 9 }]}>D{day}</Text>
              </View>
            );
          })}
        </Row>
        <Text style={[FONT.tiny, { color: '#64748B', marginTop: 8, textAlign: 'center' }]}>
          Best streak: {Math.max(login.bestStreak || 0, streak)} days · miss a day and the flame resets
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
            Clean sweep bonus: finish all 3 this week for an extra +{WEEKLY_JACKPOT.gold} Gold + {inrShort(WEEKLY_JACKPOT.cash)}!
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
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 22, borderWidth: 1, borderColor: C.border, backgroundColor: '#fff',
    flexShrink: 1,
  },
  filterCount: { marginLeft: 6, minWidth: 20, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10, alignItems: 'center' },
  loadMore: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, marginTop: 2, borderRadius: 22, borderWidth: 1, borderColor: C.border, backgroundColor: C.bgSoft,
  },
});
