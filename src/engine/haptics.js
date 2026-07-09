// Haptic feedback via the built-in Vibration API (no extra native module).
// Honours the player's haptics setting; safe no-op if unavailable.
import { Vibration } from 'react-native';

let enabled = true;
// Vibration intensity — scales every pattern's pulse durations so "Short"
// feels like a light tap and "Long" feels like a stronger buzz, without
// needing a separate pattern set per kind.
const INTENSITY_SCALE = { short: 0.6, medium: 1, long: 1.7 };
let intensity = 'medium';

export function setHapticsEnabled(on) { enabled = on; }
export function setHapticsIntensity(level) { if (INTENSITY_SCALE[level] != null) intensity = level; }

const PATTERNS = {
  light: 12,
  medium: 22,
  success: [0, 18, 40, 30],
  warn: [0, 30, 50, 30],
  error: [0, 40, 60, 60],
};

const scalePattern = (p, f) => (Array.isArray(p) ? p.map(v => Math.round(v * f)) : Math.round(p * f));

export function haptic(kind = 'light') {
  if (!enabled) return;
  try { Vibration.vibrate(scalePattern(PATTERNS[kind] ?? 12, INTENSITY_SCALE[intensity])); } catch (e) {}
}
