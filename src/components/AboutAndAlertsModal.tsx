import React, { useState } from 'react';
import {
  X,
  Bell,
  Download,
  ShieldCheck,
  Smartphone,
  CheckCircle2,
  Megaphone,
  Star,
  SlidersHorizontal,
} from 'lucide-react';
import {
  getDefaultClubNotificationPrefs,
  getEffectiveClubNotificationPrefs,
  type ClubNotificationPrefs,
  type ClubNotificationPrefsMap,
  type FavoriteClub,
  type NotificationPrefs,
} from '../lib/football';
import { GOOGLE_TEST_ADMOB_IDS, OFFICIAL_ADMOB_IDS, type AdConsentStatus } from '../lib/admob';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { ClubLogo } from './ClubLogo';

interface AboutAndAlertsModalProps {
  onClose: () => void;
  prefs: NotificationPrefs;
  onChangePrefs: (next: NotificationPrefs) => void;
  favoriteClubs: FavoriteClub[];
  clubNotifPrefs: ClubNotificationPrefsMap;
  onChangeClubNotifPrefs: (next: ClubNotificationPrefsMap) => void;
  onTriggerTestAlert: () => void;
  providerName: string;
  hasApiFootballKey: boolean;
  consentStatus: AdConsentStatus;
  onResetConsent: () => void;
  onTestAppOpen: () => void;
  onTestInterstitial: () => void;
  onTestRewarded: () => void;
}

export const AboutAndAlertsModal: React.FC<AboutAndAlertsModalProps> = ({
  onClose,
  prefs,
  onChangePrefs,
  favoriteClubs,
  clubNotifPrefs,
  onChangeClubNotifPrefs,
  onTriggerTestAlert,
  providerName,
  hasApiFootballKey,
  consentStatus,
  onResetConsent,
  onTestAppOpen,
  onTestInterstitial,
  onTestRewarded,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [permState, setPermState] = useState<string>(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );

  const requestPermission = async () => {
    if (typeof Notification === 'undefined') return;
    const res = await Notification.requestPermission();
    setPermState(res);
    if (res === 'granted') {
      onChangePrefs({ ...prefs, enabled: true });
    }
  };

  const togglePref = (field: keyof NotificationPrefs) => {
    onChangePrefs({ ...prefs, [field]: !prefs[field] });
  };

  const toggleClubCustomMode = (clubId: string) => {
    const current = getEffectiveClubNotificationPrefs(clubId, prefs, clubNotifPrefs);
    const nextCustomized = !current.customized;
    onChangeClubNotifPrefs({
      ...clubNotifPrefs,
      [clubId]: nextCustomized
        ? { ...current, customized: true }
        : { ...getDefaultClubNotificationPrefs(prefs), customized: false },
    });
  };

  const toggleClubField = (
    clubId: string,
    field: Exclude<keyof ClubNotificationPrefs, 'customized'>
  ) => {
    const current = getEffectiveClubNotificationPrefs(clubId, prefs, clubNotifPrefs);
    onChangeClubNotifPrefs({
      ...clubNotifPrefs,
      [clubId]: {
        ...current,
        customized: true,
        [field]: !current[field],
      },
    });
  };

  const consentLabel =
    consentStatus === 'personalized'
      ? 'Annonces personnalisées acceptées'
      : consentStatus === 'non-personalized'
      ? 'Annonces non personnalisées uniquement'
      : 'En attente de choix';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-modal-title"
    >
      <div className="w-full sm:max-w-xl max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-[#0F0F16] border border-white/10 overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 shrink-0">
          <h2 id="about-modal-title" className="text-base font-semibold text-white">
            Alertes, AdMob &amp; À propos
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer les préférences et à propos"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-zinc-400 hover:text-white hover:bg-white/8 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Identity / À propos Section */}
          <section className="p-4 rounded-2xl bg-[#151520] border border-white/8 flex items-center gap-4">
            <img
              src="/src/assets/images/djouma_foot_logo_1795516990634.jpg"
              alt="Logo officiel DJOUMA FOOT LIVE"
              className="w-16 h-16 rounded-2xl object-cover border border-violet-500/40 shrink-0"
            />
            <div className="min-w-0">
              <h3 className="font-display text-2xl font-bold text-white tracking-tight">
                DJOUMA FOOT LIVE
              </h3>
              <p className="text-sm font-medium text-violet-300 mt-0.5">
                Créée par Djouma Coulibaly.
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                Source active : {providerName}
              </p>
            </div>
          </section>

          {/* Notification Settings */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Bell className="w-4 h-4 text-violet-400" />
                Notifications des matchs
              </h3>
              {permState === 'default' && (
                <button
                  type="button"
                  onClick={requestPermission}
                  className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-colors"
                >
                  Autoriser sur Android
                </button>
              )}
              {permState === 'granted' && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Système actif
                </span>
              )}
            </div>

            <div className="rounded-2xl bg-[#151520] border border-white/8 divide-y divide-white/6">
              {(
                [
                  { key: 'enabled', label: 'Activer toutes les alertes' },
                  { key: 'kickoff', label: "Coup d'envoi du match" },
                  { key: 'goals', label: 'Buts marqués en direct' },
                  { key: 'redCards', label: 'Cartons rouges' },
                  { key: 'halftimeFulltime', label: 'Mi-temps et fin du match' },
                ] as const
              ).map((item) => (
                <label
                  key={item.key}
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white/3 transition-colors"
                >
                  <span className="text-sm text-zinc-200">{item.label}</span>
                  <input
                    type="checkbox"
                    checked={prefs[item.key]}
                    onChange={() => togglePref(item.key)}
                    className="w-5 h-5 accent-violet-500 rounded cursor-pointer"
                  />
                </label>
              ))}
            </div>

            {/* Personnalisation des alertes par équipe favorite */}
            <div className="pt-2 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-violet-400" />
                  Personnaliser par équipe favorite
                </h4>
                <span className="text-[11px] text-zinc-500">
                  {favoriteClubs.length} {favoriteClubs.length > 1 ? 'équipes' : 'équipe'}
                </span>
              </div>

              {favoriteClubs.length === 0 ? (
                <div className="p-3.5 rounded-2xl bg-[#151520] border border-white/8 flex items-start gap-2.5 text-xs text-zinc-400">
                  <Star className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                  <p>
                    Ajoutez des clubs en favoris (étoile sur les matchs) pour personnaliser individuellement leurs notifications : buts, cartons, changements et résultats finaux.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {favoriteClubs.map((club) => {
                    const effective = getEffectiveClubNotificationPrefs(club.id, prefs, clubNotifPrefs);
                    return (
                      <div
                        key={club.id}
                        className="p-3.5 rounded-2xl bg-[#151520] border border-white/8 space-y-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <ClubLogo src={club.logo} name={club.name} size="sm" />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-white truncate">{club.name}</p>
                              <p className="text-[11px] text-zinc-400 truncate">{club.competitionName}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleClubCustomMode(club.id)}
                            aria-pressed={effective.customized}
                            className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap shrink-0 transition-colors ${
                              effective.customized
                                ? 'bg-violet-600 text-white'
                                : 'bg-white/6 text-zinc-300 hover:bg-white/10'
                            }`}
                          >
                            {effective.customized ? 'Personnalisé' : 'Par défaut'}
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          {(
                            [
                              { key: 'goals', label: 'Buts' },
                              { key: 'cards', label: 'Cartons' },
                              { key: 'substitutions', label: 'Changements' },
                              { key: 'finalResult', label: 'Résultats finaux' },
                            ] as const
                          ).map((opt) => (
                            <label
                              key={opt.key}
                              className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                                effective[opt.key]
                                  ? 'bg-violet-500/10 border-violet-500/35 text-white'
                                  : 'bg-black/25 border-white/6 text-zinc-400'
                              }`}
                            >
                              <span className="truncate">{opt.label}</span>
                              <input
                                type="checkbox"
                                checked={effective[opt.key]}
                                onChange={() => toggleClubField(club.id, opt.key)}
                                aria-label={`${opt.label} pour ${club.name}`}
                                className="w-4 h-4 accent-violet-500 rounded cursor-pointer shrink-0"
                              />
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onTriggerTestAlert}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium text-white transition-colors"
            >
              Tester une notification en direct
            </button>
          </section>

          {/* Google AdMob & Privacy Consent Section */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-violet-400" />
              Google AdMob &amp; Confidentialité
            </h3>

            <div className="p-4 rounded-2xl bg-[#151520] border border-white/8 space-y-3 text-xs text-zinc-300">
              <div className="flex items-center justify-between gap-2">
                <span className="text-zinc-400">Mode actif :</span>
                <span className="font-mono font-semibold text-violet-300">
                  Identifiants TEST Google
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-zinc-400">Consentement (RGPD) :</span>
                <span className="font-medium text-white">{consentLabel}</span>
              </div>

              <div className="p-3 rounded-xl bg-black/35 border border-white/6 font-mono text-[11px] text-zinc-400 space-y-1">
                <p className="text-zinc-300 font-sans font-medium mb-1">Identifiants TEST actifs (essais) :</p>
                <p>App ID Test : {GOOGLE_TEST_ADMOB_IDS.androidAppId}</p>
                <p>App Open Test : {GOOGLE_TEST_ADMOB_IDS.appOpenUnitId}</p>
                <p>Bannière Test : {GOOGLE_TEST_ADMOB_IDS.bannerUnitId}</p>
                <p>Interstitiel Test : {GOOGLE_TEST_ADMOB_IDS.interstitialUnitId}</p>
              </div>

              <div className="p-3 rounded-xl bg-violet-950/20 border border-violet-500/20 font-mono text-[11px] text-zinc-300 space-y-1">
                <p className="text-violet-300 font-sans font-medium mb-1">Identifiants officiels Android (APK/AAB Release) :</p>
                <p>App ID : {OFFICIAL_ADMOB_IDS.androidAppId}</p>
                <p>App Open : {OFFICIAL_ADMOB_IDS.appOpenUnitId}</p>
                <p>Bannière : {OFFICIAL_ADMOB_IDS.bannerUnitId}</p>
                <p>Interstitiel : {OFFICIAL_ADMOB_IDS.interstitialUnitId}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                <button
                  type="button"
                  onClick={onTestAppOpen}
                  className="min-h-[40px] px-3 py-2 rounded-xl bg-white/6 hover:bg-white/10 border border-white/10 text-xs font-medium text-white transition-colors"
                >
                  Tester App Open
                </button>
                <button
                  type="button"
                  onClick={onTestInterstitial}
                  className="min-h-[40px] px-3 py-2 rounded-xl bg-white/6 hover:bg-white/10 border border-white/10 text-xs font-medium text-white transition-colors"
                >
                  Tester l&apos;interstitiel
                </button>
                <button
                  type="button"
                  onClick={onTestRewarded}
                  className="min-h-[40px] px-3 py-2 rounded-xl bg-white/6 hover:bg-white/10 border border-white/10 text-xs font-medium text-white transition-colors"
                >
                  Tester vidéo récompensée
                </button>
              </div>

              <button
                type="button"
                onClick={onResetConsent}
                className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-transparent hover:bg-white/5 border border-white/10 text-xs font-medium text-zinc-300 transition-colors"
              >
                Modifier mes choix de confidentialité
              </button>
            </div>
          </section>

          {/* Android Install & API Configuration Status */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-violet-400" />
              Installation Android (APK / AAB) &amp; Sécurité
            </h3>

            <div className="p-4 rounded-2xl bg-[#151520] border border-white/8 space-y-3 text-xs text-zinc-300 leading-relaxed">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                <p>
                  Toutes les clés API sont sécurisées côté serveur Express (<code className="text-violet-300">/api/*</code>).
                  {!hasApiFootballKey && (
                    <> Pour débloquer le <strong>Championnat du Mali (Ligue 1)</strong>, ajoutez <code className="text-violet-300">API_FOOTBALL_KEY</code> dans les secrets du serveur.</>
                  )}
                </p>
              </div>

              {!isInstalled && isInstallable && (
                <button
                  type="button"
                  onClick={install}
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Installer DJOUMA FOOT LIVE sur Android
                </button>
              )}

              {!isInstalled && isIOS && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowIOSGuide((v) => !v)}
                    className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-white/6 hover:bg-white/10 text-white text-xs font-medium"
                  >
                    Installer sur iPhone / iPad
                  </button>
                  {showIOSGuide && (
                    <p className="mt-2 text-zinc-400">
                      1. Touchez le bouton <strong>Partager</strong>.<br />
                      2. Choisissez <strong>Sur l&apos;écran d&apos;accueil</strong>.
                    </p>
                  )}
                </div>
              )}

              <p className="text-zinc-400">
                Le projet natif Flutter Android (<code className="text-zinc-300">android-flutter/</code>) intègre officiellement <code className="text-violet-300">google_mobile_ads</code>, le consentement UMP, ainsi que <code className="text-zinc-300">build_apk.sh</code> (APK) et <code className="text-zinc-300">build_aab.sh</code> (Google Play AAB).
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
