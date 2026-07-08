// Map host. Satellite (Leaflet tile) map is the primary experience with a
// loading screen while it initialises. The offline India SVG map is used ONLY
// as an automatic fallback when there is genuinely no internet.
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LeafletMap from './LeafletMap';
import IndiaMap from './MapView';
import { C, FONT } from './theme';

export default function MapContainer(props) {
  const [mode, setMode] = useState('loading'); // loading | leaflet | offline
  const [probe, setProbe] = useState(null); // null unknown, true online, false offline
  const startRef = React.useRef(Date.now());

  // Connectivity probe: decide satellite vs offline map up front.
  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    fetch('https://a.basemaps.cartocdn.com/light_all/3/5/3.png', { method: 'HEAD', signal: ctrl.signal })
      .then(() => { if (alive) setProbe(true); })
      .catch(() => { if (alive) { setProbe(false); setMode('offline'); } })
      .finally(() => clearTimeout(t));
    return () => { alive = false; ctrl.abort(); };
  }, []);

  // Keep the loading screen up for at least ~1.1s so it doesn't flash.
  const onReady = useCallback(() => {
    const wait = Math.max(0, 1100 - (Date.now() - startRef.current));
    setTimeout(() => setMode('leaflet'), wait);
  }, []);
  const onOffline = useCallback(() => { setProbe(false); setMode('offline'); }, []);

  return (
    <View style={{ flex: 1 }}>
      {mode === 'offline'
        ? <IndiaMap {...props} />
        : <LeafletMap {...props} onReady={onReady} onOffline={onOffline} />}

      {/* Loading screen over the map until the satellite tiles are ready */}
      {mode === 'loading' && (
        <View style={st.loader}>
          <View style={st.badge}><Icon name="truck-fast" size={34} color="#fff" /></View>
          <Text style={st.title}>Truck Empire Tycoon</Text>
          <ActivityIndicator color={C.blue} style={{ marginTop: 14 }} />
          <Text style={st.sub}>{probe === false ? 'No internet — loading offline map…' : 'Loading map…'}</Text>
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  loader: {
    ...StyleSheet.absoluteFillObject, backgroundColor: C.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  badge: {
    width: 72, height: 72, borderRadius: 22, backgroundColor: C.blue,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  title: { ...FONT.h2 },
  sub: { ...FONT.sub, marginTop: 8 },
});
