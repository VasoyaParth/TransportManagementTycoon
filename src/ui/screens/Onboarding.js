// Onboarding wizard — 9 steps per SRS (India-only launch).
import React, { useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, FlatList, ScrollView, Animated, Easing,
  StyleSheet, SafeAreaView, Pressable,
} from 'react-native';
import { C, FONT, SHADOW, RADIUS } from '../theme';
import { Btn, Card, Icon, Pill, Progress, Row } from '../components';
import { useGame } from '../../store/gameStore';
import { TRUCK_MODELS, LOGOS, AVATARS, COMPANY_NAME_IDEAS } from '../../data/trucks';
import { CITIES, STATES } from '../../data/cities';
import { inr, inrShort } from '../../engine/economy';

const STARTING_CAPITAL = 5000000;

const STEPS = [
  { key: 'continent', title: 'Choose Your Continent', tip: 'Asia is where the action is — India has the fastest-growing freight market on Earth.' },
  { key: 'country', title: 'Choose Your Country', tip: 'India: 6.3 million km of roads and a billion customers waiting for cargo.' },
  { key: 'state', title: 'Choose Your State', tip: 'Pick a state you know — home advantage matters when routes get tough.' },
  { key: 'city', title: 'Choose Your HQ City', tip: 'Tier-1 metros offer more contracts, but smaller cities have cheaper competition.' },
  { key: 'name', title: 'Name Your Company', tip: 'A memorable name builds brand value. You can always hit Random for inspiration.' },
  { key: 'logo', title: 'Pick Your Logo', tip: 'Your logo rides on every truck. Choose one that says "empire".' },
  { key: 'avatar', title: 'Pick Your CEO Avatar', tip: 'This is you in the boardroom. Look sharp.' },
  { key: 'truck', title: 'Buy Your First Truck', tip: 'Electric trucks cost more upfront but are dirt-cheap per kilometre.' },
  { key: 'summary', title: 'Review & Launch', tip: 'Everything checks out? Sign the papers and hit the highway.' },
];

const CONTINENTS = [
  { name: 'Asia', icon: 'earth', enabled: true },
  { name: 'Europe', icon: 'earth', enabled: false },
  { name: 'Americas', icon: 'earth', enabled: false },
  { name: 'Africa', icon: 'earth', enabled: false },
];

const STARTER_TRUCKS = TRUCK_MODELS.filter(m => m.tier <= 1 || m.price <= 1500000);

function Stars({ rating }) {
  return (
    <Row>
      {[1, 2, 3, 4, 5].map(i => (
        <Icon
          key={i}
          name={rating >= i ? 'star' : rating >= i - 0.5 ? 'star-half-full' : 'star-outline'}
          size={13} color={C.gold}
        />
      ))}
      <Text style={[FONT.tiny, { marginLeft: 4 }]}>{rating.toFixed(1)}</Text>
    </Row>
  );
}

function Spec({ icon, label, value }) {
  return (
    <Row style={{ marginTop: 5 }}>
      <Icon name={icon} size={13} color={C.sub} />
      <Text style={[FONT.tiny, { marginLeft: 5, flex: 1 }]}>{label}</Text>
      <Text style={[FONT.tiny, { color: C.text, fontWeight: '700' }]}>{value}</Text>
    </Row>
  );
}

function SelectRow({ selected, onPress, children }) {
  return (
    <Pressable onPress={onPress} style={[st.row, selected && st.rowSel]}>
      {children}
      <Icon
        name={selected ? 'check-circle' : 'circle-outline'}
        size={20} color={selected ? C.blue : C.border}
      />
    </Pressable>
  );
}

export default function Onboarding({ onDone }) {
  const [step, setStep] = useState(0);
  const [continent, setContinent] = useState(null);
  const [country, setCountry] = useState(null);
  const [state, setState] = useState(null);
  const [cityId, setCityId] = useState(null);
  const [name, setName] = useState('');
  const [ceo, setCeo] = useState('');
  const [logo, setLogo] = useState(LOGOS[0]);
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [truckId, setTruckId] = useState(null);
  const [search, setSearch] = useState('');

  const anim = useRef(new Animated.Value(1)).current;
  const slide = useRef(new Animated.Value(0)).current;

  const goTo = next => {
    Animated.parallel([
      Animated.timing(anim, { toValue: 0, duration: 140, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.timing(slide, { toValue: next > step ? -24 : 24, duration: 140, useNativeDriver: true }),
    ]).start(() => {
      setStep(next);
      setSearch('');
      slide.setValue(next > step ? 24 : -24);
      Animated.parallel([
        Animated.timing(anim, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(slide, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    });
  };

  const filteredStates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? STATES.filter(s => s.toLowerCase().includes(q)) : STATES;
  }, [search]);

  const stateCities = useMemo(() => CITIES.filter(c => c.state === state), [state]);
  const city = CITIES.find(c => c.id === cityId);
  const truck = TRUCK_MODELS.find(m => m.id === truckId);
  const remaining = truck ? STARTING_CAPITAL - truck.price : STARTING_CAPITAL;

  const valid = [
    continent === 'Asia',
    country === 'India',
    !!state,
    !!cityId,
    name.trim().length >= 2 && ceo.trim().length >= 2,
    !!logo,
    !!avatar,
    !!truckId,
    true,
  ][step];

  const launch = () => {
    useGame.getState().createCompany({
      name: name.trim(), ceo: ceo.trim(), logo, avatar, hqCityId: cityId, truckModelId: truckId,
    });
    onDone();
  };

  const randomName = () => {
    setName(COMPANY_NAME_IDEAS[Math.floor(Math.random() * COMPANY_NAME_IDEAS.length)]);
  };

  const renderStep = () => {
    switch (STEPS[step].key) {
      case 'continent':
        return (
          <View style={st.grid}>
            {CONTINENTS.map(c => {
              const sel = continent === c.name;
              return (
                <Pressable
                  key={c.name} disabled={!c.enabled}
                  onPress={() => setContinent(c.name)}
                  style={[st.gridCard, sel && st.gridCardSel, !c.enabled && { opacity: 0.5 }]}
                >
                  <Icon name={c.icon} size={34} color={sel ? C.blue : C.sub} />
                  <Text style={[FONT.h3, { marginTop: 8 }]}>{c.name}</Text>
                  {c.enabled
                    ? <Pill text="Available" icon="check" color={C.green} bg={C.greenSoft} />
                    : <Pill text="Coming Soon" icon="lock" color={C.amber} bg={C.amberSoft} />}
                </Pressable>
              );
            })}
          </View>
        );

      case 'country':
        return (
          <View style={{ paddingTop: 8 }}>
            <Pressable
              onPress={() => setCountry('India')}
              style={[st.gridCard, { width: '100%' }, country === 'India' && st.gridCardSel]}
            >
              <Icon name="flag" size={40} color={country === 'India' ? C.blue : C.sub} />
              <Text style={[FONT.h2, { marginTop: 8 }]}>India</Text>
              <Text style={[FONT.sub, { textAlign: 'center', marginTop: 4 }]}>
                36 states & territories · 100+ cities · endless highways
              </Text>
              <View style={{ marginTop: 10 }}>
                <Pill text="Launch Market" icon="rocket-launch-outline" color={C.green} bg={C.greenSoft} />
              </View>
            </Pressable>
            <Text style={[FONT.tiny, { textAlign: 'center', marginTop: 16, marginBottom: 8, fontWeight: '700' }]}>
              UNLOCK ACROSS ASIA AS YOU GROW
            </Text>
            <Row style={{ flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {[['terrain', 'Nepal'], ['pine-tree', 'Bhutan'], ['waves', 'Bangladesh'], ['ferry', 'Sri Lanka'],
                ['flag-variant', 'Pakistan'], ['rice', 'Myanmar'], ['palm-tree', 'Malaysia'], ['wall', 'China']].map(([ic, nm]) => (
                <Row key={nm} style={{ backgroundColor: C.bgSoft, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6 }}>
                  <Icon name={ic} size={13} color={C.sub} />
                  <Text style={[FONT.tiny, { marginLeft: 4 }]}>{nm}</Text>
                  <Icon name="lock" size={11} color={C.faint} style={{ marginLeft: 4 }} />
                </Row>
              ))}
            </Row>
            <Text style={[FONT.tiny, { textAlign: 'center', marginTop: 12 }]}>
              Start in India, then expand into neighbouring countries from the in-game World map.
            </Text>
          </View>
        );

      case 'state':
        return (
          <View style={{ flex: 1 }}>
            <View style={st.search}>
              <Icon name="magnify" size={18} color={C.faint} />
              <TextInput
                style={st.searchInput} placeholder="Search states..."
                placeholderTextColor={C.faint} value={search} onChangeText={setSearch}
              />
            </View>
            <FlatList
              data={filteredStates}
              keyExtractor={s => s}
              renderItem={({ item }) => (
                <SelectRow selected={state === item} onPress={() => { setState(item); setCityId(null); }}>
                  <Icon name="map-outline" size={18} color={state === item ? C.blue : C.sub} />
                  <Text style={[FONT.body, { flex: 1, marginLeft: 10, fontWeight: state === item ? '700' : '400' }]}>
                    {item}
                  </Text>
                </SelectRow>
              )}
              initialNumToRender={14}
              contentContainerStyle={{ paddingBottom: 12 }}
            />
          </View>
        );

      case 'city':
        return (
          <FlatList
            data={stateCities}
            keyExtractor={c => c.id}
            renderItem={({ item }) => (
              <SelectRow selected={cityId === item.id} onPress={() => setCityId(item.id)}>
                <Icon name="city-variant-outline" size={18} color={cityId === item.id ? C.blue : C.sub} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Row>
                    <Text style={[FONT.body, { fontWeight: '700', marginRight: 8 }]}>{item.name}</Text>
                    <Pill
                      text={`Tier ${item.tier}`}
                      color={item.tier === 1 ? C.green : item.tier === 2 ? C.blue : C.sub}
                      bg={item.tier === 1 ? C.greenSoft : item.tier === 2 ? C.blueSoft : C.bgSoft}
                    />
                  </Row>
                  <Row style={{ marginTop: 2 }}>
                    <Icon name="account-group-outline" size={12} color={C.faint} />
                    <Text style={[FONT.tiny, { marginLeft: 4 }]}>
                      {(item.pop / 1e6).toFixed(1)}M population
                    </Text>
                  </Row>
                </View>
              </SelectRow>
            )}
            initialNumToRender={12}
            contentContainerStyle={{ paddingBottom: 12 }}
            ListEmptyComponent={<Text style={[FONT.sub, { textAlign: 'center', marginTop: 30 }]}>No cities listed for this state yet.</Text>}
          />
        );

      case 'name':
        return (
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={st.label}>Company Name</Text>
            <TextInput
              style={st.input} value={name} onChangeText={setName} maxLength={40}
              placeholder="e.g. Ashoka Logistics" placeholderTextColor={C.faint}
            />
            <Row style={{ justifyContent: 'space-between', marginTop: 8 }}>
              <Btn title="Random Name" icon="dice-multiple-outline" kind="soft" small onPress={randomName} />
              <Text style={FONT.tiny}>{name.length}/40</Text>
            </Row>
            <Text style={[st.label, { marginTop: 22 }]}>CEO Name</Text>
            <TextInput
              style={st.input} value={ceo} onChangeText={setCeo} maxLength={30}
              placeholder="Your name, boss" placeholderTextColor={C.faint}
            />
            <Text style={[FONT.tiny, { textAlign: 'right', marginTop: 6 }]}>{ceo.length}/30</Text>
          </ScrollView>
        );

      case 'logo':
        return (
          <ScrollView>
            <View style={st.iconGrid}>
              {LOGOS.map(l => {
                const sel = logo === l;
                return (
                  <Pressable key={l} onPress={() => setLogo(l)} style={[st.iconCell, sel && st.iconCellSel]}>
                    <Icon name={l} size={30} color={sel ? C.blue : C.sub} />
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        );

      case 'avatar':
        return (
          <ScrollView>
            <View style={st.iconGrid}>
              {AVATARS.map(a => {
                const sel = avatar === a;
                return (
                  <Pressable key={a} onPress={() => setAvatar(a)} style={[st.iconCell, sel && st.iconCellSel]}>
                    <Icon name={a} size={30} color={sel ? C.blue : C.sub} />
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        );

      case 'truck':
        return (
          <View style={{ flex: 1 }}>
            <Card style={{ padding: 12, marginBottom: 12 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Row>
                  <Icon name="wallet-outline" size={16} color={C.sub} />
                  <Text style={[FONT.sub, { marginLeft: 6 }]}>Starting capital</Text>
                </Row>
                <Text style={[FONT.mono, { fontWeight: '700' }]}>{inr(STARTING_CAPITAL)}</Text>
              </Row>
              <Row style={{ justifyContent: 'space-between', marginTop: 6 }}>
                <Row>
                  <Icon name="cash-check" size={16} color={remaining >= 0 ? C.green : C.red} />
                  <Text style={[FONT.sub, { marginLeft: 6 }]}>After purchase</Text>
                </Row>
                <Text style={[FONT.mono, { fontWeight: '700', color: truck ? C.green : C.text }]}>
                  {inr(remaining)}
                </Text>
              </Row>
            </Card>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingRight: 8 }}>
              {STARTER_TRUCKS.map(m => {
                const sel = truckId === m.id;
                return (
                  <Pressable key={m.id} onPress={() => setTruckId(m.id)}>
                    <Card style={[st.truckCard, sel && { borderColor: C.blue, borderWidth: 2 }]}>
                      <Row style={{ justifyContent: 'space-between' }}>
                        <View style={st.truckIconWrap}>
                          <Icon name={m.icon} size={30} color={sel ? C.blue : C.text} />
                        </View>
                        {sel ? <Icon name="check-circle" size={22} color={C.blue} /> : null}
                      </Row>
                      <Text style={[FONT.h3, { marginTop: 10 }]}>{m.name}</Text>
                      <Text style={FONT.tiny}>{m.brand}</Text>
                      <View style={{ marginTop: 4 }}><Stars rating={m.rating} /></View>
                      <View style={{ marginTop: 8 }}>
                        <Spec icon="speedometer" label="Top speed" value={`${m.speed} km/h`} />
                        <Spec icon="weight" label="Cargo" value={`${m.cargo} t`} />
                        <Spec icon="map-marker-distance" label="Range" value={`${m.range} km`} />
                        <Spec icon="wrench-outline" label="Maintenance" value={`₹${m.maint}/km`} />
                      </View>
                      <Text style={[FONT.h3, { marginTop: 12, color: C.text }]}>{inr(m.price)}</Text>
                      <Pill
                        text={m.propulsion === 'electric' ? 'Electric' : m.propulsion === 'hybrid' ? 'Hybrid' : 'Diesel'}
                        icon={m.propulsion === 'electric' ? 'lightning-bolt' : 'gas-station'}
                        color={m.propulsion === 'electric' ? C.green : C.sub}
                        bg={m.propulsion === 'electric' ? C.greenSoft : C.bgSoft}
                      />
                    </Card>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        );

      case 'summary':
        return (
          <ScrollView>
            <Card style={{ padding: 18 }}>
              <Row style={{ marginBottom: 14 }}>
                <View style={st.summaryLogo}>
                  <Icon name={logo} size={30} color="#fff" />
                </View>
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={FONT.h2}>{name.trim()}</Text>
                  <Row style={{ marginTop: 2 }}>
                    <Icon name={avatar} size={14} color={C.sub} />
                    <Text style={[FONT.sub, { marginLeft: 5 }]}>CEO {ceo.trim()}</Text>
                  </Row>
                </View>
              </Row>
              <View style={st.divider} />
              <Spec icon="office-building-marker-outline" label="Headquarters" value={city ? `${city.name}, ${city.state}` : '-'} />
              <Spec icon={truck ? truck.icon : 'truck'} label="First truck" value={truck ? truck.name : '-'} />
              <Spec icon="tag-outline" label="Truck price" value={truck ? inr(truck.price) : '-'} />
              <View style={st.divider} />
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={[FONT.body, { fontWeight: '700' }]}>Starting balance</Text>
                <Text style={[FONT.h3, { color: C.green }]}>{inr(remaining)} ({inrShort(remaining)})</Text>
              </Row>
            </Card>
            <View style={{ marginTop: 20 }}>
              <Btn title="Launch My Empire!" icon="rocket-launch" kind="green" onPress={launch} />
            </View>
          </ScrollView>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={st.safe}>
      <View style={st.head}>
        <Progress pct={((step + 1) / STEPS.length) * 100} />
        <Row style={{ justifyContent: 'center', marginTop: 10 }}>
          {STEPS.map((s, i) => (
            <View key={s.key} style={[st.dot, i === step && st.dotActive, i < step && { backgroundColor: C.green }]} />
          ))}
        </Row>
        <Text style={[FONT.tiny, { textAlign: 'center', marginTop: 10, textTransform: 'uppercase', letterSpacing: 1 }]}>
          Step {step + 1} of {STEPS.length}
        </Text>
        <Text style={[FONT.h1, { textAlign: 'center', marginTop: 2 }]}>{STEPS[step].title}</Text>
      </View>

      <Row style={st.tipBar}>
        <Icon name="lightbulb-on-outline" size={16} color={C.amber} />
        <Text style={[FONT.tiny, { marginLeft: 8, flex: 1, color: C.sub }]}>{STEPS[step].tip}</Text>
      </Row>

      <Animated.View style={{ flex: 1, paddingHorizontal: 16, opacity: anim, transform: [{ translateX: slide }] }}>
        {renderStep()}
      </Animated.View>

      <Row style={st.footer}>
        <Btn title="Back" icon="chevron-left" kind="ghost" onPress={() => goTo(step - 1)} disabled={step === 0} style={{ minWidth: 110 }} />
        {step < STEPS.length - 1 ? (
          <Btn title="Next" icon="chevron-right" onPress={() => goTo(step + 1)} disabled={!valid} style={{ minWidth: 140 }} />
        ) : (
          <View style={{ minWidth: 140 }} />
        )}
      </Row>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  head: { paddingHorizontal: 16, paddingTop: 14 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.border, marginHorizontal: 3 },
  dotActive: { backgroundColor: C.blue, width: 18 },
  tipBar: {
    marginHorizontal: 16, marginVertical: 12, backgroundColor: C.amberSoft,
    borderRadius: RADIUS.md, paddingVertical: 9, paddingHorizontal: 12,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingTop: 8 },
  gridCard: {
    width: '48%', backgroundColor: C.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', paddingVertical: 22, paddingHorizontal: 12, marginBottom: 14, ...SHADOW.card,
  },
  gridCardSel: { borderColor: C.blue, borderWidth: 2, backgroundColor: C.blueSoft },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: C.border, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8,
  },
  rowSel: { borderColor: C.blue, backgroundColor: C.blueSoft },
  search: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgSoft, borderRadius: RADIUS.md,
    paddingHorizontal: 12, marginBottom: 10,
  },
  searchInput: { flex: 1, paddingVertical: 10, marginLeft: 8, ...FONT.body },
  label: { ...FONT.tiny, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, marginTop: 6 },
  input: {
    borderWidth: 1, borderColor: C.border, borderRadius: RADIUS.md, backgroundColor: C.card,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, fontWeight: '600', color: C.text,
  },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingTop: 4 },
  iconCell: {
    width: '22.5%', aspectRatio: 1, backgroundColor: C.card, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  iconCellSel: { borderColor: C.blue, borderWidth: 2, backgroundColor: C.blueSoft },
  truckCard: { width: 240, marginRight: 12, padding: 16 },
  truckIconWrap: {
    width: 52, height: 52, borderRadius: RADIUS.md, backgroundColor: C.bgSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  summaryLogo: {
    width: 54, height: 54, borderRadius: RADIUS.md, backgroundColor: C.text,
    alignItems: 'center', justifyContent: 'center',
  },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 12 },
  footer: {
    justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: C.border,
  },
});
