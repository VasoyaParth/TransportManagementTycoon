// Map host. Satellite (Leaflet tile) map is the primary experience with a
// loading screen while it initialises. The offline India SVG map is used ONLY
// as an automatic fallback when there is genuinely no internet.
import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LeafletMap from './LeafletMap';
import { C, FONT } from './theme';
import { BootSplash } from './screens/Splash';

// Cloud-only: the satellite (Leaflet) map is the ONLY map. No local SVG India
// fallback — if there is no connection we show a retry prompt instead.
export default function MapContainer(props) {
  const [mode, setMode] = useState('loading'); // loading | leaflet | offline
  const [attempt, setAttempt] = useState(0);
  const startRef = React.useRef(Date.now());

  const onReady = useCallback(() => {
    const wait = Math.max(0, 1100 - (Date.now() - startRef.current));
    setTimeout(() => setMode('leaflet'), wait);
  }, []);
  const onOffline = useCallback(() => setMode('offline'), []);
  const retry = () => { startRef.current = Date.now(); setMode('loading'); setAttempt(a => a + 1); };

  return (
    <View style={{ flex: 1 }}>
      {mode !== 'offline' && (
        <LeafletMap key={attempt} {...props} onReady={onReady} onOffline={onOffline} />
      )}

      {mode === 'loading' && (
        // Same navy splash (logo + rotating one-liners + Made in India) that
        // covered app boot — so from icon-tap to playable map the player sees
        // ONE continuous splash screen, never a separate "loading map" page.
        <View style={StyleSheet.absoluteFill}>
          <BootSplash />
        </View>
      )}

      {mode === 'offline' && (
        <View style={st.loader}>
          <Icon name="wifi-off" size={40} color={C.sub} />
          <Text style={[st.title, { marginTop: 12 }]}>No internet connection</Text>
          <Text style={st.sub}>This game runs on the cloud and needs an active connection.</Text>
          <Pressable style={st.retry} onPress={retry}>
            <Icon name="refresh" size={16} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '800', marginLeft: 6 }}>Retry</Text>
          </Pressable>
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
  title: { ...FONT.h2, textAlign: 'center' },
  sub: { ...FONT.sub, marginTop: 8, textAlign: 'center', paddingHorizontal: 24 },
  retry: {
    flexDirection: 'row', alignItems: 'center', marginTop: 18,
    backgroundColor: C.blue, borderRadius: 24, paddingHorizontal: 20, paddingVertical: 11,
  },
});
