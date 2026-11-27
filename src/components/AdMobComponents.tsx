import React, { useEffect, useState } from 'react';
import { Shield, X, Play, CheckCircle2, Sparkles, VolumeX } from 'lucide-react';
import {
  GOOGLE_TEST_ADMOB_IDS,
  OFFICIAL_ADMOB_IDS,
  canLoadAds,
  type AdConsentStatus,
} from '../lib/admob';

interface AdConsentBannerProps {
  consentStatus: AdConsentStatus;
  onSelectConsent: (status: Exclude<AdConsentStatus, 'pending'>) => void;
}

export const AdConsentBanner: React.FC<AdConsentBannerProps> = ({
  consentStatus,
  onSelectConsent,
}) => {
  if (consentStatus !== 'pending') return null;

  return (
    <aside
      aria-label="Consentement publicitaire et confidentialité"
      className="fixed bottom-16 md:bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-40 rounded-2xl bg-[#14141E]/95 backdrop-blur-md border border-violet-500/40 p-4 shadow-2xl space-y-3"
    >
      <div className="flex items-start gap-2.5">
        <Shield className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-white">
            Confidentialité &amp; Publicités (AdMob)
          </h3>
          <p className="text-xs text-zinc-300 leading-relaxed">
            DJOUMA FOOT LIVE utilise Google AdMob (identifiants de test en développement) pour financer l&apos;application sans bloquer les scores en direct. Choisissez votre préférence publicitaire :
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={() => onSelectConsent('non-personalized')}
          className="flex-1 min-h-[40px] px-3 py-2 rounded-xl bg-white/8 hover:bg-white/12 border border-white/10 text-xs font-medium text-zinc-200 transition-colors"
        >
          Annonces non personnalisées
        </button>
        <button
          type="button"
          onClick={() => onSelectConsent('personalized')}
          className="flex-1 min-h-[40px] px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white transition-colors"
        >
          Accepter et continuer
        </button>
      </div>
    </aside>
  );
};

interface HomeBannerAdProps {
  isOnline: boolean;
  consentStatus: AdConsentStatus;
}

export const HomeBannerAd: React.FC<HomeBannerAdProps> = ({
  isOnline,
  consentStatus,
}) => {
  const [adReady, setAdReady] = useState(false);

  const allowed = canLoadAds({ isOnline, consentStatus });

  useEffect(() => {
    if (!allowed) {
      setAdReady(false);
      return;
    }
    const timer = setTimeout(() => setAdReady(true), 250);
    return () => clearTimeout(timer);
  }, [allowed]);

  // En cas d'absence de connexion ou de refus/attente, ne bloque rien et masque proprement la banniere
  if (!allowed || !adReady) return null;

  return (
    <section
      aria-label="Bannière publicitaire Google AdMob"
      data-testid="admob-home-banner"
      className="w-full max-w-full overflow-hidden rounded-2xl bg-[#101018] border border-white/8 px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3"
    >
      <div className="w-full sm:w-auto flex items-center gap-3 min-w-0 flex-1">
        <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-violet-500/15 border border-violet-500/30 text-violet-300 shrink-0">
          Annonce Test
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-sm font-medium text-zinc-100 truncate">
            Bannière Google AdMob ({consentStatus === 'personalized' ? 'Personnalisée' : 'Non personnalisée'})
          </p>
          <p className="text-[11px] font-mono text-zinc-500 truncate">
            Test : {GOOGLE_TEST_ADMOB_IDS.bannerUnitId} · Prod : {OFFICIAL_ADMOB_IDS.bannerUnitId}
          </p>
        </div>
      </div>
      <span className="text-[11px] text-zinc-400 shrink-0">
        SDK AdMob · Format 320×50
      </span>
    </section>
  );
};

interface InterstitialAdOverlayProps {
  open: boolean;
  consentStatus: AdConsentStatus;
  onClose: () => void;
}

export const InterstitialAdOverlay: React.FC<InterstitialAdOverlayProps> = ({
  open,
  consentStatus,
  onClose,
}) => {
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (!open) {
      setCountdown(3);
      return;
    }
    const interval = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="admob-interstitial-title"
      data-testid="admob-interstitial-overlay"
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
    >
      <div className="w-full max-w-md rounded-3xl bg-[#12121B] border border-violet-500/35 overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 bg-[#0B0B11]">
          <span className="text-[11px] font-mono text-violet-300">
            Annonce test Google AdMob · Interstitiel
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la publicité interstitielle"
            className="min-h-[36px] px-3 py-1 rounded-lg bg-white/8 hover:bg-white/15 text-xs font-medium text-white inline-flex items-center gap-1.5 transition-colors"
          >
            {countdown > 0 ? `Fermer (${countdown}s)` : 'Fermer'}
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-violet-600/20 border border-violet-500/40 flex items-center justify-center mx-auto">
            <Sparkles className="w-7 h-7 text-violet-300" />
          </div>
          <div className="space-y-1.5">
            <h2 id="admob-interstitial-title" className="text-lg font-bold text-white">
              Interstitiel de test AdMob
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Affiché uniquement lors de transitions espacées entre les onglets (jamais pendant un match ou une vidéo).
            </p>
          </div>
          <div className="p-3 rounded-xl bg-black/40 border border-white/6 text-[11px] font-mono text-zinc-400 space-y-1">
            <p>Bloc Test : {GOOGLE_TEST_ADMOB_IDS.interstitialUnitId}</p>
            <p>Bloc Android Prod : {OFFICIAL_ADMOB_IDS.interstitialUnitId}</p>
            <p>Consentement : {consentStatus === 'personalized' ? 'Annonces personnalisées' : 'Non personnalisées'}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[44px] rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors"
          >
            Continuer vers l&apos;application
          </button>
        </div>
      </div>
    </div>
  );
};

interface RewardedAdModalProps {
  open: boolean;
  onCancel: () => void;
  onRewardEarned: () => void;
}

export const RewardedAdModal: React.FC<RewardedAdModalProps> = ({
  open,
  onCancel,
  onRewardEarned,
}) => {
  const TOTAL_SECONDS = 5;
  const [secondsLeft, setSecondsLeft] = useState(TOTAL_SECONDS);

  useEffect(() => {
    if (!open) {
      setSecondsLeft(TOTAL_SECONDS);
      return;
    }
    const interval = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [open]);

  if (!open) return null;

  const completed = secondsLeft === 0;
  const progressPct = Math.round(((TOTAL_SECONDS - secondsLeft) / TOTAL_SECONDS) * 100);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="admob-rewarded-title"
      data-testid="admob-rewarded-modal"
      className="fixed inset-0 z-[60] bg-black/92 backdrop-blur-md flex items-center justify-center p-4"
    >
      <div className="w-full max-w-md rounded-3xl bg-[#12121B] border border-violet-500/40 overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 bg-[#0B0B11]">
          <span className="text-[11px] font-mono text-violet-300">
            Vidéo récompensée test · Google AdMob
          </span>
          <button
            type="button"
            onClick={completed ? onRewardEarned : onCancel}
            aria-label={completed ? 'Réclamer la récompense' : 'Quitter la vidéo publicitaire'}
            className="min-h-[36px] px-3 py-1 rounded-lg bg-white/8 hover:bg-white/15 text-xs font-medium text-white inline-flex items-center gap-1.5"
          >
            {completed ? 'Récompense prête' : 'Annuler'}
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Simulated Test Video Frame */}
          <div className="aspect-video rounded-2xl bg-gradient-to-br from-violet-950/60 via-[#0C0C14] to-black border border-white/10 flex flex-col items-center justify-center p-4 relative overflow-hidden">
            <div className="absolute top-3 right-3 text-zinc-400" title="Muet">
              <VolumeX className="w-4 h-4" />
            </div>
            {completed ? (
              <div className="text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <p className="text-sm font-semibold text-white">Récompense débloquée !</p>
              </div>
            ) : (
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-violet-600/30 border border-violet-400/50 flex items-center justify-center mx-auto">
                  <Play className="w-5 h-5 text-violet-200 fill-violet-200 ml-0.5" />
                </div>
                <p id="admob-rewarded-title" className="text-sm font-semibold text-white">
                  Lecture de la vidéo publicitaire de test…
                </p>
                <p className="text-xs font-mono text-violet-300 tabular-nums">
                  Récompense dans {secondsLeft}s
                </p>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-violet-500 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-[11px] font-mono text-zinc-500 text-center">
              ID Bloc : {GOOGLE_TEST_ADMOB_IDS.rewardedUnitId}
            </p>
          </div>

          {completed ? (
            <button
              type="button"
              onClick={onRewardEarned}
              className="w-full min-h-[44px] rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors"
            >
              Débloquer le contenu bonus (24h)
            </button>
          ) : (
            <p className="text-xs text-center text-zinc-400">
              Patientez jusqu&apos;à la fin du décompte pour recevoir la récompense.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

interface AppOpenAdOverlayProps {
  open: boolean;
  consentStatus: AdConsentStatus;
  onClose: () => void;
}

export const AppOpenAdOverlay: React.FC<AppOpenAdOverlayProps> = ({
  open,
  consentStatus,
  onClose,
}) => {
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (!open) {
      setCountdown(3);
      return;
    }
    const interval = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="admob-app-open-title"
      data-testid="admob-app-open-overlay"
      className="fixed inset-0 z-50 bg-black/92 backdrop-blur-md flex items-center justify-center p-4"
    >
      <div className="w-full max-w-md rounded-3xl bg-[#12121B] border border-violet-500/40 overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 bg-[#0B0B11]">
          <span className="text-[11px] font-mono text-violet-300">
            Annonce test Google AdMob · App Open Ad
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer l'annonce à l'ouverture"
            className="min-h-[36px] px-3 py-1 rounded-lg bg-white/8 hover:bg-white/15 text-xs font-medium text-white inline-flex items-center gap-1.5 transition-colors"
          >
            {countdown > 0 ? `Ignorer (${countdown}s)` : 'Continuer'}
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-[#09090E] border border-violet-500/40 flex items-center justify-center mx-auto overflow-hidden">
            <img
              src="/src/assets/images/djouma_foot_logo_1795516990634.jpg"
              alt="Logo DJOUMA FOOT LIVE"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="space-y-1.5">
            <h2 id="admob-app-open-title" className="text-lg font-bold text-white">
              Annonce à l&apos;ouverture (App Open)
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Affichée uniquement à l&apos;ouverture ou au retour dans DJOUMA FOOT LIVE (cooldown 15 min, jamais pendant un match en direct ou une action importante).
            </p>
          </div>
          <div className="p-3 rounded-xl bg-black/40 border border-white/6 text-[11px] font-mono text-zinc-400 space-y-1">
            <p>Bloc Test : {GOOGLE_TEST_ADMOB_IDS.appOpenUnitId}</p>
            <p>Bloc Android Prod : {OFFICIAL_ADMOB_IDS.appOpenUnitId}</p>
            <p>Consentement : {consentStatus === 'personalized' ? 'Annonces personnalisées' : 'Non personnalisées'}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[44px] rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors"
          >
            Accéder à DJOUMA FOOT LIVE
          </button>
        </div>
      </div>
    </div>
  );
};

