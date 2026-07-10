// Brand identity — the one place the Truck Empire Tycoon logo lives.
// A navy shield with a gold long-haul rig over a highway stripe, plus the
// stacked wordmark. Used on the splash screen, About page and anywhere else
// the brand shows, so the mark is always identical.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Path, Circle, G } from 'react-native-svg';

const NAVY = '#0F1D30';
const NAVY_LIGHT = '#1A2C44';
const GOLD = '#E9B949';
const GOLD_DEEP = '#C9932A';
const INK = '#0B1421';

// The shield emblem. size = rendered square size in px.
export function BrandEmblem({ size = 120 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      {/* shield plate + double gold rim */}
      <Rect x={5} y={5} width={110} height={110} rx={30} fill={INK} />
      <Rect x={8} y={8} width={104} height={104} rx={27} fill={NAVY} />
      <Rect x={8} y={8} width={104} height={104} rx={27} fill="none" stroke={GOLD} strokeWidth={3} />
      <Rect x={14} y={14} width={92} height={92} rx={22} fill="none" stroke={GOLD} strokeWidth={1} opacity={0.35} />
      {/* rising sun behind the rig */}
      <Circle cx={84} cy={40} r={11} fill={GOLD} opacity={0.28} />
      <Circle cx={84} cy={40} r={7} fill={GOLD} opacity={0.5} />
      {/* speed swashes */}
      <Rect x={14} y={56} width={11} height={3.4} rx={1.7} fill={GOLD} opacity={0.55} />
      <Rect x={10} y={64} width={15} height={3.4} rx={1.7} fill={GOLD} opacity={0.8} />
      {/* trailer */}
      <Rect x={28} y={50} width={40} height={26} rx={3} fill={GOLD} />
      <Rect x={28} y={50} width={40} height={5} rx={2.5} fill="#F7D57C" />
      <Rect x={45} y={56} width={2} height={17} fill={GOLD_DEEP} opacity={0.7} />
      {/* cab — long-nose rig facing right */}
      <Path d="M70 76 L70 55 L84 55 L94 66 L94 76 Z" fill={GOLD} />
      <Path d="M73 58.5 L82.5 58.5 L89 66 L73 66 Z" fill={NAVY_LIGHT} />
      <Rect x={68} y={47} width={3.4} height={9} rx={1.6} fill={GOLD_DEEP} />
      {/* wheels */}
      <G>
        <Circle cx={35} cy={78} r={6.4} fill={INK} stroke={GOLD} strokeWidth={2.2} />
        <Circle cx={49} cy={78} r={6.4} fill={INK} stroke={GOLD} strokeWidth={2.2} />
        <Circle cx={84} cy={78} r={6.4} fill={INK} stroke={GOLD} strokeWidth={2.2} />
        <Circle cx={35} cy={78} r={1.9} fill={GOLD} />
        <Circle cx={49} cy={78} r={1.9} fill={GOLD} />
        <Circle cx={84} cy={78} r={1.9} fill={GOLD} />
      </G>
      {/* highway stripe */}
      <Rect x={16} y={90} width={88} height={4.4} rx={2.2} fill={GOLD} />
      <Rect x={26} y={98} width={14} height={2.6} rx={1.3} fill={GOLD} opacity={0.45} />
      <Rect x={52} y={98} width={14} height={2.6} rx={1.3} fill={GOLD} opacity={0.45} />
      <Rect x={78} y={98} width={14} height={2.6} rx={1.3} fill={GOLD} opacity={0.45} />
    </Svg>
  );
}

// Stacked wordmark: TRUCK EMPIRE over a gold TYCOON banner.
export function BrandWordmark({ dark = false, scale = 1 }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={[st.top, { fontSize: 30 * scale, color: dark ? '#F2F5FA' : NAVY }]}>TRUCK EMPIRE</Text>
      <View style={[st.band, { paddingHorizontal: 14 * scale, paddingVertical: 3.5 * scale, borderRadius: 7 * scale, marginTop: 5 * scale }]}>
        <Text style={[st.bottom, { fontSize: 16 * scale }]}>T Y C O O N</Text>
      </View>
    </View>
  );
}

// Emblem + wordmark lockup.
export function BrandLockup({ size = 120, dark = false, scale = 1 }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <BrandEmblem size={size} />
      <View style={{ height: 18 * scale }} />
      <BrandWordmark dark={dark} scale={scale} />
    </View>
  );
}

const st = StyleSheet.create({
  top: { fontWeight: '900', letterSpacing: 1.5 },
  band: { backgroundColor: GOLD },
  bottom: { fontWeight: '900', color: NAVY, letterSpacing: 2 },
});
