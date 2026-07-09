// ============================================================================
// AdMob configuration — the SINGLE SOURCE OF TRUTH for every ad in the game.
// ----------------------------------------------------------------------------
// SECURITY NOTE (important): AdMob App IDs and Ad Unit IDs are NOT secrets.
// They ship inside every APK by design and are visible to anyone who unzips it,
// so there is no "hiding" them — Google identifies your account by them, and
// abuse is handled by AdMob's own invalid-traffic protection. What you MUST
// keep private is your AdMob *account* login and your Play signing key.
//
// Best practice we follow here:
//   • Default to Google's public TEST ids (safe to commit + ship in dev).
//   • Real production ids are provided via a GIT-IGNORED override file
//     `src/ads/adConfig.local.js` (or injected by CI) so they never sit in the
//     public repo history. In __DEV__ we ALWAYS use test ids to avoid policy
//     strikes for clicking your own live ads.
// ============================================================================

// Google's official public test unit ids (Android).
const TEST = {
  appIdAndroid: 'ca-app-pub-7624141595548692~9868476067',
  banner: 'ca-app-pub-7624141595548692/6507402862',
  interstitial: 'ca-app-pub-7624141595548692/5941673494',
  appOpen: 'ca-app-pub-7624141595548692/1610299407',
  rewardedGold: 'ca-app-pub-7624141595548692/7792564379',
  rewardedDelivery: 'ca-app-pub-7624141595548692/7792564379',
};

// Optional production overrides — create src/ads/adConfig.local.js (git-ignored)
// exporting `export default { appIdAndroid, banner, interstitial, appOpen,
// rewardedGold, rewardedDelivery }`. Missing keys fall back to test ids.
let overrides = {};
try {
  const local = require('./adConfig.local');
  overrides = local.default || local || {};
} catch (e) { overrides = {}; }

const dev = typeof __DEV__ !== 'undefined' && __DEV__;

// In dev always use test ids. In release, layer real ids over the test defaults.
export const AD_CONFIG = dev ? { ...TEST } : { ...TEST, ...overrides };

// True when we're still on Google's test ids (used to badge the UI in dev).
export const USING_TEST_ADS = dev || !overrides.banner;
