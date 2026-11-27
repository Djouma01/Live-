import test from 'node:test';
import assert from 'node:assert/strict';
import {
  APP_OPEN_COOLDOWN_MS,
  APP_OPEN_MAX_CACHE_AGE_MS,
  GOOGLE_TEST_ADMOB_IDS,
  OFFICIAL_ADMOB_IDS,
  canLoadAds,
  getAdMobIdsConfig,
  grantRewardUnlock,
  isRewardUnlocked,
  shouldShowAppOpenAd,
  shouldShowInterstitial,
} from './admob';

test('uses official Google AdMob test IDs in development', () => {
  assert.equal(GOOGLE_TEST_ADMOB_IDS.mode, 'test');
  assert.equal(GOOGLE_TEST_ADMOB_IDS.androidAppId, 'ca-app-pub-3940256099942544~3347511713');
  assert.equal(GOOGLE_TEST_ADMOB_IDS.appOpenUnitId, 'ca-app-pub-3940256099942544/9257395921');
  assert.equal(GOOGLE_TEST_ADMOB_IDS.bannerUnitId, 'ca-app-pub-3940256099942544/6300978111');
  assert.equal(GOOGLE_TEST_ADMOB_IDS.interstitialUnitId, 'ca-app-pub-3940256099942544/1033173712');
  assert.equal(GOOGLE_TEST_ADMOB_IDS.rewardedUnitId, 'ca-app-pub-3940256099942544/5224354917');
});

test('stores official DJOUMA FOOT LIVE TV AdMob production IDs accurately', () => {
  assert.equal(OFFICIAL_ADMOB_IDS.mode, 'production');
  assert.equal(OFFICIAL_ADMOB_IDS.androidAppId, 'ca-app-pub-9760174782619072~5851809978');
  assert.equal(OFFICIAL_ADMOB_IDS.appOpenUnitId, 'ca-app-pub-9760174782619072/2877784973');
  assert.equal(OFFICIAL_ADMOB_IDS.bannerUnitId, 'ca-app-pub-9760174782619072/6286924249');
  assert.equal(OFFICIAL_ADMOB_IDS.interstitialUnitId, 'ca-app-pub-9760174782619072/8992978639');
  assert.deepEqual(getAdMobIdsConfig('test'), GOOGLE_TEST_ADMOB_IDS);
  assert.deepEqual(getAdMobIdsConfig('production'), OFFICIAL_ADMOB_IDS);
});

test('canLoadAds blocks ads when offline or consent is pending', () => {
  assert.equal(canLoadAds({ isOnline: false, consentStatus: 'personalized' }), false);
  assert.equal(canLoadAds({ isOnline: true, consentStatus: 'pending' }), false);
  assert.equal(canLoadAds({ isOnline: true, consentStatus: 'non-personalized' }), true);
  assert.equal(canLoadAds({ isOnline: true, consentStatus: 'personalized' }), true);
});

test('shouldShowInterstitial enforces match safety, transition threshold, and cooldown', () => {
  const base = {
    isOnline: true,
    consentStatus: 'personalized' as const,
    isViewingMatchOrVideo: false,
    transitionsSinceLastAd: 3,
    lastAdShownAt: 100_000,
    now: 200_000,
  };

  assert.equal(shouldShowInterstitial(base), true);
  assert.equal(shouldShowInterstitial({ ...base, isViewingMatchOrVideo: true }), false);
  assert.equal(shouldShowInterstitial({ ...base, isOnline: false }), false);
  assert.equal(shouldShowInterstitial({ ...base, transitionsSinceLastAd: 2 }), false);
  assert.equal(shouldShowInterstitial({ ...base, now: 150_000 }), false); // within 90s cooldown
});

test('shouldShowAppOpenAd enforces consent, live match protection, cache expiration, and cooldown', () => {
  const now = 10_000_000;
  const base = {
    isOnline: true,
    consentStatus: 'personalized' as const,
    isViewingMatchOrVideo: false,
    isImportantActionActive: false,
    isViewingLiveTab: false,
    lastShownAt: 0,
    loadedAt: now - 5_000,
    now,
  };

  assert.equal(shouldShowAppOpenAd(base), true);
  assert.equal(shouldShowAppOpenAd({ ...base, isOnline: false }), false);
  assert.equal(shouldShowAppOpenAd({ ...base, consentStatus: 'pending' }), false);
  assert.equal(shouldShowAppOpenAd({ ...base, isViewingMatchOrVideo: true }), false);
  assert.equal(shouldShowAppOpenAd({ ...base, isImportantActionActive: true }), false);
  assert.equal(shouldShowAppOpenAd({ ...base, isViewingLiveTab: true }), false);
  assert.equal(
    shouldShowAppOpenAd({ ...base, loadedAt: now - APP_OPEN_MAX_CACHE_AGE_MS - 1 }),
    false
  );
  assert.equal(
    shouldShowAppOpenAd({ ...base, lastShownAt: now - APP_OPEN_COOLDOWN_MS + 10_000 }),
    false
  );
  assert.equal(
    shouldShowAppOpenAd({ ...base, lastShownAt: now - APP_OPEN_COOLDOWN_MS - 1_000 }),
    true
  );
});

test('reward unlock grants and expires cleanly', () => {
  const now = 1_000_000;
  const map = grantRewardUnlock({}, 'tactical-analysis', now, 60_000);
  assert.equal(isRewardUnlocked(map, 'tactical-analysis', now + 30_000), true);
  assert.equal(isRewardUnlocked(map, 'tactical-analysis', now + 61_000), false);
});
