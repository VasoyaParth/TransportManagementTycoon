// App root — phase routing (splash / onboarding / game) + persistence gate.
// Fully offline / local — no cloud, no login.
import React, { useEffect, useState } from 'react';
import { View, StatusBar, PermissionsAndroid, Platform, AppState } from 'react-native';
import { useGame } from './store/gameStore';
import { ToastProvider, Skeleton } from './ui/components';
import { C } from './ui/theme';
import Splash from './ui/screens/Splash';
import Onboarding from './ui/screens/Onboarding';
import GameScreen from './ui/screens/GameScreen';
import { initSound, setSoundEnabled, setMusicVolume, setSfxVolume } from './engine/sound';
import { setHapticsEnabled, setHapticsIntensity } from './engine/haptics';

export default function App() {
  const [hydrated, setHydrated] = useState(useGame.persist?.hasHydrated?.() ?? false);
  const phase = useGame(s => s.phase);
  const company = useGame(s => s.company);
  const setPhase = useGame(s => s.setPhase);

  useEffect(() => {
    const unsub = useGame.persist.onFinishHydration(() => setHydrated(true));
    if (useGame.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);

  // Initialise audio once hydrated, honouring the saved sound setting.
  useEffect(() => {
    if (!hydrated) return;
    initSound();
    const st = useGame.getState().settings;
    setSoundEnabled(st.sound !== false);
    setHapticsEnabled(st.haptics !== false);
    setMusicVolume(st.musicVolume != null ? st.musicVolume : 0.4);
    setSfxVolume(st.sfxVolume != null ? st.sfxVolume : 1);
    setHapticsIntensity(st.hapticIntensity || 'medium');
  }, [hydrated]);

  // Pause all audio when the app is backgrounded (home button / screen off) so
  // nothing keeps playing or burning battery, and resume it on return.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      const st = useGame.getState().settings;
      if (state === 'active') setSoundEnabled(st.sound !== false);
      else setSoundEnabled(false);
    });
    return () => sub.remove();
  }, []);

  // Ask for notification permission on first launch (Android 13+).
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const perm = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
    if (!perm) return;
    PermissionsAndroid.check(perm).then(granted => {
      if (!granted) PermissionsAndroid.request(perm).catch(() => {});
    }).catch(() => {});
  }, []);

  if (!hydrated) {
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
      {phase === 'game' && company ? (
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
