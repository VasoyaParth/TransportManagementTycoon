// ============================================================================
// Unified ads module — the ONLY place the app talks to AdMob.
// Everything (banners, rewarded, interstitial/app-open) goes through here, so
// ad logic, ids and graceful fallbacks live in one spot.
//
// The whole module degrades safely: if the native SDK isn't present (e.g. JS
// tooling, or a build without ads), banners render nothing and rewarded flows
// resolve `{ earned:false, unavailable:true }` in release (so we never grant a
// reward without a real completed ad) — while in __DEV__ they resolve
// `{ earned:true, simulated:true }` so the reward logic stays testable.
// ============================================================================
import React from 'react';
import { View } from 'react-native';
import { AD_CONFIG } from './adConfig';

const dev = typeof __DEV__ !== 'undefined' && __DEV__;

// Lazy-require the native SDK so its absence never crashes the bundle.
let ADS = null;
try { ADS = require('react-native-google-mobile-ads'); } catch (e) { ADS = null; }

let initialized = false;
let enabled = true; // players can't disable ads, but a kill-switch is handy.

export function adsAvailable() { return !!ADS; }
export function setAdsEnabled(on) { enabled = on !== false; }

export async function initAds() {
  if (!ADS || initialized) return;
  try {
    initialized = true;
    const mobileAds = ADS.default;
    await mobileAds().initialize();
  } catch (e) { /* ignore — ads just won't show */ }
}

// ---- Banner --------------------------------------------------------------
// Renders an adaptive anchored banner, or nothing when ads are unavailable.
export function AdBanner({ unit = 'banner', style }) {
  if (!ADS || !enabled) return null;
  const { BannerAd, BannerAdSize } = ADS;
  if (!BannerAd) return null;
  return (
    <View style={[{ alignItems: 'center', justifyContent: 'center' }, style]}>
      <BannerAd
        unitId={AD_CONFIG[unit] || AD_CONFIG.banner}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
      />
    </View>
  );
}

// ---- Rewarded ------------------------------------------------------------
// Resolves { earned: boolean, ... }. `earned` is true ONLY after the SDK fires
// EARNED_REWARD (the user watched enough to be paid).
export function showRewarded(unitKey = 'rewardedGold') {
  if (!ADS || !enabled) {
    return Promise.resolve(dev ? { earned: true, simulated: true } : { earned: false, unavailable: true });
  }
  return new Promise((resolve) => {
    let settled = false, earned = false, unsubs = [];
    const finish = (r) => { if (settled) return; settled = true; unsubs.forEach(u => { try { u(); } catch (e) {} }); resolve(r); };
    try {
      const { RewardedAd, RewardedAdEventType, AdEventType } = ADS;
      const ad = RewardedAd.createForAdRequest(AD_CONFIG[unitKey] || AD_CONFIG.rewardedGold, { requestNonPersonalizedAdsOnly: true });
      unsubs.push(ad.addAdEventListener(RewardedAdEventType.LOADED, () => { try { ad.show(); } catch (e) { finish({ earned: false, error: true }); } }));
      unsubs.push(ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => { earned = true; }));
      unsubs.push(ad.addAdEventListener(AdEventType.CLOSED, () => finish({ earned })));
      unsubs.push(ad.addAdEventListener(AdEventType.ERROR, () => finish({ earned: false, error: true })));
      ad.load();
      setTimeout(() => finish({ earned, timeout: !earned }), 45000);
    } catch (e) { finish({ earned: false, error: true }); }
  });
}

// ---- Interstitial / app-open (splash) ------------------------------------
// Resolves when the ad is closed (or immediately if unavailable). Never blocks
// the game — used for the splash → game transition.
export function showInterstitial(unitKey = 'interstitial') {
  if (!ADS || !enabled) return Promise.resolve({ shown: false });
  return new Promise((resolve) => {
    let settled = false, unsubs = [];
    const finish = (r) => { if (settled) return; settled = true; unsubs.forEach(u => { try { u(); } catch (e) {} }); resolve(r); };
    try {
      const { InterstitialAd, AdEventType } = ADS;
      const ad = InterstitialAd.createForAdRequest(AD_CONFIG[unitKey] || AD_CONFIG.interstitial, { requestNonPersonalizedAdsOnly: true });
      unsubs.push(ad.addAdEventListener(AdEventType.LOADED, () => { try { ad.show(); } catch (e) { finish({ shown: false }); } }));
      unsubs.push(ad.addAdEventListener(AdEventType.CLOSED, () => finish({ shown: true })));
      unsubs.push(ad.addAdEventListener(AdEventType.ERROR, () => finish({ shown: false })));
      ad.load();
      setTimeout(() => finish({ shown: false, timeout: true }), 12000);
    } catch (e) { finish({ shown: false }); }
  });
}
