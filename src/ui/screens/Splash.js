// Splash screen — premium light entry point.
import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated, Easing, StyleSheet, SafeAreaView } from 'react-native';
import { C, FONT, SHADOW, RADIUS } from '../theme';
import { Btn, Icon, Row, useEasterEggTap } from '../components';
import { BrandEmblem, BrandWordmark } from '../BrandLogo';

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
