// Splash screen — premium light entry point.
import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated, Easing, StyleSheet, SafeAreaView } from 'react-native';
import { C, FONT, SHADOW, RADIUS } from '../theme';
import { Btn, Icon, Row, useEasterEggTap } from '../components';
import { BrandEmblem, BrandWordmark } from '../BrandLogo';

// Boot splash — full-brand loading screen shown for the moment the saved game
// hydrates from disk (replaces the old bare skeleton bars). Navy stage, the
// shield emblem gently breathing, wordmark, and three marching loader dots.
const BOOT_LINES = [
  'Warming up the engines…',
  'Loading your empire…',
  'Checking tyre pressure…',
  'Waking up the drivers…',
  'Brewing chai for the fleet…',
  'Counting yesterday’s earnings…',
];
export function BootSplash() {
  const pulse = useRef(new Animated.Value(0)).current;
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  const line = useRef(BOOT_LINES[Math.floor(Math.random() * BOOT_LINES.length)]).current;
  useEffect(() => {
    const breathe = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    const march = Animated.loop(Animated.stagger(160, dots.map(d => Animated.sequence([
      Animated.timing(d, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(d, { toValue: 0, duration: 260, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]))));
    breathe.start(); march.start();
    return () => { breathe.stop(); march.stop(); };
  }, []);
  return (
    <View style={bs.stage}>
      <Animated.View style={{ alignItems: 'center', transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) }] }}>
        <BrandEmblem size={128} />
      </Animated.View>
      <View style={{ height: 22 }} />
      <BrandWordmark dark scale={1} />
      <View style={bs.dotsRow}>
        {dots.map((d, i) => (
          <Animated.View key={i} style={[bs.dot, {
            opacity: d.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
            transform: [{ translateY: d.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }],
          }]} />
        ))}
      </View>
      <Text style={bs.line}>{line}</Text>
      <Text style={bs.footer}>Made in India 🇮🇳</Text>
    </View>
  );
}

const bs = StyleSheet.create({
  stage: { flex: 1, backgroundColor: '#0F1D30', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  dotsRow: { flexDirection: 'row', gap: 9, marginTop: 34 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#E9B949' },
  line: { color: 'rgba(242,245,250,0.75)', fontSize: 13, fontWeight: '600', marginTop: 16, textAlign: 'center' },
  footer: { position: 'absolute', bottom: 28, color: 'rgba(242,245,250,0.45)', fontSize: 11, fontWeight: '700' },
});

export default function Splash({ onNew, onContinue, hasSave }) {
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(24)).current;
  const btnFade = useRef(new Animated.Value(0)).current;
  const btnSlide = useRef(new Animated.Value(30)).current;
  const tapLogoEgg = useEasterEggTap('not_a_bug', 10);

  useEffect(() => {
    Animated.stagger(220, [
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(slide, { toValue: 0, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(btnFade, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(btnSlide, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={st.safe}>
      <View style={st.center}>
        <Animated.View style={{ alignItems: 'center', opacity: fade, transform: [{ translateY: slide }] }}>
          <Pressable style={[st.emblemWrap, SHADOW.pop]} onPress={tapLogoEgg}>
            <BrandEmblem size={136} />
          </Pressable>
          <BrandWordmark scale={1.15} />
          <Text style={st.tagline}>Build your empire. Rule the roads.{'\n'}Conquer every highway.</Text>
        </Animated.View>

        <Animated.View style={{ width: '100%', marginTop: 44, opacity: btnFade, transform: [{ translateY: btnSlide }] }}>
          <Btn title="Start New Empire" icon="rocket-launch" onPress={onNew} />
          {hasSave ? (
            <Btn title="Continue" icon="play-circle-outline" kind="soft" onPress={onContinue} style={{ marginTop: 12 }} />
          ) : null}
        </Animated.View>
      </View>

      <Animated.View style={{ opacity: btnFade }}>
        <Row style={st.footer}>
          <Icon name="map-marker" size={13} color={C.faint} />
          <Text style={[FONT.tiny, { marginLeft: 4 }]}>Made in India</Text>
          <Text style={[FONT.tiny, { marginHorizontal: 8 }]}>·</Text>
          <Icon name="cloud-check-outline" size={13} color={C.faint} />
          <Text style={[FONT.tiny, { marginLeft: 4 }]}>Cloud Synced</Text>
        </Row>
      </Animated.View>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emblemWrap: { borderRadius: 34, marginBottom: 22 },
  tagline: { ...FONT.sub, textAlign: 'center', marginTop: 16, lineHeight: 19 },
  footer: { justifyContent: 'center', paddingBottom: 24 },
});
