// GitHub-release based auto-updater for the sideloaded Android APK.
// The game itself is 100% offline; this module is the ONLY thing that touches
// the network, and only when the player taps "Check for Update". It reads the
// public Releases API (no auth) produced by .github/workflows/release.yml.

export const REPO = 'VasoyaParth/TransportManagementTycoon';
// The version baked into THIS build. Bump together with android versionName and
// the release tag. Compared against the latest GitHub release to detect updates.
export const APP_VERSION = 'v10.30.1';

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
