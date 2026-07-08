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
import { useGame, modelById } from '../store/gameStore';
import { cityById } from '../engine/routing';
import { statusMeta } from './components';

const CITY_DATA = CITIES.map(c => ({ id: c.id, name: c.name, state: c.state, lat: c.lat, lng: c.lng, tier: c.tier }));
const STATION_DATA = STATIONS.map(s => ({ lat: s.lat, lng: s.lng, type: s.type, price: s.price, name: s.name }));

export default function LeafletMap({ pickingMode, onCityPick, onCancelPick, focus, onTruckTap, onReady, onOffline }) {
  const ref = useRef(null);
  const company = useGame(s => s.company);
  const trucks = useGame(s => s.trucks);
  const deliveries = useGame(s => s.deliveries);
  const [ready, setReady] = useState(false);

  const hq = company ? cityById(company.hqCityId) : { lat: 22, lng: 79, name: 'HQ' };

  const initial = useMemo(() => ({
    hq: { lat: hq.lat, lng: hq.lng, name: hq.name },
    companyName: company?.name || 'Company',
    cities: CITY_DATA,
    stations: STATION_DATA,
  }), []);

  const html = useMemo(() => buildLeafletHtml(initial), [initial]);

  const liveState = useCallback(() => {
    const now = Date.now();
    const tk = trucks.map(t => {
      const d = deliveries.find(x => x.truckId === t.id);
      let lat = t.lat, lng = t.lng, heading = 0;
      if (d) {
        const prog = Math.min(1, Math.max(0, (now - d.startedAt) / (d.endsAt - d.startedAt)));
        const p = pointAlong(d.route.points, d.route.cum, prog);
        lat = p.lat; lng = p.lng; heading = p.heading;
      }
      const meta = statusMeta[t.status] || statusMeta.parked;
      const model = modelById(t.modelId);
      const color = t.color || (model.propulsion === 'electric' ? '#12A150'
        : model.propulsion === 'hybrid' ? '#0E7C86' : '#3A5A8C');
      return { id: t.id, lat, lng, heading, status: t.status, statusLabel: meta.label, color,
        fuelPct: Math.round(t.fuelPct), name: t.customName || model.name };
    });
    const routes = deliveries.map(d => ({ id: d.id, points: d.route.points, stops: d.stops || [] }));
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
        <Ctl icon="crosshairs-gps" label="HQ" onPress={() => inject('window.centerHQ()')} />
        <Ctl icon="gas-station" label="Fuel" onPress={() => inject('window.toggleStations()')} />
        <Ctl icon="city-variant-outline" label="Cities" onPress={() => inject('window.toggleCities()')} />
      </View>
    </View>
  );
}

function Ctl({ icon, label, onPress }) {
  return (
    <Pressable onPress={onPress} style={st.ctl}>
      <Icon name={icon} size={17} color={C.text} />
      {label ? <Text style={st.ctlTxt}>{label}</Text> : null}
    </Pressable>
  );
}

const st = StyleSheet.create({
  // Horizontal show/hide toggle row, centred just above the bottom nav.
  controls: { position: 'absolute', left: 0, right: 0, bottom: 88, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  ctl: {
    flexDirection: 'row', alignItems: 'center', height: 34, paddingHorizontal: 12, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.94)', borderWidth: 1, borderColor: C.border,
  },
  ctlTxt: { fontSize: 11.5, fontWeight: '700', color: C.text, marginLeft: 5 },
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
