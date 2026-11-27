export type AdConsentStatus = 'pending' | 'personalized' | 'non-personalized';

export interface AdMobIdsConfig {
  mode: 'test' | 'production';
  androidAppId: string;
  appOpenUnitId: string;
  bannerUnitId: string;
  interstitialUnitId: string;
  rewardedUnitId: string;
}

// Identifiants officiels de TEST Google AdMob pour Android (actifs pendant les essais)
export const GOOGLE_TEST_ADMOB_IDS: AdMobIdsConfig = {
  mode: 'test',
  androidAppId: 'ca-app-pub-3940256099942544~3347511713',
  appOpenUnitId: 'ca-app-pub-3940256099942544/9257395921',
  bannerUnitId: 'ca-app-pub-3940256099942544/6300978111',
  interstitialUnitId: 'ca-app-pub-3940256099942544/1033173712',
  rewardedUnitId: 'ca-app-pub-3940256099942544/5224354917',
};

// Identifiants officiels Google AdMob de production - DJOUMA FOOT LIVE TV
export const OFFICIAL_ADMOB_IDS: AdMobIdsConfig = {
  mode: 'production',
  androidAppId: 'ca-app-pub-9760174782619072~5851809978',
  appOpenUnitId: 'ca-app-pub-9760174782619072/2877784973',
  bannerUnitId: 'ca-app-pub-9760174782619072/6286924249',
  interstitialUnitId: 'ca-app-pub-9760174782619072/8992978639',
  rewardedUnitId: GOOGLE_TEST_ADMOB_IDS.rewardedUnitId,
};

export function getAdMobIdsConfig(mode: 'test' | 'production' = 'test'): AdMobIdsConfig {
  return mode === 'production' ? OFFICIAL_ADMOB_IDS : GOOGLE_TEST_ADMOB_IDS;
}

export const INTERSTITIAL_COOLDOWN_MS = 90_000; // Minimum 90 secondes entre deux interstitiels
export const INTERSTITIAL_TRANSITION_THRESHOLD = 3; // Au moins 3 changements d'onglet avant affichage
export const APP_OPEN_COOLDOWN_MS = 15 * 60 * 1000; // Minimum 15 minutes entre deux App Open Ads
export const APP_OPEN_MAX_CACHE_AGE_MS = 4 * 60 * 60 * 1000; // Expiration AdMob de 4 heures
export const REWARD_UNLOCK_DURATION_MS = 24 * 60 * 60 * 1000; // 24 heures

export interface InterstitialCheckInput {
  isOnline: boolean;
  consentStatus: AdConsentStatus;
  isViewingMatchOrVideo: boolean;
  transitionsSinceLastAd: number;
  lastAdShownAt: number;
  now: number;
  cooldownMs?: number;
  transitionThreshold?: number;
}

export interface AppOpenCheckInput {
  isOnline: boolean;
  consentStatus: AdConsentStatus;
  isViewingMatchOrVideo: boolean;
  isImportantActionActive: boolean;
  isViewingLiveTab: boolean;
  lastShownAt: number;
  loadedAt: number;
  now: number;
  cooldownMs?: number;
  maxCacheAgeMs?: number;
}

export function canLoadAds(opts: {
  isOnline: boolean;
  consentStatus: AdConsentStatus;
}): boolean {
  if (!opts.isOnline) return false;
  return opts.consentStatus === 'personalized' || opts.consentStatus === 'non-personalized';
}

export function shouldShowInterstitial(input: InterstitialCheckInput): boolean {
  if (!canLoadAds({ isOnline: input.isOnline, consentStatus: input.consentStatus })) {
    return false;
  }
  // Exigence stricte : ne jamais afficher de publicite pendant la lecture/consultation d'un match ou d'une video
  if (input.isViewingMatchOrVideo) {
    return false;
  }
  const threshold = input.transitionThreshold ?? INTERSTITIAL_TRANSITION_THRESHOLD;
  if (input.transitionsSinceLastAd < threshold) {
    return false;
  }
  const cooldown = input.cooldownMs ?? INTERSTITIAL_COOLDOWN_MS;
  if (input.lastAdShownAt > 0 && input.now - input.lastAdShownAt < cooldown) {
    return false;
  }
  return true;
}

export function shouldShowAppOpenAd(input: AppOpenCheckInput): boolean {
  if (!canLoadAds({ isOnline: input.isOnline, consentStatus: input.consentStatus })) {
    return false;
  }
  // Ne jamais interrompre un match en direct, une video ou une action importante
  if (input.isViewingMatchOrVideo || input.isImportantActionActive || input.isViewingLiveTab) {
    return false;
  }
  // Verifie que l'annonce est chargee et non expiree (regle Google 4h)
  const maxAge = input.maxCacheAgeMs ?? APP_OPEN_MAX_CACHE_AGE_MS;
  if (input.loadedAt <= 0 || input.now - input.loadedAt >= maxAge) {
    return false;
  }
  // Evite les affichages trop frequents (cooldown 15 min)
  const cooldown = input.cooldownMs ?? APP_OPEN_COOLDOWN_MS;
  if (input.lastShownAt > 0 && input.now - input.lastShownAt < cooldown) {
    return false;
  }
  return true;
}

export type RewardUnlocksMap = Record<string, number>;

export function isRewardUnlocked(
  unlocks: RewardUnlocksMap,
  rewardKey: string,
  now: number = Date.now()
): boolean {
  const expiresAt = unlocks[rewardKey];
  if (!expiresAt) return false;
  return now < expiresAt;
}

export function grantRewardUnlock(
  unlocks: RewardUnlocksMap,
  rewardKey: string,
  now: number = Date.now(),
  durationMs: number = REWARD_UNLOCK_DURATION_MS
): RewardUnlocksMap {
  return {
    ...unlocks,
    [rewardKey]: now + durationMs,
  };
}
