// First-time guided tour with a friendly advisor. Skippable at any step and
// replayable from Settings → About. Pure overlay, no gameplay blocking.
import React, { useRef, useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { C, FONT, SHADOW } from '../theme';
import { haptic } from '../../engine/haptics';

const STEPS = [
  { icon: 'hand-wave', title: 'Welcome, CEO!', body: "I'm Ravi, your logistics advisor. Let me show you the ropes of running your trucking empire across India." },
  { icon: 'map-marker-radius', title: 'The Live Map', body: 'This is India. Your trucks, HQ and hubs live here. Pinch to zoom, drag to pan. Tap a truck to see its details.' },
  { icon: 'truck-plus', title: 'Start a Delivery', body: 'Tap the "Deliver" button, pick a parked truck and a destination city. You earn profit based on real road distance and cargo.' },
  { icon: 'clock-outline', title: 'Real Time', body: 'The game runs in real time — long hauls take real hours. Start a delivery, close the app, and come back to collect your earnings.' },
  { icon: 'gas-station', title: 'Fuel & Refuelling', body: 'Trucks burn fuel over distance. On long trips they auto-stop at petrol pumps. Low on fuel? Use an Instant Refuel from the Power-Ups store.' },
  { icon: 'garage', title: 'Grow Your Network', body: 'Buy hubs in new cities, hire drivers and mechanics, run marketing campaigns and complete contracts to expand your empire.' },
  { icon: 'gesture-tap-button', title: "You're Ready!", body: 'Use the bottom pill menu for Fleet, Routes, Staff and more. You can replay this tour anytime from Settings → About. Happy hauling!' },
];

export default function Tutorial({ onDone }) {
  const [i, setI] = useState(0);
  const fade = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0.9)).current;
  const step = STEPS[i];

  useEffect(() => {
    fade.setValue(0); pop.setValue(0.92);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 7 }),
    ]).start();
  }, [i]);

  const next = () => { haptic('light'); if (i < STEPS.length - 1) setI(i + 1); else onDone(); };
  const back = () => { haptic('light'); if (i > 0) setI(i - 1); };

  return (
    <View style={st.overlay}>
      <Animated.View style={[st.card, SHADOW.pop, { opacity: fade, transform: [{ scale: pop }] }]}>
        <View style={st.advisor}><Icon name="account-tie" size={40} color="#fff" /></View>
        <View style={st.badge}><Icon name={step.icon} size={18} color={C.blue} /></View>
        <Text style={[FONT.h2, { textAlign: 'center', marginTop: 8 }]}>{step.title}</Text>
        <Text style={[FONT.body, { textAlign: 'center', color: C.sub, marginTop: 8, lineHeight: 20 }]}>{step.body}</Text>

        <View style={st.dots}>
          {STEPS.map((_, k) => <View key={k} style={[st.dot, k === i && st.dotOn]} />)}
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
          {i > 0 && (
            <Pressable style={[st.btn, st.btnGhost]} onPress={back}>
              <Text style={[st.btnTxt, { color: C.text }]}>Back</Text>
            </Pressable>
          )}
          <Pressable style={[st.btn, st.btnPrimary, { flex: 1 }]} onPress={next}>
            <Text style={[st.btnTxt, { color: '#fff' }]}>{i < STEPS.length - 1 ? 'Next' : "Let's go!"}</Text>
          </Pressable>
        </View>
        <Pressable onPress={() => { haptic('light'); onDone(); }} style={{ marginTop: 12 }}>
          <Text style={{ color: C.faint, fontWeight: '700', fontSize: 13 }}>Skip tour</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const st = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(11,15,20,0.55)',
    alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 100,
  },
  card: {
    backgroundColor: C.bg, borderRadius: 28, padding: 22, paddingTop: 44, width: '100%', maxWidth: 380,
    alignItems: 'center',
  },
  advisor: {
    position: 'absolute', top: -34, width: 68, height: 68, borderRadius: 34, backgroundColor: C.blue,
    alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: C.bg,
  },
  badge: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: C.blueSoft,
    alignItems: 'center', justifyContent: 'center', marginTop: 6,
  },
  dots: { flexDirection: 'row', gap: 6, marginTop: 16 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.border },
  dotOn: { width: 20, backgroundColor: C.blue },
  btn: { paddingVertical: 13, paddingHorizontal: 22, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: C.blue },
  btnGhost: { borderWidth: 1, borderColor: C.border },
  btnTxt: { fontWeight: '800', fontSize: 15 },
});
