// Dashboard tab panels — Fleet / Routes / Staff / Economy / Marketing / Collab.
// Each is a scrollable panel rendered inside a bottom sheet.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, FlatList, TextInput, Pressable, StyleSheet } from 'react-native';
import { C, FONT, RADIUS } from '../theme';
import {
  Card, Btn, IconBtn, Pill, statusMeta, Progress, Money, Stat, Row, Icon, useToast, relTime,
} from '../components';
import { useGame, modelById, cargoById, GAME_HOUR_MS } from '../../store/gameStore';
import { CAMPAIGNS, CARGO_TYPES } from '../../data/trucks';
import { STAFF_ROLES, STAFF_LEVELS, STAFF_AVATAR } from '../../data/staffNames';
import { inr, inrShort } from '../../engine/economy';
import { cityById } from '../../engine/routing';

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
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
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
            <Pressable key={o.key} onPress={() => onChange(o.key)}
              style={[st.filterChip, on && { backgroundColor: C.blue, borderColor: C.blue }]}>
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: on ? '#fff' : C.sub }}>{o.label}</Text>
              {o.count != null && (
                <View style={[st.filterCount, { backgroundColor: on ? 'rgba(255,255,255,0.25)' : C.bgSoft }]}>
                  <Text style={{ fontSize: 10.5, fontWeight: '800', color: on ? '#fff' : C.sub }}>{o.count}</Text>
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
    if (t.status === 'delivering') {
      const d = deliveries.find(x => x.truckId === t.id);
      if (d) livePct = clampPct(((now - d.startedAt) / (d.endsAt - d.startedAt)) * 100);
    } else if (t.status === 'building' && t.buildEndsAt) {
      buildLeft = Math.max(0, Math.ceil((t.buildEndsAt - now) / 1000));
    }
    return (
      <Card style={{ marginBottom: 10 }} onPress={() => onTruckPress && onTruckPress(t)}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row style={{ flex: 1 }}>
            <View style={[st.iconCircle, { backgroundColor: meta.bg }]}>
              <Icon name={model.icon} size={22} color={meta.color} />
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
            <Text style={[FONT.tiny, { color: fuelColor(t.fuelPct) }]}>{Math.round(t.fuelPct)}%</Text>
          </Row>
          <Progress pct={t.fuelPct} color={fuelColor(t.fuelPct)} />
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
export function RoutesTab({ onTrack, onNewDelivery }) {
  const deliveries = useGame(s => s.deliveries);
  const history = useGame(s => s.history);
  const trucks = useGame(s => s.trucks);
  const now = useNow(deliveries.length > 0);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
      <SectionTitle icon="routes" text="Active Deliveries" />
      {deliveries.length === 0 ? (
        <EmptyState
          icon="truck-outline"
          title="No active deliveries"
          sub="Dispatch a parked truck to start earning."
          action={<Btn title="New Delivery" icon="plus" small onPress={() => onNewDelivery && onNewDelivery()} />}
        />
      ) : deliveries.map(d => {
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
      {history.length === 0 ? (
        <Text style={[FONT.sub, { textAlign: 'center', paddingVertical: 16 }]}>Completed deliveries will appear here.</Text>
      ) : history.map(h => {
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
function StaffCard({ member, trucks, onAssign, onFire }) {
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

  return (
    <Card style={{ marginBottom: 10 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row style={{ flex: 1 }}>
          <View style={[st.iconCircle, { backgroundColor: C.blueSoft }]}>
            <Icon name={avatar} size={22} color={C.blue} />
          </View>
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={FONT.h3} numberOfLines={1}>{member.name}</Text>
            <Row style={{ marginTop: 3 }}>
              <Pill
                text={`${level ? level.name : member.level} ${role ? role.name : member.role}`}
                icon={role ? role.icon : 'account'}
              />
            </Row>
          </View>
        </Row>
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
export function StaffTab() {
  const staff = useGame(s => s.staff);
  const candidates = useGame(s => s.candidates);
  const trucks = useGame(s => s.trucks);
  const balance = useGame(s => s.balance);
  const hire = useGame(s => s.hire);
  const fire = useGame(s => s.fire);
  const assignDriver = useGame(s => s.assignDriver);
  const refreshCandidates = useGame(s => s.refreshCandidates);
  const toast = useToast();

  const [role, setRole] = useState('all');
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [role]);

  const counts = useMemo(() => ({
    driver: staff.filter(x => x.role === 'driver').length,
    mechanic: staff.filter(x => x.role === 'mechanic').length,
    manager: staff.filter(x => x.role === 'manager').length,
    salary: staff.reduce((a, x) => a + x.salary, 0),
  }), [staff]);

  const roster = role === 'all' ? staff : staff.filter(x => x.role === role);
  const shown = roster.slice(0, page * STAFF_PAGE);
  const roleOpts = [
    { key: 'all', label: 'All', count: staff.length },
    { key: 'driver', label: 'Drivers', count: counts.driver },
    { key: 'mechanic', label: 'Mechanics', count: counts.mechanic },
    { key: 'manager', label: 'Managers', count: counts.manager },
  ];

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
      <Row style={{ marginBottom: 8 }}>
        <Stat icon="account-group" label="Team" value={String(staff.length)} />
        <View style={{ width: 8 }} />
        <Stat icon="cash-clock" label="Salaries / mo" value={inrShort(counts.salary)} color={C.amber} />
      </Row>

      <SectionTitle icon="account-group" text="Roster" />
      <FilterChips options={roleOpts} value={role} onChange={setRole} />
      {staff.length === 0 ? (
        <EmptyState icon="account-group-outline" title="No staff yet" sub="Hire from the candidates below to grow your team." />
      ) : roster.length === 0 ? (
        <EmptyState icon="account-search-outline" title="None in this role" sub="Switch the filter or hire more staff below." />
      ) : (
        <>
          {shown.map(m => (
            <StaffCard
              key={m.id}
              member={m}
              trucks={trucks}
              onAssign={(mem, t) => { assignDriver(mem.id, t.id); toast && toast(`${mem.name} assigned to ${modelById(t.modelId).name}`, 'success'); }}
              onFire={mem => { fire(mem.id); toast && toast(`${mem.name} has been let go`, 'warn'); }}
            />
          ))}
          <LoadMore shown={shown.length} total={roster.length} onMore={() => setPage(p => p + 1)} />
        </>
      )}

      <SectionTitle
        icon="account-plus"
        text="Hire Staff"
        right={<IconBtn name="refresh" onPress={() => { refreshCandidates(); toast && toast('New candidates available', 'info'); }} />}
      />
      {candidates.map(c => {
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
export function EconomyTab() {
  const balance = useGame(s => s.balance);
  const gold = useGame(s => s.gold);
  const stats = useGame(s => s.stats);
  const staff = useGame(s => s.staff);
  const trucks = useGame(s => s.trucks);
  const history = useGame(s => s.history);
  const pricing = useGame(s => s.pricing);
  const savePricing = useGame(s => s.savePricing);

  const salaryBurden = useMemo(() => staff.reduce((a, x) => a + x.salary, 0), [staff]);
  const bars = useMemo(() => history.slice(0, 8).reverse(), [history]);
  const maxAbs = useMemo(() => Math.max(1, ...bars.map(b => Math.abs(b.net))), [bars]);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
      <Row style={{ marginBottom: 8 }}>
        <Stat icon="wallet" label="Balance" value={inrShort(balance)} color={balance >= 0 ? C.text : C.red} />
        <View style={{ width: 8 }} />
        <Stat icon="gold" label="Gold" value={String(gold)} color={C.gold} />
      </Row>
      <Row style={{ marginBottom: 8 }}>
        <Stat icon="chart-line" label="Lifetime Revenue" value={inrShort(stats.revenue)} color={C.green} />
        <View style={{ width: 8 }} />
        <Stat icon="gas-station" label="Fuel Spend" value={inrShort(stats.fuelSpend)} color={C.red} />
      </Row>
      <Row style={{ marginBottom: 8 }}>
        <Stat icon="package-variant-closed-check" label="Deliveries" value={String(stats.deliveries)} />
        <View style={{ width: 8 }} />
        <Stat icon="map-marker-distance" label="Distance" value={`${Math.round(stats.km).toLocaleString('en-IN')} km`} />
      </Row>
      <Row style={{ marginBottom: 14 }}>
        <Stat icon="cash-clock" label="Salary Burden / mo" value={inrShort(salaryBurden)} color={C.amber} />
        <View style={{ width: 8 }} />
        <Stat icon="truck" label="Fleet Size" value={String(trucks.length)} />
      </Row>

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

      <SectionTitle icon="tune" text="Pricing Configuration" />
      <Card>
        {CARGO_TYPES.map((cg, i) => {
          const v = pricing[cg.id] != null ? pricing[cg.id] : cg.rate;
          const round1 = n => Math.round(n * 10) / 10;
          return (
            <Row key={cg.id} style={[{ justifyContent: 'space-between', paddingVertical: 10 }, i > 0 && st.divider]}>
              <Row style={{ flex: 1 }}>
                <Icon name={cg.icon} size={18} color={C.sub} />
                <Text style={[FONT.body, { marginLeft: 8, flex: 1 }]} numberOfLines={1}>{cg.name}</Text>
              </Row>
              <Row>
                <IconBtn
                  name="minus-circle-outline"
                  color={v <= 2 ? C.faint : C.text}
                  onPress={() => { if (v > 2) savePricing({ [cg.id]: round1(v - 0.5) }); }}
                />
                <Text style={[FONT.mono, { fontWeight: '700', minWidth: 86, textAlign: 'center' }]}>₹{v}/km·t</Text>
                <IconBtn
                  name="plus-circle-outline"
                  color={v >= 20 ? C.faint : C.text}
                  onPress={() => { if (v < 20) savePricing({ [cg.id]: round1(v + 0.5) }); }}
                />
              </Row>
            </Row>
          );
        })}
      </Card>
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

// ============================== 6. COLLAB ==============================
const COLLAB_BENEFITS = [
  { icon: 'gas-station', text: 'Shared fuel stations' },
  { icon: 'file-document-multiple-outline', text: 'Shared contracts' },
  { icon: 'swap-horizontal', text: 'Cargo exchange' },
  { icon: 'bullhorn-outline', text: 'Combined marketing' },
  { icon: 'account-group-outline', text: 'Staff sharing' },
];

function PartnerRow({ partner, onEnd }) {
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (!confirm) return undefined;
    const id = setTimeout(() => setConfirm(false), 2500);
    return () => clearTimeout(id);
  }, [confirm]);
  return (
    <Card style={{ marginBottom: 8, padding: 12 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row style={{ flex: 1 }}>
          <View style={[st.iconCircle, { backgroundColor: C.blueSoft }]}>
            <Icon name="handshake" size={18} color={C.blue} />
          </View>
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={FONT.body} numberOfLines={1}>{partner.name}</Text>
            <Text style={FONT.tiny}>{partner.code} · partnered {relTime(partner.since)}</Text>
          </View>
        </Row>
        <Btn
          title={confirm ? 'Confirm?' : 'End'}
          kind="danger" small
          onPress={() => {
            if (confirm) { setConfirm(false); onEnd(partner); }
            else setConfirm(true);
          }}
        />
      </Row>
    </Card>
  );
}

export function CollabTab() {
  const company = useGame(s => s.company);
  const partners = useGame(s => s.partners);
  const addPartner = useGame(s => s.addPartner);
  const endPartner = useGame(s => s.endPartner);
  const toast = useToast();
  const [code, setCode] = useState('');

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
      <Card style={{ alignItems: 'center', paddingVertical: 22, marginBottom: 14 }}>
        <Text style={[FONT.tiny, { textTransform: 'uppercase', letterSpacing: 1 }]}>Your Company Code</Text>
        <Text style={[FONT.h1, { marginTop: 6, letterSpacing: 2 }]}>{company ? company.code : '—'}</Text>
        <Row style={{ marginTop: 6 }}>
          <Icon name="content-copy" size={13} color={C.faint} />
          <Text style={[FONT.tiny, { marginLeft: 4 }]}>Share this code with friends to partner up</Text>
        </Row>
      </Card>

      <SectionTitle icon="handshake-outline" text="Add a Partner" />
      <Card style={{ marginBottom: 14 }}>
        <TextInput
          value={code}
          onChangeText={t => setCode(t.toUpperCase())}
          placeholder="Enter partner code (e.g. TE-AB12C)"
          placeholderTextColor={C.faint}
          autoCapitalize="characters"
          autoCorrect={false}
          style={st.input}
        />
        <Btn
          title="Send Request" icon="send"
          disabled={!code.trim()}
          style={{ marginTop: 10 }}
          onPress={() => {
            const r = addPartner(code.trim());
            toast && toast(r.ok ? `Partnership request sent to ${code.trim()}` : r.err, r.ok ? 'success' : 'error');
            if (r.ok) setCode('');
          }}
        />
      </Card>

      <SectionTitle icon="account-multiple" text="Partners" />
      {partners.length === 0 ? (
        <EmptyState icon="handshake-outline" title="No partners yet" sub="Exchange codes with friends to build a logistics alliance." />
      ) : partners.map(p => (
        <PartnerRow
          key={p.code}
          partner={p}
          onEnd={pt => { endPartner(pt.code); toast && toast(`Partnership with ${pt.code} ended`, 'warn'); }}
        />
      ))}

      <SectionTitle icon="star-circle-outline" text="Partnership Benefits" />
      <Card>
        {COLLAB_BENEFITS.map((b, i) => (
          <Row key={b.text} style={[{ justifyContent: 'space-between', paddingVertical: 9 }, i > 0 && st.divider]}>
            <Row style={{ flex: 1 }}>
              <Icon name={b.icon} size={18} color={C.blue} />
              <Text style={[FONT.body, { marginLeft: 10 }]}>{b.text}</Text>
            </Row>
            <Pill text="Coming soon" color={C.amber} bg={C.amberSoft} icon="clock-outline" />
          </Row>
        ))}
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
  },
  filterCount: { marginLeft: 6, minWidth: 20, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10, alignItems: 'center' },
  loadMore: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, marginTop: 2, borderRadius: 22, borderWidth: 1, borderColor: C.border, backgroundColor: C.bgSoft,
  },
  input: {
    borderWidth: 1, borderColor: C.border, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 11, ...FONT.body,
    backgroundColor: C.bgSoft, letterSpacing: 1,
  },
});
