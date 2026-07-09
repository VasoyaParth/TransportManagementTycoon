// Real OS notifications (Android) via Notifee. The in-game notification centre
// is unchanged; this ADDS actual phone notifications so the player still hears
// about their empire while the app is closed.
//
// The magic for "app closed" is TRIGGER notifications: when a delivery starts
// we schedule OS notifications at the exact future timestamps of each fuel
// stop and the final drop-off, so Android fires them even if the game isn't
// running. Live events (theft, windfall…) fire immediately while playing.
//
// Every call is wrapped so a missing/blocked module simply no-ops — the game
// never crashes if notifications aren't available.

let notifee = null;
let TriggerType = null;
let AndroidImportance = null;
try {
  // Lazy require so a bundler/runtime without the native module degrades gracefully.
  const mod = require('@notifee/react-native');
  notifee = mod.default;
  TriggerType = mod.TriggerType;
  AndroidImportance = mod.AndroidImportance;
} catch (e) { notifee = null; }

const CHANNEL_ID = 'truck-empire';
let inited = false;
let enabled = true;

export function setNotificationsEnabled(on) { enabled = on !== false; }

// Ask permission + create the Android channel. Safe to call more than once.
export async function initNotifications() {
  if (!notifee || inited) return;
  try {
    inited = true;
    await notifee.requestPermission();
    await notifee.createChannel({
      id: CHANNEL_ID, name: 'Truck Empire', importance: AndroidImportance ? AndroidImportance.HIGH : 4,
    });
  } catch (e) { /* notifications unavailable — ignore */ }
}

const androidOpts = () => ({ channelId: CHANNEL_ID, smallIcon: 'ic_launcher', pressAction: { id: 'default' } });

// Fire a notification right now (used for live world events).
export async function pushNow(title, body) {
  if (!notifee || !enabled) return;
  try {
    await notifee.displayNotification({ title, body, android: androidOpts() });
  } catch (e) { /* ignore */ }
}

// Schedule a notification for a future moment (works with the app closed).
export async function scheduleAt(timestamp, id, title, body) {
  if (!notifee || !enabled || !TriggerType) return;
  if (!timestamp || timestamp <= Date.now() + 3000) return; // skip near-past
  try {
    await notifee.createTriggerNotification(
      { id: String(id), title, body, android: androidOpts() },
      { type: TriggerType.TIMESTAMP, timestamp: Math.round(timestamp) },
    );
  } catch (e) { /* ignore */ }
}

export async function cancelScheduled(id) {
  if (!notifee) return;
  try { await notifee.cancelTriggerNotification(String(id)); } catch (e) { /* ignore */ }
}
