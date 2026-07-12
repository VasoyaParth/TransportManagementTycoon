// Shared premium UI kit: animated counters, progress bars, cards, buttons,
// toasts, modals, skeletons. Pure RN Animated (no extra native deps).
import React, { useEffect, useRef, useState, createContext, useContext } from 'react';
import {
  View, Text, Pressable, Animated, Easing, StyleSheet, Modal as RNModal, ScrollView, StatusBar, Platform, PanResponder,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { C, FONT, SHADOW, RADIUS } from './theme';
import { inr, inrShort } from '../engine/economy';
import { play } from '../engine/sound';
import { haptic } from '../engine/haptics';
import { useGame } from '../store/gameStore';

export { Icon };

// Hidden-gem tap detector — call the returned function from an existing
// onPress; once it sees `times` taps within `windowMs` of each other it
// fires the one-time easter-egg reward and resets. Safe no-op after the egg
// is already found (store just returns { ok: false, already: true }).
export function useEasterEggTap(eggId, times = 5, windowMs = 1400) {
  const ref = useRef({ count: 0, timer: null });
  const findEasterEgg = useGame(s => s.findEasterEgg);
  return () => {
    const st = ref.current;
    st.count += 1;
    if (st.timer) clearTimeout(st.timer);
    st.timer = setTimeout(() => { st.count = 0; }, windowMs);
    if (st.count >= times) {
      st.count = 0;
      return findEasterEgg(eggId);
    }
    return null;
  };
}

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
      {/* Mirror the global toast stack inside the modal window so toasts stay
          visible above open sheets (see toast store note below). */}
      <ToastStack />
    </RNModal>
  );
}

// ---------- Toasts ----------
// Toast state lives in a tiny module-level store (not just React context) so
// the SAME stack can be rendered both at the app root and inside every open
// Sheet's RN Modal window — a plain overlay can't sit above a Modal, so the
// Sheet mirrors the stack and toasts stay visible while any modal is open.
const ToastCtx = createContext(null);
export function useToast() { return useContext(ToastCtx); }

const toastStore = { toasts: [], subs: new Set() };
function toastNotify() { toastStore.subs.forEach(fn => fn(toastStore.toasts)); }
export function pushToast(msg, kind = 'info') {
  const id = Math.random().toString(36);
  toastStore.toasts = [...toastStore.toasts.slice(-3), { id, msg, kind }];
  toastNotify();
  setTimeout(() => { toastStore.toasts = toastStore.toasts.filter(x => x.id !== id); toastNotify(); }, 3200);
}
function useToastList() {
  const [list, setList] = useState(toastStore.toasts);
  useEffect(() => { toastStore.subs.add(setList); return () => toastStore.subs.delete(setList); }, []);
  return list;
}

// AWS-console style stack: newest on top, colored status rail, pinned to the
// very top of the window (above the floating header). pointerEvents="none"
// keeps the whole screen touchable.
export function ToastStack() {
  const toasts = useToastList();
  if (!toasts.length) return null;
  return (
    <View pointerEvents="none" style={st.toastWrap}>
      {[...toasts].reverse().map(t => <ToastItem key={t.id} {...t} />)}
    </View>
  );
}

export function ToastProvider({ children }) {
  return (
    <ToastCtx.Provider value={pushToast}>
      {children}
      <ToastStack />
    </ToastCtx.Provider>
  );
}

const TOAST_META = {
  info: { icon: 'information', color: C.blue, title: 'Info' },
  success: { icon: 'check-circle', color: C.green, title: 'Success' },
  error: { icon: 'alert-circle', color: C.red, title: 'Error' },
  warn: { icon: 'alert', color: C.amber, title: 'Warning' },
};

function ToastItem({ msg, kind }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }).start();
    haptic(kind === 'error' ? 'error' : kind === 'warn' ? 'warn' : kind === 'success' ? 'success' : 'light');
  }, [anim, kind]);
  const meta = TOAST_META[kind] || TOAST_META.info;
  return (
    <Animated.View style={[st.toast, SHADOW.pop, { borderLeftColor: meta.color, borderLeftWidth: 4 },
      { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }] }]}>
      <Icon name={meta.icon} size={18} color={meta.color} style={{ marginRight: 8 }} />
      <View style={{ flex: 1 }}>
        <Text style={[FONT.tiny, { fontWeight: '800', color: meta.color, textTransform: 'uppercase', letterSpacing: 0.4 }]}>{meta.title}</Text>
        <Text style={[FONT.body, { fontWeight: '600' }]} numberOfLines={2}>{msg}</Text>
      </View>
    </Animated.View>
  );
}

// ---------- Slider ----------
// Drag/tap slider with a tick per step: subtle haptic + click sound on every
// value change. Replaces +/- steppers anywhere a range is picked (gold→cash,
// cargo pricing, volume). Pure RN, no native slider dependency.
export function GameSlider({ min = 0, max = 100, step = 1, value, onChange, minLabel, maxLabel, color = C.blue }) {
  const [w, setW] = useState(1);
  const stateRef = useRef({});
  stateRef.current = { w, min, max, step, value, onChange };
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: e => handle(e.nativeEvent.locationX),
    onPanResponderMove: e => handle(e.nativeEvent.locationX),
  })).current;
  const handle = (x) => {
    const s = stateRef.current;
    const f = Math.min(1, Math.max(0, x / (s.w || 1)));
    const raw = s.min + f * (s.max - s.min);
    const v = Math.min(s.max, Math.max(s.min, Math.round(raw / s.step) * s.step));
    if (v !== s.value) { haptic('light'); play('tap', 0.25); s.onChange(v); }
  };
  const f = (Math.min(max, Math.max(min, value)) - min) / ((max - min) || 1);
  return (
    <View>
      <View {...pan.panHandlers} onLayout={e => setW(e.nativeEvent.layout.width)}
        style={{ height: 36, justifyContent: 'center' }} hitSlop={{ top: 6, bottom: 6 }}>
        <View style={sl.track} />
        <View style={[sl.fill, { width: `${f * 100}%`, backgroundColor: color }]} />
        <View style={[sl.thumb, { left: `${f * 100}%`, borderColor: color }]} pointerEvents="none" />
      </View>
      {(minLabel != null || maxLabel != null) && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={FONT.tiny}>{minLabel}</Text>
          <Text style={FONT.tiny}>{maxLabel}</Text>
        </View>
      )}
    </View>
  );
}

const sl = StyleSheet.create({
  track: { height: 6, borderRadius: 3, backgroundColor: C.border },
  fill: { position: 'absolute', height: 6, borderRadius: 3 },
  thumb: {
    position: 'absolute', width: 22, height: 22, borderRadius: 11, marginLeft: -11,
    backgroundColor: '#fff', borderWidth: 3, elevation: 2,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
  },
});

// ---------- Stat card ----------
export function Stat({ icon, label, value, color = C.text, sub }) {
  return (
    <Card style={{ flex: 1, padding: 12, minWidth: 0, minHeight: 78, justifyContent: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        <Icon name={icon} size={15} color={C.sub} />
        <Text style={[FONT.tiny, { marginLeft: 5, textTransform: 'uppercase', letterSpacing: 0.4 }]} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={[FONT.h3, { color, fontSize: 17 }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      {sub ? <Text style={FONT.tiny} numberOfLines={1}>{sub}</Text> : null}
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
  // Very top of the window, above the floating header pill. On Android
  // SafeAreaView doesn't inset, so add the status-bar height manually.
  toastWrap: {
    position: 'absolute', left: 16, right: 16,
    top: 8 + (Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0),
  },
  toast: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: C.border, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 8,
  },
});
