import React, { useEffect } from 'react';
import { X, RefreshCw, BarChart3, Shield, User } from 'lucide-react';
import type { PlayerProfileInfo } from '../lib/football';

interface PlayerSeasonStatsModalProps {
  player: PlayerProfileInfo;
  loading: boolean;
  onClose: () => void;
}

interface StatMetricItem {
  key: string;
  label: string;
  value: string | number;
  highlight?: 'violet' | 'amber' | 'rose' | 'emerald';
}

export const PlayerSeasonStatsModal: React.FC<PlayerSeasonStatsModalProps> = ({
  player,
  loading,
  onClose,
}) => {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const st = player.stats;
  const splits = player.seasonSplits || [];
  const isGoalkeeper = /goalkeeper|gardien|^gk$|^g$/i.test((player.position || '').trim());

  const metrics: StatMetricItem[] = [];
  if (st) {
    if (typeof st.appearances === 'number') {
      metrics.push({ key: 'appearances', label: 'Matchs joués', value: st.appearances });
    }
    if (typeof st.starts === 'number') {
      metrics.push({ key: 'starts', label: 'Titularisations', value: st.starts });
    }
    if (typeof st.subIns === 'number') {
      metrics.push({ key: 'subIns', label: 'Entrées en jeu', value: st.subIns });
    }
    if (typeof st.minutesPlayed === 'number') {
      metrics.push({ key: 'minutes', label: 'Minutes jouées', value: `${st.minutesPlayed}'` });
    }
    if (typeof st.goals === 'number') {
      metrics.push({ key: 'goals', label: 'Buts', value: st.goals, highlight: 'violet' });
    }
    if (typeof st.assists === 'number') {
      metrics.push({ key: 'assists', label: 'Passes décisives', value: st.assists, highlight: 'emerald' });
    }
    if (typeof st.shots === 'number') {
      metrics.push({ key: 'shots', label: 'Tirs totaux', value: st.shots });
    }
    if (typeof st.shotsOnTarget === 'number') {
      metrics.push({ key: 'shotsOnTarget', label: 'Tirs cadrés', value: st.shotsOnTarget });
    }
    if (typeof st.saves === 'number' && (isGoalkeeper || st.saves > 0)) {
      metrics.push({ key: 'saves', label: 'Arrêts', value: st.saves, highlight: 'violet' });
    }
    if (typeof st.cleanSheets === 'number' && isGoalkeeper) {
      metrics.push({ key: 'cleanSheets', label: 'Clean sheets', value: st.cleanSheets, highlight: 'emerald' });
    }
    if (typeof st.goalsConceded === 'number' && isGoalkeeper) {
      metrics.push({ key: 'goalsConceded', label: 'Buts encaissés', value: st.goalsConceded });
    }
    if (typeof st.foulsCommitted === 'number') {
      metrics.push({ key: 'foulsCommitted', label: 'Fautes commises', value: st.foulsCommitted });
    }
    if (typeof st.foulsSuffered === 'number') {
      metrics.push({ key: 'foulsSuffered', label: 'Fautes subies', value: st.foulsSuffered });
    }
    if (typeof st.offsides === 'number') {
      metrics.push({ key: 'offsides', label: 'Hors-jeu', value: st.offsides });
    }
    if (typeof st.yellowCards === 'number') {
      metrics.push({ key: 'yellowCards', label: 'Cartons jaunes', value: st.yellowCards, highlight: 'amber' });
    }
    if (typeof st.redCards === 'number') {
      metrics.push({ key: 'redCards', label: 'Cartons rouges', value: st.redCards, highlight: 'rose' });
    }
  }

  const hasGkSplitColumns =
    isGoalkeeper &&
    splits.some(
      (s) =>
        typeof s.saves === 'number' ||
        typeof s.cleanSheets === 'number' ||
        typeof s.goalsConceded === 'number'
    );

  const metaParts: string[] = [];
  if (player.teamName) metaParts.push(player.teamName);
  if (player.position) metaParts.push(player.position);
  if (player.jersey) metaParts.push(`#${player.jersey}`);
  if (player.nationality) metaParts.push(player.nationality);
  if (typeof player.age === 'number') metaParts.push(`${player.age} ans`);
  if (player.height) metaParts.push(player.height);
  if (player.weight) metaParts.push(player.weight);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="player-season-stats-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full sm:max-w-2xl max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-[#0F0F16] border border-white/10 overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-white/8 bg-gradient-to-b from-violet-950/20 to-transparent shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-300 shrink-0">
              <User className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2
                id="player-season-stats-title"
                className="font-display text-xl sm:text-2xl font-bold text-white truncate"
              >
                {player.name}
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                {metaParts.join(' · ') || 'Profil joueur officiel'}
              </p>
              {player.seasonLabel && (
                <p className="text-xs text-violet-300 font-medium mt-1">
                  {player.seasonLabel}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer les statistiques saisonnières"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-zinc-400 hover:text-white hover:bg-white/8 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto p-5 space-y-6">
          {loading && (
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20 text-xs text-violet-200">
              <RefreshCw className="w-4 h-4 animate-spin text-violet-400 shrink-0" />
              <span>Actualisation des statistiques saisonnières par compétition...</span>
            </div>
          )}

          {/* Summary Metrics */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-violet-400" aria-hidden="true" />
                Statistiques de la saison
              </h3>
              <span className="text-xs text-zinc-400">
                {player.source === 'sportradar' ? 'Sportradar v4' : 'Données officielles'}
              </span>
            </div>

            {metrics.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {metrics.map((m) => {
                  const valueColor =
                    m.highlight === 'violet'
                      ? 'text-violet-300'
                      : m.highlight === 'emerald'
                      ? 'text-emerald-300'
                      : m.highlight === 'amber'
                      ? 'text-amber-300'
                      : m.highlight === 'rose'
                      ? 'text-rose-300'
                      : 'text-white';
                  return (
                    <div
                      key={m.key}
                      className="p-3.5 rounded-2xl bg-[#12121A] border border-white/8"
                    >
                      <p className="text-xs text-zinc-400 truncate">{m.label}</p>
                      <p
                        className={`text-xl font-display font-bold tabular-nums mt-1 ${valueColor}`}
                      >
                        {m.value}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : !loading ? (
              <div className="p-4 rounded-2xl bg-[#12121A] border border-white/8 text-xs sm:text-sm text-zinc-300 space-y-1.5">
                <p className="font-semibold text-white">Aucune statistique saisonnière publiée</p>
                <p className="text-xs text-zinc-400">
                  Le fournisseur officiel n&apos;a pas encore transmis de totaux cumulés pour ce joueur sur cette saison. Aucune donnée n&apos;est estimée.
                </p>
              </div>
            ) : null}
          </section>

          {/* Competition Breakdown */}
          {splits.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-violet-400" aria-hidden="true" />
                Détail par compétition ({splits.length})
              </h3>
              <div className="rounded-2xl bg-[#12121A] border border-white/8 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-white/8 text-zinc-400">
                        <th className="py-2.5 pl-4 pr-2 font-medium">Compétition</th>
                        <th className="py-2.5 px-2 font-medium text-center" title="Matchs ou titularisations">
                          MJ / Tit.
                        </th>
                        <th className="py-2.5 px-2 font-medium text-center">Buts</th>
                        <th className="py-2.5 px-2 font-medium text-center">Passes D.</th>
                        <th className="py-2.5 px-2 font-medium text-center">Tirs (Cadrés)</th>
                        {hasGkSplitColumns && (
                          <th className="py-2.5 px-2 font-medium text-center">Arrêts / CS</th>
                        )}
                        <th className="py-2.5 pl-2 pr-4 font-medium text-center">Cartons</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/6">
                      {splits.map((sp) => {
                        const playedDisplay =
                          typeof sp.appearances === 'number' && typeof sp.starts === 'number'
                            ? `${sp.appearances} (${sp.starts})`
                            : typeof sp.appearances === 'number'
                            ? `${sp.appearances}`
                            : typeof sp.starts === 'number'
                            ? `${sp.starts}`
                            : '—';
                        const shotsDisplay =
                          typeof sp.shots === 'number'
                            ? typeof sp.shotsOnTarget === 'number'
                              ? `${sp.shots} (${sp.shotsOnTarget})`
                              : `${sp.shots}`
                            : '—';
                        const cardsDisplay =
                          typeof sp.yellowCards === 'number' || typeof sp.redCards === 'number'
                            ? `${sp.yellowCards ?? 0}J / ${sp.redCards ?? 0}R`
                            : '—';

                        return (
                          <tr key={sp.id} className="hover:bg-white/3">
                            <td className="py-2.5 pl-4 pr-2 min-w-[170px]">
                              <p className="font-medium text-white leading-snug">{sp.seasonName}</p>
                              {sp.teamName && (
                                <p className="text-[11px] text-zinc-400 mt-0.5">{sp.teamName}</p>
                              )}
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono text-zinc-200 tabular-nums whitespace-nowrap">
                              {playedDisplay}
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono font-semibold text-violet-300 tabular-nums">
                              {typeof sp.goals === 'number' ? sp.goals : '—'}
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono text-emerald-300 tabular-nums">
                              {typeof sp.assists === 'number' ? sp.assists : '—'}
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono text-zinc-300 tabular-nums whitespace-nowrap">
                              {shotsDisplay}
                            </td>
                            {hasGkSplitColumns && (
                              <td className="py-2.5 px-2 text-center font-mono text-zinc-200 tabular-nums whitespace-nowrap">
                                {typeof sp.saves === 'number' || typeof sp.cleanSheets === 'number'
                                  ? `${sp.saves ?? 0} / ${sp.cleanSheets ?? 0}`
                                  : '—'}
                              </td>
                            )}
                            <td className="py-2.5 pl-2 pr-4 text-center font-mono text-zinc-300 tabular-nums whitespace-nowrap">
                              {cardsDisplay}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
