import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';
import 'admob_config.dart';

/// Service Google AdMob gerant :
/// - Le consentement utilisateur (UMP / RGPD)
/// - L'initialisation securisee du SDK MobileAds (avec Completer)
/// - L'App Open Ad a l'ouverture / retour premier plan (expiration 4h, cooldown 15min)
/// - La banniere d'accueil et les interstitiels controles (cooldown + protection match/video)
/// - La tolerance aux connexions lentes et au mode hors ligne (sans jamais bloquer l'app)
class AdService {
  bool _initialized = false;
  bool _canRequestAds = false;
  bool _initializing = false;
  bool _isShowingFullScreenAd = false;
  bool _isLoadingAppOpen = false;
  bool _appOpenShownOnLaunch = false;

  AppOpenAd? _appOpenAd;
  DateTime? _appOpenLoadedAt;
  DateTime? _lastAppOpenShownAt;

  InterstitialAd? _interstitialAd;
  RewardedAd? _rewardedAd;
  StreamSubscription<List<ConnectivityResult>>? _connectivitySub;

  int _transitionsCount = 0;
  DateTime? _lastInterstitialAt;

  static const Duration _interstitialCooldown = Duration(seconds: 90);
  static const int _transitionThreshold = 3;
  static const Duration _appOpenCooldown = Duration(minutes: 15);
  static const Duration _appOpenMaxCacheDuration = Duration(hours: 4);

  bool get canRequestAds => _canRequestAds;
  bool get isAppOpenAdAvailable =>
      _appOpenAd != null &&
      _appOpenLoadedAt != null &&
      DateTime.now().difference(_appOpenLoadedAt!) < _appOpenMaxCacheDuration;

  /// Initialise UMP + MobileAds SDK et attend réellement la fin de la sequence
  /// pour que la banniere et l'App Open Ad puissent charger des l'ouverture.
  Future<bool> initializeWithConsent({VoidCallback? onAdsReady}) async {
    if (_canRequestAds && _initialized) {
      return true;
    }
    if (_initializing) {
      return _canRequestAds;
    }
    _initializing = true;

    try {
      final connectivity = await Connectivity().checkConnectivity();
      if (connectivity.contains(ConnectivityResult.none)) {
        // Hors ligne : on ecoute le retour du reseau sans bloquer l'application
        _connectivitySub ??= Connectivity().onConnectivityChanged.listen((results) async {
          if (!results.contains(ConnectivityResult.none) && !_canRequestAds) {
            final ok = await initializeWithConsent(onAdsReady: onAdsReady);
            if (ok) onAdsReady?.call();
          }
        });
        return false;
      }

      final completer = Completer<void>();
      final params = ConsentRequestParameters();

      ConsentInformation.instance.requestConsentInfoUpdate(
        params,
        () async {
          try {
            if (await ConsentInformation.instance.isConsentFormAvailable()) {
              ConsentForm.loadAndShowConsentFormIfRequired((FormError? error) async {
                if (error != null && kDebugMode) {
                  debugPrint('UMP consent form warning: ${error.message}');
                }
                await _initMobileAdsSdk();
                if (!completer.isCompleted) completer.complete();
              });
            } else {
              await _initMobileAdsSdk();
              if (!completer.isCompleted) completer.complete();
            }
          } catch (e) {
            if (kDebugMode) debugPrint('UMP flow error (non-blocking): $e');
            await _initMobileAdsSdk();
            if (!completer.isCompleted) completer.complete();
          }
        },
        (FormError error) async {
          // Reseau lent ou erreur UMP : tentative d'initialisation non bloquante
          if (kDebugMode) {
            debugPrint('UMP update skipped: ${error.message}');
          }
          await _initMobileAdsSdk();
          if (!completer.isCompleted) completer.complete();
        },
      );

      // Delai maximal de 8s pour ne jamais figer sur reseau tres lent
      await completer.future.timeout(const Duration(seconds: 8), onTimeout: () {});
      if (_canRequestAds) {
        onAdsReady?.call();
      }
      return _canRequestAds;
    } catch (e) {
      if (kDebugMode) debugPrint('AdService init error (non-blocking): $e');
      return false;
    } finally {
      _initializing = false;
    }
  }

  Future<void> _initMobileAdsSdk() async {
    try {
      _canRequestAds = await ConsentInformation.instance.canRequestAds();
      if (!_canRequestAds) return;
      if (!_initialized) {
        await MobileAds.instance.initialize();
        _initialized = true;
      }
      preloadAppOpenAd();
      preloadInterstitial();
      preloadRewarded();
    } catch (e) {
      if (kDebugMode) debugPrint('MobileAds init error (non-blocking): $e');
    }
  }

  Future<void> resetConsentAndReload({VoidCallback? onAdsReady}) async {
    await ConsentInformation.instance.reset();
    _canRequestAds = false;
    await initializeWithConsent(onAdsReady: onAdsReady);
  }

  /// Precharge une annonce App Open Ad (valable 4 heures selon la regle AdMob).
  void preloadAppOpenAd({VoidCallback? onLoaded}) {
    if (!_canRequestAds || _isLoadingAppOpen) return;

    if (_appOpenAd != null && !isAppOpenAdAvailable) {
      _appOpenAd?.dispose();
      _appOpenAd = null;
      _appOpenLoadedAt = null;
    }
    if (_appOpenAd != null) {
      onLoaded?.call();
      return;
    }

    _isLoadingAppOpen = true;
    AppOpenAd.load(
      adUnitId: AdMobConfig.appOpenAdUnitId,
      request: const AdRequest(),
      adLoadCallback: AppOpenAdLoadCallback(
        onAdLoaded: (ad) {
          _isLoadingAppOpen = false;
          _appOpenAd = ad;
          _appOpenLoadedAt = DateTime.now();
          onLoaded?.call();
        },
        onAdFailedToLoad: (err) {
          _isLoadingAppOpen = false;
          _appOpenAd = null;
          _appOpenLoadedAt = null;
          if (kDebugMode) debugPrint('AppOpen unavailable: ${err.message}');
        },
      ),
    );
  }

  /// Affiche l'App Open Ad une seule fois au demarrage si l'utilisateur n'est pas en
  /// train de consulter un match/video ou une action importante.
  void loadAndMaybeShowAppOpenOnLaunch({required bool Function() canInterruptSafely}) {
    if (!_canRequestAds || _appOpenShownOnLaunch) return;
    preloadAppOpenAd(
      onLoaded: () {
        if (_appOpenShownOnLaunch) return;
        if (!canInterruptSafely()) return;
        final shown = showAppOpenAdIfAvailable(isBlockedByActiveFlow: false);
        if (shown) {
          _appOpenShownOnLaunch = true;
        }
      },
    );
  }

  /// Affiche l'App Open Ad uniquement a l'ouverture / retour au premier plan,
  /// avec respect strict du cooldown (15 min) et sans jamais couper un match en direct.
  bool showAppOpenAdIfAvailable({required bool isBlockedByActiveFlow}) {
    if (!_canRequestAds || _isShowingFullScreenAd || isBlockedByActiveFlow) {
      return false;
    }

    final now = DateTime.now();
    if (_lastAppOpenShownAt != null &&
        now.difference(_lastAppOpenShownAt!) < _appOpenCooldown) {
      return false;
    }

    if (!isAppOpenAdAvailable) {
      _appOpenAd?.dispose();
      _appOpenAd = null;
      _appOpenLoadedAt = null;
      preloadAppOpenAd();
      return false;
    }

    final ad = _appOpenAd!;
    _appOpenAd = null;
    _appOpenLoadedAt = null;
    _isShowingFullScreenAd = true;
    _lastAppOpenShownAt = now;

    ad.fullScreenContentCallback = FullScreenContentCallback(
      onAdShowedFullScreenContent: (_) {
        _isShowingFullScreenAd = true;
      },
      onAdDismissedFullScreenContent: (ad) {
        _isShowingFullScreenAd = false;
        ad.dispose();
        preloadAppOpenAd();
      },
      onAdFailedToShowFullScreenContent: (ad, err) {
        _isShowingFullScreenAd = false;
        ad.dispose();
        if (kDebugMode) debugPrint('AppOpen failed to show: ${err.message}');
        preloadAppOpenAd();
      },
    );

    ad.show();
    return true;
  }

  BannerAd? createHomeBanner({
    required VoidCallback onLoaded,
    required VoidCallback onFailed,
  }) {
    if (!_canRequestAds) return null;
    final banner = BannerAd(
      adUnitId: AdMobConfig.bannerAdUnitId,
      size: AdSize.banner,
      request: const AdRequest(),
      listener: BannerAdListener(
        onAdLoaded: (_) => onLoaded(),
        onAdFailedToLoad: (ad, err) {
          ad.dispose();
          if (kDebugMode) debugPrint('Banner load skipped: ${err.message}');
          onFailed();
        },
      ),
    );
    banner.load();
    return banner;
  }

  void preloadInterstitial() {
    if (!_canRequestAds || _interstitialAd != null) return;
    InterstitialAd.load(
      adUnitId: AdMobConfig.interstitialAdUnitId,
      request: const AdRequest(),
      adLoadCallback: InterstitialAdLoadCallback(
        onAdLoaded: (ad) {
          _interstitialAd = ad;
          ad.fullScreenContentCallback = FullScreenContentCallback(
            onAdShowedFullScreenContent: (_) {
              _isShowingFullScreenAd = true;
            },
            onAdDismissedFullScreenContent: (ad) {
              _isShowingFullScreenAd = false;
              ad.dispose();
              _interstitialAd = null;
              preloadInterstitial();
            },
            onAdFailedToShowFullScreenContent: (ad, err) {
              _isShowingFullScreenAd = false;
              ad.dispose();
              _interstitialAd = null;
            },
          );
        },
        onAdFailedToLoad: (err) {
          _interstitialAd = null;
          if (kDebugMode) debugPrint('Interstitial unavailable: ${err.message}');
        },
      ),
    );
  }

  /// Affiche un interstitiel uniquement lors de transitions espacees,
  /// jamais pendant la lecture d'un match ou d'une video.
  void maybeShowInterstitialOnTransition({required bool isViewingMatchOrVideo}) {
    if (isViewingMatchOrVideo || !_canRequestAds || _isShowingFullScreenAd) return;
    _transitionsCount += 1;
    if (_transitionsCount < _transitionThreshold) return;

    final now = DateTime.now();
    if (_lastInterstitialAt != null &&
        now.difference(_lastInterstitialAt!) < _interstitialCooldown) {
      return;
    }

    if (_interstitialAd != null) {
      _transitionsCount = 0;
      _lastInterstitialAt = now;
      _isShowingFullScreenAd = true;
      _interstitialAd!.show();
      _interstitialAd = null;
    } else {
      preloadInterstitial();
    }
  }

  void preloadRewarded() {
    if (!_canRequestAds || _rewardedAd != null) return;
    RewardedAd.load(
      adUnitId: AdMobConfig.rewardedAdUnitId,
      request: const AdRequest(),
      rewardedAdLoadCallback: RewardedAdLoadCallback(
        onAdLoaded: (ad) {
          _rewardedAd = ad;
        },
        onAdFailedToLoad: (err) {
          _rewardedAd = null;
          if (kDebugMode) debugPrint('Rewarded unavailable: ${err.message}');
        },
      ),
    );
  }

  Future<bool> showRewardedAd({required VoidCallback onRewardEarned}) async {
    if (!_canRequestAds || _rewardedAd == null || _isShowingFullScreenAd) {
      preloadRewarded();
      return false;
    }

    final ad = _rewardedAd!;
    _rewardedAd = null;
    _isShowingFullScreenAd = true;

    final completer = Completer<bool>();
    ad.fullScreenContentCallback = FullScreenContentCallback(
      onAdShowedFullScreenContent: (_) {
        _isShowingFullScreenAd = true;
      },
      onAdDismissedFullScreenContent: (ad) {
        _isShowingFullScreenAd = false;
        ad.dispose();
        preloadRewarded();
        if (!completer.isCompleted) completer.complete(true);
      },
      onAdFailedToShowFullScreenContent: (ad, err) {
        _isShowingFullScreenAd = false;
        ad.dispose();
        preloadRewarded();
        if (!completer.isCompleted) completer.complete(false);
      },
    );

    await ad.show(onUserEarnedReward: (_, __) {
      onRewardEarned();
    });
    return completer.future;
  }

  void dispose() {
    _connectivitySub?.cancel();
    _appOpenAd?.dispose();
    _interstitialAd?.dispose();
    _rewardedAd?.dispose();
  }
}
