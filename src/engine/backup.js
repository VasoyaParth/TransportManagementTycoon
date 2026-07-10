// Full-save backup: export / import / auto-backup.
//
// A backup is the COMPLETE game state (every field zustand persists — company,
// balance, trucks, deliveries, hubs, unlocked countries, achievements, eggs,
// settings… A to Z) wrapped in a versioned envelope:
//
//   { app: 'truck-empire-tycoon', kind: 'save-backup', format: 1,
//     version: 'v2.1.0', savedAt: '2026-07-10T…', device: 'android', data: {…} }
//
// Compatibility rule: a backup can be imported into the SAME or a NEWER app
// version (missing new fields fall back to initialState defaults), never into
// an older app — that's rejected with a clear message.
//
// Export writes a .json file to the phone's Downloads folder when the native
// file module is available, and always offers the OS share sheet as well, so
// the backup can be moved to another device over WhatsApp/Drive/anything.
// Auto-backup keeps a rolling copy in AsyncStorage once per real day.
import { Platform, Share } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_VERSION, cmpVer } from '../net/updates';

let RNBlobUtil = null;
try { RNBlobUtil = require('react-native-blob-util').default; } catch (e) { RNBlobUtil = null; }

export const BACKUP_APP = 'truck-empire-tycoon';
export const BACKUP_KIND = 'save-backup';
export const BACKUP_FORMAT = 1;
const AUTO_BACKUP_KEY = 'truck-empire-auto-backup';

// Wrap a plain state snapshot in the versioned envelope.
export function makeBackup(snapshot) {
  return {
    app: BACKUP_APP,
    kind: BACKUP_KIND,
    format: BACKUP_FORMAT,
    version: APP_VERSION,
    savedAt: new Date().toISOString(),
    device: Platform.OS,
    data: snapshot,
  };
}

// "TruckEmpire-backup-v2.1.0-2026-07-10.json"
export function backupFileName(payload) {
  const day = (payload.savedAt || new Date().toISOString()).slice(0, 10);
  return `TruckEmpire-backup-${payload.version}-${day}.json`;
}

// Validate + version-gate a pasted/opened backup. Returns {ok, data, meta} or
// {ok:false, err}. Accepts same-or-older backup version than the running app.
export function parseBackup(text) {
  let payload;
  try { payload = JSON.parse(String(text || '').trim()); }
  catch (e) { return { ok: false, err: 'That doesn’t look like a backup — paste the full JSON exactly as exported.' }; }
  if (!payload || payload.app !== BACKUP_APP || payload.kind !== BACKUP_KIND || !payload.data || typeof payload.data !== 'object') {
    return { ok: false, err: 'Not a Truck Empire Tycoon backup file.' };
  }
  if ((payload.format || 1) > BACKUP_FORMAT) {
    return { ok: false, err: 'Backup format is newer than this app understands — update the app first.' };
  }
  if (cmpVer(payload.version, APP_VERSION) > 0) {
    return { ok: false, err: `This backup is from ${payload.version}, but you're on ${APP_VERSION}. Update the app to import it.` };
  }
  if (!payload.data.company) {
    return { ok: false, err: 'Backup has no game inside (empty save).' };
  }
  return { ok: true, data: payload.data, meta: { version: payload.version, savedAt: payload.savedAt } };
}

// Export: best-effort write to Downloads (visible in any file manager), then
// the OS share sheet with the JSON as text — works with zero permissions.
// Returns { ok, file } where file is the written path or null.
export async function exportBackup(snapshot) {
  const payload = makeBackup(snapshot);
  const json = JSON.stringify(payload);
  let file = null;
  if (RNBlobUtil && Platform.OS === 'android') {
    try {
      const path = `${RNBlobUtil.fs.dirs.DownloadDir}/${backupFileName(payload)}`;
      await RNBlobUtil.fs.writeFile(path, json, 'utf8');
      file = path;
    } catch (e) { file = null; /* scoped storage may refuse — share sheet still works */ }
  }
  try {
    await Share.share(
      { message: json, title: backupFileName(payload) },
      { dialogTitle: 'Share your Truck Empire backup' },
    );
  } catch (e) { /* user closed the sheet — the Downloads copy (if any) remains */ }
  return { ok: true, file };
}

// ---- Auto-backup (rolling, once per real day, local) ----
export async function writeAutoBackup(snapshot) {
  try { await AsyncStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify(makeBackup(snapshot))); return true; }
  catch (e) { return false; }
}

export async function readAutoBackup() {
  try {
    const raw = await AsyncStorage.getItem(AUTO_BACKUP_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    return (p && p.app === BACKUP_APP && p.data) ? p : null;
  } catch (e) { return null; }
}
