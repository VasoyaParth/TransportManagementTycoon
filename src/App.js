// App root — phase routing (splash / onboarding / game) + persistence gate.
// Fully offline / local — no cloud, no login.
import React, { useEffect, useState } from 'react';
import { StatusBar, PermissionsAndroid, Platform, AppState } from 'react-native';
import { useGame } from './store/gameStore';
import { ToastProvider } from './ui/components';
import { C } from './ui/theme';
import Splash from './ui/screens/Splash';
import Onboarding from './ui/screens/Onboarding';
import GameScreen from './ui/screens/GameScreen';
import { initSound, setSoundEnabled, setMusicVolume, setSfxVolume } from './engine/sound';
import { setHapticsEnabled, setHapticsIntensity } from './engine/haptics';

export default function App() {
  const [hydrated, setHydrated] = useState(useGame.persist?.hasHydrated?.() ?? false);
  // Hydration is near-instant, which used to flash the boot splash for a few
  // frames and dump the player straight onto the map. Hold the splash for a
  // minimum beat so the brand screen is actually seen while the map warms up.
  const [splashDone, setSplashDone] = useState(false);
  const phase = useGame(s => s.phase);
  const company = useGame(s => s.company);
  const setPhase = useGame(s => s.setPhase);

  useEffect(() => {
    const unsub = useGame.persist.onFinishHydration(() => setHydrated(true));
    if (useGame.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);

  useEffect(() => {
    // Native-only splash: no artificial hold — enter the game as soon as the
    // save has hydrated (the map's own native-look cover takes it from there).
    const tm = setTimeout(() => setSplashDone(true), 350);
    return () => clearTimeout(tm);
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

  // NO custom boot splash (v3.2.0): while the save hydrates, React renders
  // nothing — so the NATIVE launch screen (navy + truck logo, set in
  // styles.xml/launch_screen.xml) simply stays on screen. One splash, native,
  // from icon-tap until the game is ready.
  if (!hydrated || !splashDone) {
    return <StatusBar barStyle="light-content" backgroundColor="#0F1D30" translucent={false} />;
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
