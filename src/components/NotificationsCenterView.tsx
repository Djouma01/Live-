import React, { useState } from 'react';
import { Bell, LogIn, LogOut, Cloud, SlidersHorizontal, Star, CheckCircle2 } from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  getDefaultClubNotificationPrefs,
  getEffectiveClubNotificationPrefs,
  type ClubNotificationPrefs,
  type ClubNotificationPrefsMap,
  type FavoriteClub,
  type LiveAlertNotification,
  type NotificationPrefs,
} from '../lib/football';
import { ClubLogo } from './ClubLogo';
import { requestFcmWebToken } from '../lib/firebase';

interface NotificationsCenterViewProps {
  user: User | null;
  authLoading: boolean;
  cloudSyncedAt: string;
  onSignInGoogle: () => Promise<void>;
  onSignOut: () => Promise<void>;
  prefs: NotificationPrefs;
  onChangePrefs: (next: NotificationPrefs) => void;
  favoriteClubs: FavoriteClub[];
  clubNotifPrefs: ClubNotificationPrefsMap;
  onChangeClubNotifPrefs: (next: ClubNotificationPrefsMap) => void;
  alertHistory: LiveAlertNotification[];
  onTriggerTestAlert: () => void;
  onSaveFcmToken?: (token: string) => Promise<void>;
}

export const NotificationsCenterView: React.FC<NotificationsCenterViewProps> = ({
  user,
  authLoading,
  cloudSyncedAt,
  onSignInGoogle,
  onSignOut,
  prefs,
  onChangePrefs,
  favoriteClubs,
  clubNotifPrefs,
  onChangeClubNotifPrefs,
  alertHistory,
  onTriggerTestAlert,
  onSaveFcmToken,
}) => {
  const [fcmStatus, setFcmStatus] = useState<string>('');
  const [authError, setAuthError] = useState<string>('');

  const handleActivatePush = async () => {
    const res = await requestFcmWebToken();
    if (res.token) {
      setFcmStatus('Notifications Push Firebase activées sur cet appareil.');
      if (onSaveFcmToken) await onSaveFcmToken(res.token);
    } else {
      setFcmStatus(res.reason || 'Notifications locales actives.');
    }
  };

  const handleGoogleLogin = async () => {
    setAuthError('');
    try {
      await onSignInGoogle();
    } catch (err: any) {
      setAuthError(err?.message || 'Connexion Google interrompue.');
    }
  };

  const toggleGlobal = (key: keyof NotificationPrefs) => {
    onChangePrefs({ ...prefs, [key]: !prefs[key] });
  };

  const toggleClubCustom = (clubId: string) => {
    const cur = getEffectiveClubNotificationPrefs(clubId, prefs, clubNotifPrefs);
    const nextCustom = !cur.customized;
    onChangeClubNotifPrefs({
      ...clubNotifPrefs,
      [clubId]: nextCustom
        ? { ...cur, customized: true }
        : { ...getDefaultClubNotificationPrefs(prefs), customized: false },
    });
  };

  const toggleClubField = (
    clubId: string,
    field: Exclude<keyof ClubNotificationPrefs, 'customized'>
  ) => {
    const cur = getEffectiveClubNotificationPrefs(clubId, prefs, clubNotifPrefs);
    onChangeClubNotifPrefs({
      ...clubNotifPrefs,
      [clubId]: { ...cur, customized: true, [field]: !cur[field] },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Notifications &amp; Synchronisation Cloud
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
            Alertes de buts en direct, personnalisation par club favori et sauvegarde Firebase (djouma-foot-live).
          </p>
        </div>
      </div>

      {/* Firebase Auth & Firestore Sync Card */}
      <section className="rounded-2xl bg-[#12121A] border border-white/8 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <p className="text-sm font-semibold text-white flex items-center gap-2">
            <Cloud className="w-4 h-4 text-violet-400 shrink-0" />
            {user ? `Connecté : ${user.displayName || user.email}` : 'Synchronisation multi-appareils Firebase'}
          </p>
          <p className="text-xs text-zinc-400">
            {user
              ? `Vos favoris et réglages d'alertes sont sauvegardés dans Cloud Firestore${
                  cloudSyncedAt ? ` · Synchronisé à ${cloudSyncedAt}` : ''
                }.`
              : 'Connectez votre compte Google pour retrouver vos équipes favorites et notifications sur tous vos appareils.'}
          </p>
          {authError && <p className="text-xs text-amber-300">{authError}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {user ? (
            <button
              type="button"
              onClick={onSignOut}
              disabled={authLoading}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-white/6 hover:bg-white/10 text-white text-xs sm:text-sm font-medium inline-flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Déconnexion
            </button>
          ) : (
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={authLoading}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              Connexion Google
            </button>
          )}
          <button
            type="button"
            onClick={handleActivatePush}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-white/6 hover:bg-white/10 border border-white/10 text-white text-xs sm:text-sm font-medium inline-flex items-center gap-2"
          >
            <Bell className="w-4 h-4 text-violet-400" />
            Activer Push FCM
          </button>
        </div>
      </section>

      {fcmStatus && (
        <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/30 text-xs text-violet-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{fcmStatus}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Réglages globaux */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Préférences globales</h2>
            <button
              type="button"
              onClick={onTriggerTestAlert}
              className="text-xs font-medium text-violet-300 hover:text-violet-200"
            >
              Envoyer une alerte test
            </button>
          </div>
          <div className="rounded-2xl bg-[#12121A] border border-white/8 divide-y divide-white/6">
            {(
              [
                { key: 'enabled', label: 'Activer toutes les notifications en direct' },
                { key: 'kickoff', label: "Coup d'envoi des matchs suivis" },
                { key: 'goals', label: 'Buts et buteurs en direct' },
                { key: 'redCards', label: 'Cartons rouges et expulsions' },
                { key: 'halftimeFulltime', label: 'Mi-temps et coup de sifflet final' },
              ] as const
            ).map((item) => (
              <label
                key={item.key}
                className="flex items-center justify-between px-4 py-3.5 cursor-pointer hover:bg-white/3"
              >
                <span className="text-sm text-zinc-200">{item.label}</span>
                <input
                  type="checkbox"
                  checked={prefs[item.key]}
                  onChange={() => toggleGlobal(item.key)}
                  className="w-5 h-5 accent-violet-500 rounded cursor-pointer"
                />
              </label>
            ))}
          </div>
        </section>

        {/* Personnalisation par club favori */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-violet-400" />
            Alertes personnalisées par club favori ({favoriteClubs.length})
          </h2>

          {favoriteClubs.length === 0 ? (
            <div className="p-5 rounded-2xl bg-[#12121A] border border-white/8 flex items-start gap-3 text-xs text-zinc-400">
              <Star className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
              <p>
                Ajoutez des équipes en favoris depuis les cartes de matchs ou la rubrique « Équipes » pour régler individuellement buts, cartons, changements et résultats finaux.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {favoriteClubs.map((club) => {
                const eff = getEffectiveClubNotificationPrefs(club.id, prefs, clubNotifPrefs);
                return (
                  <div
                    key={club.id}
                    className="p-4 rounded-2xl bg-[#12121A] border border-white/8 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <ClubLogo src={club.logo} name={club.name} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{club.name}</p>
                          <p className="text-xs text-zinc-400 truncate">{club.competitionName}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleClubCustom(club.id)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap ${
                          eff.customized
                            ? 'bg-violet-600 text-white'
                            : 'bg-white/6 text-zinc-300'
                        }`}
                      >
                        {eff.customized ? 'Personnalisé' : 'Par défaut'}
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
                          className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs cursor-pointer ${
                            eff[opt.key]
                              ? 'bg-violet-500/10 border-violet-500/35 text-white'
                              : 'bg-black/25 border-white/6 text-zinc-400'
                          }`}
                        >
                          <span>{opt.label}</span>
                          <input
                            type="checkbox"
                            checked={eff[opt.key]}
                            onChange={() => toggleClubField(club.id, opt.key)}
                            className="w-4 h-4 accent-violet-500"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Historique des alertes récentes */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-white">
          Journal des alertes reçues ({alertHistory.length})
        </h2>
        {alertHistory.length === 0 ? (
          <p className="text-xs text-zinc-400 p-4 rounded-2xl bg-[#12121A] border border-white/8">
            Aucune alerte reçue pendant cette session pour le moment. Dès qu&apos;un but, carton ou coup d&apos;envoi intervient sur vos matchs suivis, l&apos;historique apparaît ici.
          </p>
        ) : (
          <ul className="rounded-2xl bg-[#12121A] border border-white/8 divide-y divide-white/6">
            {alertHistory.map((al) => (
              <li key={al.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-violet-300 truncate">{al.title}</p>
                  <p className="text-xs text-zinc-300 truncate">{al.body}</p>
                </div>
                <span className="text-xs font-mono text-zinc-500 shrink-0 tabular-nums">
                  {new Date(al.timestamp).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
