// Online Leaflet map (WebView). Mirrors the web version. Reports 'offline'
// or a load timeout so MapContainer can fall back to the offline SVG map.
import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { buildLeafletHtml } from './leafletHtml';
import { CITIES } from '../data/cities';
import { STATIONS } from '../engine/stations';
import { pointAlong } from '../engine/geo';
import { C } from './theme';
import { useGame, modelById, deliveryPhase, WEATHER_KINDS, weatherPolygon } from '../store/gameStore';
import { cityById, ferryPorts } from '../engine/routing';
import { statusMeta, useEasterEggTap } from './components';
import { haptic } from '../engine/haptics';
import { truckSvgString, truckShapes, bodyTypeFor, defaultBodyColor, headlightFor, isNightHour, ferrySvgString } from './truckArt';

const CITY_DATA = CITIES.map(c => ({ id: c.id, name: c.name, state: c.state, lat: c.lat, lng: c.lng, tier: c.tier, country: c.country || 'IN' }));
const STATION_DATA = STATIONS.map(s => ({ lat: s.lat, lng: s.lng, type: s.type, price: s.price, name: s.name }));
const PORT_DATA = ferryPorts();

export default function LeafletMap({ pickingMode, onCityPick, onCancelPick, focus, onTruckTap, onHubTap, onReady, onOffline }) {
  const tapPortEgg = useEasterEggTap('port_master', 6);
  const tapFuelEgg = useEasterEggTap('fuel_sniffer', 7);
  const tapHqEgg = useEasterEggTap('hq_home', 5); // was only wired on the old offline map
  const ref = useRef(null);
  const company = useGame(s => s.company);
  const trucks = useGame(s => s.trucks);
  const deliveries = useGame(s => s.deliveries);
  const unlockedCountries = useGame(s => s.unlockedCountries || ['IN']);
  const [ready, setReady] = useState(false);

  const hq = company ? cityById(company.hqCityId) : { lat: 22, lng: 79, name: 'HQ' };

  const hubs = useGame(s => s.hubs || []);
  const hubData = useCallback(() => hubs.filter(h => !h.hq).map(h => {
    const c = cityById(h.cityId);
    return c ? { lat: c.lat, lng: c.lng, name: h.name, hq: false, cityId: h.cityId } : null;
  }).filter(Boolean), [hubs]);

  const initial = useMemo(() => ({
    hq: { lat: hq.lat, lng: hq.lng, name: hq.name },
    companyName: company?.name || 'Company',
    cities: CITY_DATA,
    stations: STATION_DATA,
    hubs: hubData(),
    ports: PORT_DATA,
    ferryArt: ferrySvgString(), // constant RO-RO ship art — sent once, not per truck per tick
    // Persisted port visibility — "off" stays off across restarts.
    portsOn: useGame.getState().settings?.showPorts !== false,
  }), []);

  const html = useMemo(() => buildLeafletHtml(initial), [initial]);

  // PERF: per-truck art cache — the SVG art string only crosses the WebView
  // bridge when its inputs (body/color/status/lights) actually change, not on
  // every 900ms animation tick. Cuts bridge traffic ~20× on a big fleet,
  // which is the main phone-heat source during long play sessions.
  const artKeys = useRef({});
  const liveState = useCallback(() => {
    const now = Date.now();
    const tk = trucks.map(t => {
      const d = deliveries.find(x => x.truckId === t.id);
      let lat = t.lat, lng = t.lng, heading = 0, ferryOn = false, ferryLoading = false, phase = null;
      if (d) {
        // Freeze the truck in place while an accident/theft incident is
        // unresolved instead of letting it keep crawling — resumes with no
        // position jump once the mechanic arrives or the incident clears.
        let effNow = now;
        if (d.incident) {
          effNow = now < d.incident.resolveAt ? d.incident.startedAt : now - (d.incident.resolveAt - d.incident.startedAt);
        }
        // Lifecycle phases: loading, driving, ferry board/sail/dock, unloading.
        const pp = deliveryPhase(d, effNow);
        const p = pointAlong(d.route.points, d.route.cum, Math.min(1, Math.max(0, pp.frac)));
        lat = p.lat; lng = p.lng; heading = p.heading;
        ferryOn = pp.phase === 'ferry';
        ferryLoading = pp.phase === 'ferry-board' || pp.phase === 'ferry-unboard';
        phase = pp.phase;
      }
      const meta = statusMeta[t.status] || statusMeta.parked;
      const model = modelById(t.modelId);
      const color = t.color || defaultBodyColor(model);
      const accent = t.status === 'delivering' ? '#0E9F5B' : t.status === 'building' ? '#D97706'
        : t.status === 'broken' ? '#DC3D43' : '#9DB2D6';
      const bt = bodyTypeFor(model);
      // Headlights on for trucks driving at night (real local clock, 6pm–6am).
      const night = isNightHour(new Date().getHours());
      const lights = night && t.status === 'delivering' ? headlightFor(model) : null;
      const dims = truckShapes(bt, color, accent, { lights });
      const artKey = `${bt}|${color}|${accent}|${lights ? 1 : 0}`;
      const artChanged = artKeys.current[t.id] !== artKey;
      if (artChanged) artKeys.current[t.id] = artKey;
      return { id: t.id, lat, lng, heading, status: t.status, statusLabel: meta.label, color,
        // art omitted when unchanged — the WebView reuses its cached copy.
        art: artChanged ? truckSvgString(bt, color, accent, { lights }) : undefined,
        artW: dims.w, artH: dims.h, bodyH: dims.bodyH,
        ferryOn, ferryLoading, phase, incidentType: (d && d.incident && d.incident.type) || null,
        fuelPct: Math.round(t.fuelPct), name: t.customName || model.name };
    });
    // Split each route's sea (ferry) legs out as separate polylines so water
    // crossings render as ship lanes between two docks — never a "road on
    // water". ferrySegments carry start/end fractions of total route length.
    const routes = deliveries.map(d => {
      const pts = d.route.points, cum = d.route.cum || [];
      const total = cum.length ? cum[cum.length - 1] : 0;
      const segs = d.route.ferrySegments || (d.route.ferrySegment ? [d.route.ferrySegment] : []);
      const seaLegs = total > 0 ? segs.map(fs => {
        let i0 = 0, i1 = pts.length - 1;
        for (let i = 0; i < cum.length; i++) { if (cum[i] / total >= fs.startFrac) { i0 = i; break; } }
        for (let i = i0; i < cum.length; i++) { if (cum[i] / total >= fs.endFrac) { i1 = i; break; } }
        return pts.slice(i0, i1 + 1);
      }).filter(l => l.length > 1) : [];
      return { id: d.id, points: pts, stops: d.stops || [], seaLegs };
    });
    const corr = (useGame.getState().corridors || []).map(c => ({ id: c.id, points: c.points }));
    return { trucks: tk, routes, corridors: corr };
  }, [trucks, deliveries]);

  const inject = useCallback((js) => { if (ref.current) ref.current.injectJavaScript(js + '; true;'); }, []);

  // Push live truck/route state; ~animation cadence while delivering.
  useEffect(() => {
    if (!ready) return;
    inject(`window.applyState(${JSON.stringify(liveState())})`);
    if (!deliveries.length) return;
    const iv = setInterval(() => inject(`window.applyState(${JSON.stringify(liveState())})`), 900);
    return () => clearInterval(iv);
  }, [ready, deliveries.length, trucks.length, liveState, inject]);

  // Only show city dots for countries the player has unlocked.
  useEffect(() => { if (ready) inject(`window.setVisibleCountries(${JSON.stringify(unlockedCountries)})`); }, [ready, unlockedCountries]);

  // Keep garage markers in sync when hubs are bought/sold.
  useEffect(() => { if (ready) inject(`window.setHubs(${JSON.stringify(hubData())})`); }, [ready, hubs.length]);

  // Live regional weather (v2.4.0) — overlays drawn ONLY where a zone is
  // actually active today: radius circle + kind badge, slowing trucks inside.
  const weather = useGame(s => s.weather || []);
  useEffect(() => {
    if (!ready) return;
    const zones = weather.map(z => {
      const k = WEATHER_KINDS[z.kind] || {};
      return {
        lat: z.lat, lng: z.lng, kind: z.kind,
        // Irregular blob outline (state-boundary style) — same boundary the
        // speed penalty uses, so the visual IS the gameplay.
        outline: weatherPolygon(z).map(pt => [+pt.lat.toFixed(3), +pt.lng.toFixed(3)]),
        label: `${k.label || z.kind} — ${z.name}`, color: k.color || '#2563EB',
        slowPct: Math.round((1 - (k.slow || 1)) * 100),
      };
    });
    inject(`window.setWeather(${JSON.stringify(zones)})`);
  }, [ready, weather]);

  // Discovered cities (HQ, garages, truck locations, every route driven) —
  // highlighted on the map; the rest render as faint unexplored dots.
  const history = useGame(s => s.history);
  const corridors = useGame(s => s.corridors || []);
  useEffect(() => {
    if (!ready) return;
    const d = new Set();
    if (company) d.add(company.hqCityId);
    hubs.forEach(h => d.add(h.cityId));
    trucks.forEach(t => t.cityId && d.add(t.cityId));
    deliveries.forEach(x => { d.add(x.fromCityId); d.add(x.toCityId); });
    (history || []).forEach(x => { d.add(x.fromCityId); d.add(x.toCityId); });
    corridors.forEach(x => { d.add(x.fromCityId); d.add(x.toCityId); });
    inject(`window.setDiscovered(${JSON.stringify([...d])})`);
  }, [ready, hubs.length, trucks.length, deliveries.length, history?.length, corridors.length]);

  useEffect(() => { if (ready) inject(`window.setPickMode(${!!pickingMode})`); }, [pickingMode, ready]);
  useEffect(() => { if (ready && focus) inject(`window.focusOn(${focus.lat},${focus.lng},${focus.scale ? 9 : 7})`); }, [focus, ready]);

  // Safety: if the map never becomes ready (no internet / CDN blocked), fall back.
  useEffect(() => {
    const t = setTimeout(() => { if (!ready) onOffline && onOffline(); }, 9000);
    return () => clearTimeout(t);
  }, [ready]);

  const onMessage = (e) => {
    let msg; try { msg = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (msg.type === 'ready') { setReady(true); onReady && onReady(); }
    else if (msg.type === 'offline') onOffline && onOffline();
    else if (msg.type === 'pickCity') { const c = cityById(msg.id); if (c) onCityPick && onCityPick(c); }
    else if (msg.type === 'truckTap') { const t = trucks.find(x => x.id === msg.id); if (t) onTruckTap && onTruckTap(t); }
    else if (msg.type === 'hubTap') { onHubTap && onHubTap(msg.cityId); }
    else if (msg.type === 'hqTap') { if (company) onHubTap && onHubTap(company.hqCityId); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.mapLand }}>
      <WebView
        ref={ref}
        originWhitelist={['*']}
        source={{ html }}
        onMessage={onMessage}
        onError={() => onOffline && onOffline()}
        onHttpError={() => {}}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState={false}
        style={{ flex: 1, backgroundColor: C.mapLand }}
      />
      {pickingMode && (
        <View style={st.pickBanner}>
          <Icon name="map-marker-question" size={16} color="#fff" />
          <Text style={st.pickTxt}>Tap a city to set the destination</Text>
          <Pressable onPress={onCancelPick}><Text style={[st.pickTxt, { textDecorationLine: 'underline' }]}>Cancel</Text></Pressable>
        </View>
      )}
      <View style={st.controls}>
        <Ctl icon="crosshairs-gps" onPress={() => { inject('window.centerHQ()'); tapHqEgg(); }} />
        <Ctl icon="gas-station" onPress={() => { inject('window.toggleStations()'); tapFuelEgg(); }} />
        <Ctl icon="city-variant-outline" onPress={() => inject('window.toggleCities()')} />
        <Ctl icon="anchor" onPress={() => {
          // Persist the dock toggle: off stays off until explicitly re-enabled.
          const on = useGame.getState().settings?.showPorts !== false;
          useGame.getState().saveSettings({ showPorts: !on });
          inject(`window.setPorts(${!on})`);
          tapPortEgg();
        }} />
      </View>
    </View>
  );
}

function Ctl({ icon, onPress }) {
  // Every map control gives the same light haptic tick as the rest of the UI.
  return (
    <Pressable onPress={(...a) => { haptic('light'); onPress && onPress(...a); }} style={st.ctl}>
      <Icon name={icon} size={19} color={C.text} />
    </Pressable>
  );
}

const st = StyleSheet.create({
  // Small vertical toggle stack on the right, sitting above the Deliver button.
  controls: { position: 'absolute', right: 14, bottom: 150, alignItems: 'center', gap: 8 },
  ctl: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)', borderWidth: 1, borderColor: C.border,
  },
  legend: {
    position: 'absolute', left: 12, bottom: 12, flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: C.border,
  },
  pickBanner: {
    position: 'absolute', top: 12, alignSelf: 'center', flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.blue, borderRadius: 24, paddingHorizontal: 14, paddingVertical: 8,
  },
  pickTxt: { color: '#fff', fontWeight: '700', fontSize: 12.5, marginHorizontal: 4 },
});
