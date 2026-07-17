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
let AndroidStyle = null;
try {
  // Lazy require so a bundler/runtime without the native module degrades gracefully.
  const mod = require('@notifee/react-native');
  notifee = mod.default;
  TriggerType = mod.TriggerType;
  AndroidImportance = mod.AndroidImportance;
  AndroidStyle = mod.AndroidStyle;
} catch (e) { notifee = null; }

// ---------- Flavour lines ----------
// Every push picks a random line from its pool so the phone never repeats the
// same "Cha-ching!" twice in a row. Templates get {truck, city, station,
// amount} vars where relevant. Desi trucker humour encouraged.
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const FLAVORS = {
  deliveryDone: [
    v => ({ title: 'Delivery complete! 💰', body: `Cha-ching! ${v.truck} rolled into ${v.city} — payment's in your account.` }),
    v => ({ title: 'Mission accomplished 🚚', body: `${v.truck} dropped the goods at ${v.city}. Client's happy, wallet's happier.` }),
    v => ({ title: 'Paisa aa gaya! 🤑', body: `${v.truck} delivered to ${v.city}. Driver says the roadside chai there is elite.` }),
    v => ({ title: 'Horn OK Please ✅', body: `${v.truck} conquered the road to ${v.city}. Money credited, ego inflated.` }),
    v => ({ title: 'Another one in the books 📦', body: `${v.city} signed for the cargo. ${v.truck} is parked and proud.` }),
    v => ({ title: 'Boss, delivery done! 🎉', body: `${v.truck} reached ${v.city} safe and sound. Time to book the next load.` }),
    v => ({ title: 'Special delivery! 🛻', body: `${v.truck} made it to ${v.city} without a scratch. Well… almost. Payment received!` }),
  ],
  fuelStop: [
    v => ({ title: 'Pit stop! ⛽', body: `${v.truck} is refuelling${v.station ? ` at ${v.station}` : ' en route'}. Chai time for the driver.` }),
    v => ({ title: 'Tank khali, driver bhi 😴', body: `${v.truck} pulled in${v.station ? ` at ${v.station}` : ''} — diesel for the truck, samosa for the driver.` }),
    v => ({ title: 'Fuel break 🍵', body: `${v.truck} is topping up${v.station ? ` at ${v.station}` : ''}. The dhaba's paneer is apparently "life-changing".` }),
    v => ({ title: 'Quick splash & dash ⛽', body: `${v.truck} grabbing fuel${v.station ? ` at ${v.station}` : ''}. Back on the highway in no time.` }),
  ],
  theft: [
    v => ({ title: 'Uh oh — cargo theft! 🥷', body: `Bandits made off with ${v.amount} of goods near ${v.city}. They even left a thank-you note.` }),
    v => ({ title: 'Daylight robbery! 😤', body: `${v.amount} worth of cargo vanished near ${v.city}. The watchman was "on a tea break".` }),
    v => ({ title: 'Chor alert! 🚨', body: `Thieves lifted ${v.amount} of goods near ${v.city}. Karma is loading… slowly, like a full truck uphill.` }),
  ],
  breakdown: [
    v => ({ title: 'Breakdown on the road! 🔧', body: `${v.truck} conked out and needs a mechanic. Send help (and maybe a snack for the driver).` }),
    v => ({ title: 'Truck ne haath khade kar diye 🛠️', body: `${v.truck} refuses to move another metre. A mechanic and some sweet-talking required.` }),
    v => ({ title: 'Engine says no 💨', body: `${v.truck} broke down mid-route. It's not lazy, it's "resting strategically".` }),
  ],
  windfall: [
    v => ({ title: 'Surprise bonus! 🎁', body: `A loyal client just tipped you ${v.amount}${v.city ? ` in ${v.city}` : ''}. Cha-ching!` }),
    v => ({ title: 'Free paisa alert 💸', body: `${v.amount} landed in your account${v.city ? ` from a happy client in ${v.city}` : ''}. No, it's not a scam.` }),
    v => ({ title: 'Client love! ❤️', body: `Someone${v.city ? ` in ${v.city}` : ''} liked your service so much they sent ${v.amount}. Frame this moment.` }),
  ],
  truckReady: [
    v => ({ title: 'Truck ready to roll! 🏭', body: `${v.truck} just rolled off the line at ${v.city}. Still has that new-truck smell.` }),
    v => ({ title: 'Fresh wheels alert 🚛', body: `Your ${v.truck} is built and waiting at ${v.city}. It's judging you for letting it sit idle.` }),
    v => ({ title: 'Naya truck, naya sapna ✨', body: `${v.truck} is ready at ${v.city}. Garland optional, deliveries mandatory.` }),
    v => ({ title: 'Beast unleashed! 💪', body: `${v.truck} finished building at ${v.city}. The highways have been warned.` }),
  ],
};
// Random flavoured {title, body} for a kind; falls back to blanks if unknown.
export function flavor(kind, vars = {}) {
  const pool = FLAVORS[kind];
  return pool ? pick(pool)(vars) : { title: '', body: '' };
}

const CHANNEL_ID = 'airline-empire';
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
      id: CHANNEL_ID, name: 'Airline Empire', importance: AndroidImportance ? AndroidImportance.HIGH : 4,
    });
  } catch (e) { /* notifications unavailable — ignore */ }
}

// Long bodies expand with Android's BigText style so funny lines aren't
// truncated to one ellipsised row in the shade.
const androidOpts = (body) => ({
  channelId: CHANNEL_ID, smallIcon: 'ic_launcher', pressAction: { id: 'default' },
  ...(AndroidStyle && body && body.length > 44 ? { style: { type: AndroidStyle.BIGTEXT, text: body } } : {}),
});

// Fire a notification right now (used for live world events).
export async function pushNow(title, body) {
  if (!notifee || !enabled) return;
  try {
    await notifee.displayNotification({ title, body, android: androidOpts(body) });
  } catch (e) { /* ignore */ }
}

// Schedule a notification for a future moment (works with the app closed).
export async function scheduleAt(timestamp, id, title, body) {
  if (!notifee || !enabled || !TriggerType) return;
  if (!timestamp || timestamp <= Date.now() + 3000) return; // skip near-past
  try {
    await notifee.createTriggerNotification(
      { id: String(id), title, body, android: androidOpts(body) },
      { type: TriggerType.TIMESTAMP, timestamp: Math.round(timestamp) },
    );
  } catch (e) { /* ignore */ }
}

export async function cancelScheduled(id) {
  if (!notifee) return;
  try { await notifee.cancelTriggerNotification(String(id)); } catch (e) { /* ignore */ }
}
