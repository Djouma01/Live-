import React from 'react';
import { RefreshCw, WifiOff, Radio, Clock, Database } from 'lucide-react';

export type LiveConnectionState = 'connected' | 'reconnecting' | 'offline';

interface LiveSyncBarProps {
  connectionState: LiveConnectionState;
  displayClockText: string;
  lastRealUpdateIso: string;
  hasFreshUpdate: boolean;
  providerName: string;
  sportradarConfigured: boolean;
  firestoreConnected: boolean;
  stale: boolean;
  isRefreshing: boolean;
  onManualRefresh: () => void;
}

function formatIsoTimeFr(iso: string): string {
  if (!iso) return 'En attente';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'En attente';
  return d.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export const LiveSyncBar: React.FC<LiveSyncBarProps> = ({
  connectionState,
  displayClockText,
  lastRealUpdateIso,
  hasFreshUpdate,
  providerName,
  sportradarConfigured,
  firestoreConnected,
  stale,
  isRefreshing,
  onManualRefresh,
}) => {
  const realUpdateText = formatIsoTimeFr(lastRealUpdateIso);

  return (
    <section
      aria-label="État de synchronisation en temps réel"
      data-testid="live-sync-bar"
      className="rounded-2xl bg-[#12121A] border border-white/8 px-4 py-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        {/* État de connexion */}
        <span className="inline-flex items-center gap-1.5 font-medium text-white">
          {connectionState === 'offline' ? (
            <>
              <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-amber-300">Hors ligne (cache conservé)</span>
            </>
          ) : connectionState === 'reconnecting' ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
              <span className="text-amber-200">Reconnexion au flux...</span>
            </>
          ) : (
            <>
              <Radio className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-emerald-300">Connecté</span>
            </>
          )}
        </span>

        <span className="text-zinc-600 hidden sm:inline" aria-hidden="true">·</span>

        {/* Source active & Firestore */}
        <span className="text-zinc-300 inline-flex items-center gap-1.5">
          <Database className="w-3.5 h-3.5 text-violet-400 shrink-0" />
          <span>{providerName}</span>
          {firestoreConnected && (
            <span className="text-zinc-500">· Cache Firestore</span>
          )}
          {!sportradarConfigured && (
            <span className="text-zinc-500">· Sportradar prêt</span>
          )}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between lg:justify-end gap-x-4 gap-y-2 text-xs">
        {/* Séparation stricte : Actualisation visuelle 1s vs Dernière véritable donnée */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span
            data-testid="ui-ticker-clock"
            className="inline-flex items-center gap-1.5 text-zinc-400 font-mono tabular-nums"
            title="Actualisation visuelle de l'interface chaque seconde"
          >
            <Clock className="w-3.5 h-3.5 text-violet-400 shrink-0" />
            <span>Affichage 1s : {displayClockText}</span>
          </span>

          <span className="text-zinc-600" aria-hidden="true">|</span>

          <span
            data-testid="last-real-update"
            className={`font-mono tabular-nums ${
              hasFreshUpdate ? 'text-emerald-300 font-semibold' : 'text-zinc-300'
            }`}
            title="Horodatage exact de la dernière modification réelle reçue du fournisseur"
          >
            Dernière donnée réelle : {realUpdateText}
            {hasFreshUpdate ? ' (Nouvelle donnée)' : stale ? ' (Cache conservé)' : ''}
          </span>
        </div>

        <button
          type="button"
          onClick={onManualRefresh}
          disabled={connectionState === 'offline' || isRefreshing}
          aria-label="Synchroniser maintenant les scores"
          className="min-h-[36px] px-3 py-1.5 rounded-xl bg-white/6 hover:bg-white/10 disabled:opacity-45 text-xs font-medium text-white inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-violet-400 ${isRefreshing ? 'animate-spin' : ''}`} />
          Synchroniser
        </button>
      </div>
    </section>
  );
};
