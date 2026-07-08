// Haptic feedback via the built-in Vibration API (no extra native module).
// Honours the player's haptics setting; safe no-op if unavailable.
import { Vibration } from 'react-native';

let enabled = true;

export function setHapticsEnabled(on) { enabled = on; }

const PATTERNS = {
  light: 12,
  medium: 22,
  success: [0, 18, 40, 30],
  warn: [0, 30, 50, 30],
  error: [0, 40, 60, 60],
};

export function haptic(kind = 'light') {
  if (!enabled) return;
  try { Vibration.vibrate(PATTERNS[kind] ?? 12); } catch (e) {}
}
