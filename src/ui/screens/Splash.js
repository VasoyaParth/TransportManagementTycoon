// Splash screen — premium light entry point.
import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, StyleSheet, SafeAreaView } from 'react-native';
import { C, FONT, SHADOW, RADIUS } from '../theme';
import { Btn, Icon, Row } from '../components';

export default function Splash({ onNew, onContinue, hasSave }) {
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(24)).current;
  const btnFade = useRef(new Animated.Value(0)).current;
  const btnSlide = useRef(new Animated.Value(30)).current;

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
          <View style={[st.iconCircle, SHADOW.pop]}>
            <Icon name="truck-fast" size={64} color="#fff" />
          </View>
          <Text style={st.title}>Truck Empire</Text>
          <Text style={st.titleAccent}>Tycoon</Text>
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
  iconCircle: {
    width: 128, height: 128, borderRadius: 64, backgroundColor: C.text,
    alignItems: 'center', justifyContent: 'center', marginBottom: 28,
  },
  title: { fontSize: 34, fontWeight: '800', color: C.text, letterSpacing: -0.8 },
  titleAccent: { fontSize: 34, fontWeight: '800', color: C.blue, letterSpacing: -0.8, marginTop: -4 },
  tagline: { ...FONT.sub, textAlign: 'center', marginTop: 14, lineHeight: 19 },
  footer: { justifyContent: 'center', paddingBottom: 24 },
});
