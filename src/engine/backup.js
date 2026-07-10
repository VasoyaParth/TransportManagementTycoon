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
// Export writes a real .json FILE into the phone's Downloads folder (via
// MediaStore on Android 10+, direct write on older Android). Import opens the
// system file picker and reads the chosen .json — no copy-pasting JSON.
// Auto-backup keeps a rolling copy in AsyncStorage once per real day.
import { Platform, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_VERSION, cmpVer } from '../net/updates';

let RNBlobUtil = null;
try { RNBlobUtil = require('react-native-blob-util').default; } catch (e) { RNBlobUtil = null; }
let DocumentPicker = null;
try { DocumentPicker = require('react-native-document-picker').default; } catch (e) { DocumentPicker = null; }

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

// Export: write the backup as a real file into Downloads.
// Android 10+ goes through MediaStore (no permission needed); Android 9 and
// below writes directly to the Downloads folder after asking for the legacy
// storage permission. Returns { ok, path } or { ok:false, err }.
export async function exportBackup(snapshot) {
  const payload = makeBackup(snapshot);
  const json = JSON.stringify(payload);
  const name = backupFileName(payload);
  if (!RNBlobUtil) return { ok: false, err: 'File storage module unavailable in this build.' };
  // Stage in the app cache first, then hand to the OS.
  const tmp = `${RNBlobUtil.fs.dirs.CacheDir}/${name}`;
  try { await RNBlobUtil.fs.writeFile(tmp, json, 'utf8'); }
  catch (e) { return { ok: false, err: 'Could not write the backup file.' }; }
  if (Platform.OS === 'android' && Platform.Version >= 29) {
    try {
      await RNBlobUtil.MediaCollection.copyToMediaStore(
        { name, parentFolder: 'TruckEmpire', mimeType: 'application/json' }, 'Download', tmp);
      return { ok: true, path: `Downloads/TruckEmpire/${name}` };
    } catch (e) { /* fall through to direct write */ }
  }
  try {
    if (Platform.OS === 'android' && Platform.Version < 29) {
      const perm = PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE;
      if (perm && !(await PermissionsAndroid.check(perm))) await PermissionsAndroid.request(perm);
    }
    const dest = `${RNBlobUtil.fs.dirs.DownloadDir}/${name}`;
    await RNBlobUtil.fs.cp(tmp, dest);
    return { ok: true, path: dest };
  } catch (e) {
    return { ok: false, err: 'Couldn’t save into Downloads — check storage permission and free space.' };
  }
}

// Import: open the system file picker, read the chosen .json, and return its
// text for parseBackup(). Returns { ok, text, name }, { cancelled: true }, or
// { ok:false, err }.
export async function pickBackupFile() {
  if (!DocumentPicker) return { ok: false, err: 'File picker unavailable in this build.' };
  if (!RNBlobUtil) return { ok: false, err: 'File storage module unavailable in this build.' };
  let res;
  try {
    const picked = await DocumentPicker.pick({ type: [DocumentPicker.types.allFiles], copyTo: 'cachesDirectory' });
    res = Array.isArray(picked) ? picked[0] : picked;
  } catch (e) {
    if (DocumentPicker.isCancel && DocumentPicker.isCancel(e)) return { cancelled: true };
    return { ok: false, err: 'Could not open the file picker.' };
  }
  try {
    // Prefer the local copy the picker made; fall back to the content:// URI.
    const path = (res.fileCopyUri || res.uri || '').replace(/^file:\/\//, '');
    const text = await RNBlobUtil.fs.readFile(path, 'utf8');
    return { ok: true, text, name: res.name || 'backup.json' };
  } catch (e) {
    return { ok: false, err: 'Could not read that file.' };
  }
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
