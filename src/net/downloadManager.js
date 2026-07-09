// Background APK download manager — a module-level singleton (NOT tied to any
// screen) so a download keeps running when you switch tabs/drawers, and the UI
// simply re-subscribes to the current progress instead of restarting from 0.
//
// It downloads the APK to a real file ONCE (react-native-blob-util), then hands
// that local file to Android's package installer via an intent — so there is a
// single download and the install actually happens (no re-download in Chrome).
import { useEffect, useState } from 'react';
import { Linking } from 'react-native';

let RNBlobUtil = null;
try { RNBlobUtil = require('react-native-blob-util').default; } catch (e) { RNBlobUtil = null; }

export function nativeDownloadAvailable() { return !!RNBlobUtil; }

// status: idle | downloading | done | error
let state = { status: 'idle', loaded: 0, total: 0, pct: 0, version: null, filePath: null, error: null, url: null };
let task = null;
const subs = new Set();

function emit(patch) {
  state = { ...state, ...patch };
  subs.forEach(fn => { try { fn(state); } catch (e) {} });
}

export function getDownloadState() { return state; }
export function subscribeDownload(fn) { subs.add(fn); return () => subs.delete(fn); }

// React hook to read live download state anywhere.
export function useDownloadState() {
  const [s, setS] = useState(state);
  useEffect(() => subscribeDownload(setS), []);
  return s;
}

// Start (or resume awareness of) a download. If the same version is already
// downloading or finished, this is a no-op — it will NOT restart from 0.
export async function startDownload(url, version) {
  if (!url) return;
  if ((state.status === 'downloading' || state.status === 'done') && state.version === version) return;

  if (!RNBlobUtil) {
    // No native downloader: fall back to opening the link in the browser.
    emit({ status: 'error', error: 'Native downloader unavailable', version, url });
    try { await Linking.openURL(url); } catch (e) {}
    return;
  }

  emit({ status: 'downloading', loaded: 0, total: 0, pct: 0, version, url, filePath: null, error: null });
  try {
    const path = `${RNBlobUtil.fs.dirs.CacheDir}/TruckEmpire-${version || 'latest'}.apk`;
    task = RNBlobUtil.config({ path, fileCache: true, overwrite: true, appendExt: 'apk' }).fetch('GET', url);
    task.progress({ count: 1, interval: 250 }, (received, total) => {
      const r = Number(received) || 0, t = Number(total) || 0;
      emit({ loaded: r, total: t, pct: t > 0 ? Math.min(100, Math.round((r / t) * 100)) : state.pct });
    });
    const res = await task;
    emit({ status: 'done', pct: 100, filePath: res.path() });
  } catch (e) {
    const msg = String((e && e.message) || e || '');
    if (/cancel/i.test(msg)) emit({ status: 'idle', pct: 0, loaded: 0, total: 0 });
    else emit({ status: 'error', error: msg || 'Download failed' });
  }
}

// Launch the installer on the already-downloaded local APK (single download).
export async function installDownloaded() {
  if (!RNBlobUtil) { if (state.url) { try { await Linking.openURL(state.url); } catch (e) {} } return { ok: false, err: 'Native installer unavailable' }; }
  if (!state.filePath) return { ok: false, err: 'Nothing downloaded yet' };
  try {
    await RNBlobUtil.android.actionViewIntent(state.filePath, 'application/vnd.android.package-archive');
    return { ok: true };
  } catch (e) {
    return { ok: false, err: (e && e.message) || 'Could not open the installer' };
  }
}

export function cancelDownload() {
  try { if (task) task.cancel(); } catch (e) {}
  emit({ status: 'idle', pct: 0, loaded: 0, total: 0, filePath: null });
}

export function fmtMB(bytes) {
  if (!bytes && bytes !== 0) return '—';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
