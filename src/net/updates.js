// GitHub-release based auto-updater for the sideloaded Android APK.
// The game itself is 100% offline; this module is the ONLY thing that touches
// the network, and only when the player taps "Check for Update". It reads the
// public Releases API (no auth) produced by .github/workflows/release.yml.

import { Linking, Platform } from 'react-native';

export const REPO = 'VasoyaParth/TransportManagementTycoon';
// The version baked into THIS build. Bump together with android versionName and
// the release tag. Compared against the latest GitHub release to detect updates.
export const APP_VERSION = 'v1.5.0';

const RELEASES_URL = `https://api.github.com/repos/${REPO}/releases`;

// "v1.3.6" / "1.3.6" -> [1,3,6]
export function parseVer(tag) {
  const m = String(tag || '').trim().replace(/^v/i, '').match(/\d+/g) || [];
  return [0, 1, 2].map(i => parseInt(m[i], 10) || 0);
}

// -1 if a<b, 0 equal, 1 if a>b
export function cmpVer(a, b) {
  const A = parseVer(a), B = parseVer(b);
  for (let i = 0; i < 3; i++) {
    if (A[i] !== B[i]) return A[i] < B[i] ? -1 : 1;
  }
  return 0;
}

export function fmtMB(bytes) {
  if (!bytes && bytes !== 0) return '—';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function pickApk(assets) {
  return (assets || []).find(a => /\.apk$/i.test(a.name || '')) || null;
}

// Shape each release into what the UI needs.
function shapeRelease(r) {
  const apk = pickApk(r.assets);
  return {
    version: r.tag_name,
    name: r.name || r.tag_name,
    notes: (r.body || '').trim(),
    date: r.published_at || r.created_at,
    prerelease: !!r.prerelease,
    apkUrl: apk ? apk.browser_download_url : (r.html_url || null),
    apkSize: apk ? apk.size : null,
  };
}

// Full release history (newest first), APK assets resolved.
export async function fetchReleases(limit = 15) {
  const res = await fetch(`${RELEASES_URL}?per_page=${limit}`, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error(`GitHub responded ${res.status}`);
  const data = await res.json();
  return (Array.isArray(data) ? data : [])
    .filter(r => !r.draft)
    .map(shapeRelease);
}

// Compare the newest release against APP_VERSION.
export async function checkForUpdate() {
  const releases = await fetchReleases(15);
  const latest = releases.find(r => !r.prerelease) || releases[0] || null;
  const hasUpdate = latest ? cmpVer(APP_VERSION, latest.version) < 0 : false;
  return { current: APP_VERSION, latest, hasUpdate, releases };
}

// Stream the APK, reporting real bytes over the wire so the UI can show live
// MB / percent. Resolves when the transfer completes. Returns an object with an
// abort() to cancel. (Writing to disk + silent install needs a native module;
// the actual install is handed to the OS via openInstaller below.)
export function downloadApk(url, { onProgress } = {}) {
  const xhr = new XMLHttpRequest();
  const promise = new Promise((resolve, reject) => {
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onprogress = (e) => {
      if (onProgress) onProgress({ loaded: e.loaded, total: e.lengthComputable ? e.total : 0 });
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve({ ok: true, bytes: xhr.response ? xhr.response.byteLength : 0 });
      else reject(new Error(`Download failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Network error while downloading'));
    xhr.onabort = () => reject(new Error('aborted'));
    xhr.send();
  });
  return { promise, abort: () => xhr.abort() };
}

// Hand the APK to the OS: opening the release download URL lets Android's
// download manager fetch it and fire the package installer (the app declares
// REQUEST_INSTALL_PACKAGES). We do NOT gate on canOpenURL — it can wrongly
// return false for https intents and leave the user stuck at "100%".
export async function openInstaller(url) {
  if (!url) return { ok: false, err: 'No download link' };
  try {
    await Linking.openURL(url);
    return { ok: true, external: Platform.OS !== 'android' };
  } catch (e) {
    return { ok: false, err: 'Could not open the installer. Open the link in your browser to finish.' };
  }
}
