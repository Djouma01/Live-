import 'package:flutter/foundation.dart';

/// Configuration centralisee Google AdMob pour DJOUMA FOOT LIVE TV.
/// - En mode debug/test (kDebugMode ou USE_PROD_ADS=false) : utilise EXCLUSIVEMENT
///   les identifiants de TEST officiels Google pendant les essais.
/// - En build Release avec --dart-define=USE_PROD_ADS=true : utilise les
///   identifiants officiels DJOUMA FOOT LIVE TV.
class AdMobConfig {
  static const bool _useProdFlag = bool.fromEnvironment('USE_PROD_ADS', defaultValue: false);

  /// Toujours false en debug pour proteger le compte AdMob contre le trafic invalide.
  static bool get useProdAds => !kDebugMode && _useProdFlag;

  // Identifiants officiels Google AdMob - DJOUMA FOOT LIVE TV
  static const String officialAppId = 'ca-app-pub-9760174782619072~5851809978';
  static const String officialBannerId = 'ca-app-pub-9760174782619072/6286924249';
  static const String officialInterstitialId = 'ca-app-pub-9760174782619072/8992978639';
  static const String officialAppOpenId = 'ca-app-pub-9760174782619072/2877784973';

  // Identifiants de TEST officiels Google AdMob (Android)
  static const String testAppId = 'ca-app-pub-3940256099942544~3347511713';
  static const String testBannerId = 'ca-app-pub-3940256099942544/6300978111';
  static const String testInterstitialId = 'ca-app-pub-3940256099942544/1033173712';
  static const String testAppOpenId = 'ca-app-pub-3940256099942544/9257395921';
  static const String testRewardedId = 'ca-app-pub-3940256099942544/5224354917';

  // Surcharge optionnelle par --dart-define
  static const String _prodBannerId = String.fromEnvironment(
    'ADMOB_BANNER_ID',
    defaultValue: officialBannerId,
  );
  static const String _prodInterstitialId = String.fromEnvironment(
    'ADMOB_INTERSTITIAL_ID',
    defaultValue: officialInterstitialId,
  );
  static const String _prodAppOpenId = String.fromEnvironment(
    'ADMOB_APP_OPEN_ID',
    defaultValue: officialAppOpenId,
  );
  static const String _prodRewardedId = String.fromEnvironment(
    'ADMOB_REWARDED_ID',
    defaultValue: testRewardedId,
  );

  static String get appId => officialAppId;
  static String get bannerAdUnitId => useProdAds ? _prodBannerId : testBannerId;
  static String get interstitialAdUnitId => useProdAds ? _prodInterstitialId : testInterstitialId;
  static String get appOpenAdUnitId => useProdAds ? _prodAppOpenId : testAppOpenId;
  static String get rewardedAdUnitId => useProdAds ? _prodRewardedId : testRewardedId;
}
