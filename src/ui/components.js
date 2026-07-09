// Shared premium UI kit: animated counters, progress bars, cards, buttons,
// toasts, modals, skeletons. Pure RN Animated (no extra native deps).
import React, { useEffect, useRef, useState, createContext, useContext } from 'react';
import {
  View, Text, Pressable, Animated, Easing, StyleSheet, Modal as RNModal, ScrollView, SafeAreaView, StatusBar, Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { C, FONT, SHADOW, RADIUS } from './theme';
import { inr, inrShort } from '../engine/economy';
import { play } from '../engine/sound';
import { haptic } from '../engine/haptics';

export { Icon };

// ---------- Animated money counter (NFR-6) ----------
export function Money({ value, short = false, style, prefixIcon, size }) {
  const anim = useRef(new Animated.Value(value)).current;
  const [disp, setDisp] = useState(value);
  const prev = useRef(value);
  const flash = useRef(new Animated.Value(0)).current; // 0 normal, 1 green
  const floatA = useRef(new Animated.Value(0)).current; // floating +delta
  const [delta, setDelta] = useState(0);

  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setDisp(v));
    Animated.timing(anim, { toValue: value, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    if (value > prev.current) {
      setDelta(value - prev.current);
      flash.setValue(1);
      Animated.timing(flash, { toValue: 0, duration: 1100, useNativeDriver: false }).start();
      floatA.setValue(0);
      Animated.timing(floatA, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }
    prev.current = value;
    return () => anim.removeListener(id);
  }, [value, anim, flash, floatA]);

  const color = flash.interpolate({ inputRange: [0, 1], outputRange: [C.text, C.green] });
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>
      {prefixIcon ? <Icon name={prefixIcon} size={14} color={C.sub} style={{ marginRight: 3 }} /> : null}
      <Animated.Text style={[FONT.mono, { fontWeight: '700', color }, size ? { fontSize: size } : null]}>{short ? inrShort(disp) : inr(disp)}</Animated.Text>
      {delta > 0 && (
        <Animated.Text pointerEvents="none" style={{
          position: 'absolute', right: 0, top: 0, fontSize: 11, fontWeight: '800', color: C.green,
          opacity: floatA.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] }),
          transform: [{ translateY: floatA.interpolate({ inputRange: [0, 1], outputRange: [0, -18] }) }],
        }}>+{inrShort(delta)}</Animated.Text>
      )}
    </View>
  );
}

// ---------- Smooth progress bar ----------
export function Progress({ pct, color = C.blue, height = 6, style }) {
  const anim = useRef(new Animated.Value(pct)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: pct, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
  }, [pct, anim]);
  return (
    <View style={[{ height, borderRadius: height / 2, backgroundColor: C.bgSoft, overflow: 'hidden' }, style]}>
      <Animated.View style={{
        height, borderRadius: height / 2, backgroundColor: color,
        width: anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'], extrapolate: 'clamp' }),
      }} />
    </View>
  );
}

// ---------- Card ----------
export function Card({ children, style, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const body = (
    <Animated.View style={[st.card, SHADOW.card, style, onPress && { transform: [{ scale }] }]}>
      {children}
    </Animated.View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 40 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40 }).start()}
    >{body}</Pressable>
  );
}

// ---------- Buttons ----------
export function Btn({ title, onPress, kind = 'primary', icon, disabled, small, style }) {
  const scale = useRef(new Animated.Value(1)).current;
  const colors = {
    primary: { bg: C.text, fg: '#fff' },
    green: { bg: C.green, fg: '#fff' },
    blue: { bg: C.blue, fg: '#fff' },
    danger: { bg: C.red, fg: '#fff' },
    ghost: { bg: 'transparent', fg: C.text },
    soft: { bg: C.bgSoft, fg: C.text },
  }[kind];
  return (
    <Pressable
      disabled={disabled} onPress={(...a) => { play('tap', 0.5); haptic('light'); onPress && onPress(...a); }}
      onPressIn={() => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 40 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40 }).start()}
    >
      <Animated.View style={[st.btn, small && st.btnSmall, { backgroundColor: colors.bg, opacity: disabled ? 0.4 : 1, transform: [{ scale }] },
        kind === 'ghost' && { borderWidth: 1, borderColor: C.border }, style]}>
        {icon ? <Icon name={icon} size={small ? 15 : 17} color={colors.fg} style={{ marginRight: 6 }} /> : null}
        <Text style={{ color: colors.fg, fontWeight: '700', fontSize: small ? 13 : 15 }}>{title}</Text>
      </Animated.View>
    </Pressable>
  );
}

export function IconBtn({ name, onPress, badge, color = C.text, size = 22, style }) {
  return (
    <Pressable onPress={(...a) => { play('click', 0.4); haptic('light'); onPress && onPress(...a); }} style={[st.iconBtn, style]} hitSlop={6}>
      <Icon name={name} size={size} color={color} />
      {badge ? (
        <View style={st.badge}><Text style={st.badgeTxt}>{badge > 9 ? '9+' : badge}</Text></View>
      ) : null}
    </Pressable>
  );
}

// ---------- Pills / labels ----------
export function Pill({ text, color = C.blue, bg = C.blueSoft, icon }) {
  return (
    <View style={[st.pill, { backgroundColor: bg }]}>
      {icon ? <Icon name={icon} size={12} color={color} style={{ marginRight: 4 }} /> : null}
      <Text style={{ color, fontSize: 11.5, fontWeight: '700' }}>{text}</Text>
    </View>
  );
}

export const statusMeta = {
  parked: { label: 'Parked', color: C.blue, bg: C.blueSoft, icon: 'parking' },
  delivering: { label: 'On Delivery', color: C.green, bg: C.greenSoft, icon: 'truck-fast' },
  building: { label: 'Building', color: C.amber, bg: C.amberSoft, icon: 'factory' },
  broken: { label: 'Broken', color: C.red, bg: C.redSoft, icon: 'alert' },
};

// ---------- Skeleton loader ----------
export function Skeleton({ w = '100%', h = 14, r = 6, style }) {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
    ])).start();
  }, [anim]);
  return <Animated.View style={[{ width: w, height: h, borderRadius: r, backgroundColor: C.border, opacity: anim }, style]} />;
}

// ---------- Modal sheet ----------
export function Sheet({ visible, onClose, title, children, height = '82%' }) {
  const slide = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(slide, { toValue: visible ? 1 : 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [visible, slide]);
  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={st.dim} onPress={onClose} />
      <Animated.View style={[st.sheet, SHADOW.pop, { height, transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }] }]}>
        <View style={st.sheetHead}>
          <Text style={FONT.h2}>{title}</Text>
          <IconBtn name="close" onPress={onClose} />
        </View>
        <View style={{ flex: 1 }}>{children}</View>
      </Animated.View>
    </RNModal>
  );
}

// ---------- Toasts ----------
const ToastCtx = createContext(null);
export function useToast() { return useContext(ToastCtx); }

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = (msg, kind = 'info') => {
    const id = Math.random().toString(36);
    setToasts(t => [...t.slice(-2), { id, msg, kind }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200);
  };
  return (
    <ToastCtx.Provider value={push}>
      {children}
      {/* Toasts live in their own top-level Modal so they always float ABOVE any
          open Sheet (a native Modal), and drop in just below the header. */}
      <RNModal visible={toasts.length > 0} transparent animationType="none" onRequestClose={() => {}}>
        <SafeAreaView pointerEvents="box-none" style={{ flex: 1 }}>
          <View pointerEvents="box-none" style={st.toastWrap}>
            {toasts.map(t => <ToastItem key={t.id} {...t} />)}
          </View>
        </SafeAreaView>
      </RNModal>
    </ToastCtx.Provider>
  );
}

function ToastItem({ msg, kind }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }).start();
    haptic(kind === 'error' ? 'error' : kind === 'warn' ? 'warn' : kind === 'success' ? 'success' : 'light');
  }, [anim, kind]);
  const meta = {
    info: { icon: 'information', color: C.blue },
    success: { icon: 'check-circle', color: C.green },
    error: { icon: 'alert-circle', color: C.red },
    warn: { icon: 'alert', color: C.amber },
  }[kind] || { icon: 'information', color: C.blue };
  return (
    <Animated.View style={[st.toast, SHADOW.pop, {
      opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
    }]}>
      <Icon name={meta.icon} size={18} color={meta.color} style={{ marginRight: 8 }} />
      <Text style={[FONT.body, { flex: 1, fontWeight: '600' }]} numberOfLines={2}>{msg}</Text>
    </Animated.View>
  );
}

// ---------- Stat card ----------
export function Stat({ icon, label, value, color = C.text, sub }) {
  return (
    <Card style={{ flex: 1, padding: 12, minWidth: 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        <Icon name={icon} size={15} color={C.sub} />
        <Text style={[FONT.tiny, { marginLeft: 5, textTransform: 'uppercase', letterSpacing: 0.4 }]}>{label}</Text>
      </View>
      <Text style={[FONT.h3, { color, fontSize: 17 }]}>{value}</Text>
      {sub ? <Text style={FONT.tiny}>{sub}</Text> : null}
    </Card>
  );
}

export function Row({ children, style }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>{children}</View>;
}

export function relTime(ts) {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const st = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: C.border, padding: 14 },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, paddingHorizontal: 20, borderRadius: 26, // pill
  },
  btnSmall: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 22 },
  iconBtn: { padding: 8, borderRadius: 20 },
  badge: {
    position: 'absolute', top: 2, right: 2, backgroundColor: C.red, minWidth: 16, height: 16,
    borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  badgeTxt: { color: '#fff', fontSize: 9.5, fontWeight: '800' },
  pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start' },
  dim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(11,15,20,0.45)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.bg,
    borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: 16, paddingBottom: 24,
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  // Below the floating header pill, at the very top. On Android SafeAreaView
  // doesn't inset, so add the status-bar height manually.
  toastWrap: {
    position: 'absolute', left: 16, right: 16,
    top: 62 + (Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0),
  },
  toast: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: C.border, paddingVertical: 10, paddingHorizontal: 12, marginTop: 8,
  },
});
