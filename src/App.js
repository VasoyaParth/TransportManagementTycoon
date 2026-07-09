// App root — phase routing (splash / onboarding / game) + persistence gate.
// Fully offline / local — no cloud, no login.
import React, { useEffect, useState } from 'react';
import { View, Text, StatusBar, ActivityIndicator, PermissionsAndroid, Platform } from 'react-native';
import { useGame } from './store/gameStore';
import { useAuth } from './store/authStore';
import { api } from './net/api';
import { ToastProvider, Skeleton } from './ui/components';
import { C, FONT } from './ui/theme';
import Splash from './ui/screens/Splash';
import Onboarding from './ui/screens/Onboarding';
import GameScreen from './ui/screens/GameScreen';
import Auth from './ui/screens/Auth';
import { initSound, setSoundEnabled } from './engine/sound';
import { setHapticsEnabled } from './engine/haptics';

function Loading({ label }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={C.blue} size="large" />
      {label ? <Text style={[FONT.sub, { marginTop: 14 }]}>{label}</Text> : null}
    </View>
  );
}

export default function App() {
  const [hydrated, setHydrated] = useState(useGame.persist?.hasHydrated?.() ?? false);
  const phase = useGame(s => s.phase);
  const company = useGame(s => s.company);
  const setPhase = useGame(s => s.setPhase);

  const authStatus = useAuth(s => s.status);
  const bootstrap = useAuth(s => s.bootstrap);
  const [cloudLoaded, setCloudLoaded] = useState(false);

  useEffect(() => {
    const unsub = useGame.persist.onFinishHydration(() => setHydrated(true));
    if (useGame.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);

  // Try to restore a saved session (auto-login) on launch.
  useEffect(() => { bootstrap(); }, []);

  useEffect(() => {
    if (!hydrated) return;
    initSound();
    setSoundEnabled(useGame.getState().settings.sound !== false);
    setHapticsEnabled(useGame.getState().settings.haptics !== false);
  }, [hydrated]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const perm = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
    if (!perm) return;
    PermissionsAndroid.check(perm).then(granted => {
      if (!granted) PermissionsAndroid.request(perm).catch(() => {});
    }).catch(() => {});
  }, []);

  // Once authenticated, load the authoritative game state from the cloud.
  useEffect(() => {
    if (authStatus !== 'authed') { setCloudLoaded(false); return; }
    let alive = true;
    (async () => {
      try {
        const { state } = await api.getState();
        if (!alive) return;
        if (state && Object.keys(state).length) useGame.getState().applyCloudState(state);
        else { useGame.getState().resetGame(); } // new account → fresh empire
      } catch {
        // Server unreachable — fall back to whatever is cached locally.
      }
      if (alive) setCloudLoaded(true);
    })();
    return () => { alive = false; };
  }, [authStatus]);

  // Push local changes up to the cloud (debounced) for multi-device sync.
  useEffect(() => {
    if (authStatus !== 'authed' || !cloudLoaded) return undefined;
    let timer = null;
    let version = 0;
    const push = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          const r = await api.putState(useGame.getState().cloudSnapshot(), version);
          if (r && typeof r.version === 'number') version = r.version;
        } catch { /* retried on next change */ }
      }, 1500);
    };
    const unsub = useGame.subscribe(push);
    return () => { clearTimeout(timer); unsub(); };
  }, [authStatus, cloudLoaded]);

  if (!hydrated || authStatus === 'checking') {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, padding: 24, justifyContent: 'center' }}>
        <Skeleton h={44} w="60%" style={{ marginBottom: 14 }} />
        <Skeleton h={16} w="90%" style={{ marginBottom: 8 }} />
        <Skeleton h={16} w="75%" />
      </View>
    );
  }

  return (
    <ToastProvider>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      {authStatus !== 'authed' ? (
        <Auth />
      ) : !cloudLoaded ? (
        <Loading label="Syncing your empire…" />
      ) : phase === 'game' && company ? (
        <GameScreen />
      ) : phase === 'onboarding' ? (
        <Onboarding onDone={() => {}} />
      ) : (
        <Splash
          hasSave={!!company}
          onNew={() => setPhase('onboarding')}
          onContinue={() => setPhase('game')}
        />
      )}
    </ToastProvider>
  );
}
