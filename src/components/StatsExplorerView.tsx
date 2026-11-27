import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, RefreshCw, AlertCircle, ExternalLink } from 'lucide-react';
import { type MatchDetailResponse, type MatchItem } from '../lib/football';
import { fetchMatchDetailApi } from '../lib/apiClient';
import { TeamRadarChart } from './TeamRadarChart';

interface StatsExplorerViewProps {
  matches: MatchItem[];
  onOpenMatchModal: (match: MatchItem) => void;
}

export const StatsExplorerView: React.FC<StatsExplorerViewProps> = ({
  matches,
  onOpenMatchModal,
}) => {
  const selectableMatches = useMemo(() => {
    const live = matches.filter((m) => m.status === 'live');
    const finished = matches.filter((m) => m.status === 'finished');
    const upcoming = matches.filter((m) => m.status === 'upcoming');
    return [...live, ...finished, ...upcoming];
  }, [matches]);

  const [selectedMatchId, setSelectedMatchId] = useState<string>(selectableMatches[0]?.id || '');
  const [detail, setDetail] = useState<MatchDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedMatch = useMemo(
    () => selectableMatches.find((m) => m.id === selectedMatchId) || selectableMatches[0] || null,
    [selectableMatches, selectedMatchId]
  );

  useEffect(() => {
    if (!selectedMatch) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchMatchDetailApi(selectedMatch.competitionId, selectedMatch.id);
        if (!cancelled) setDetail(res);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Statistiques détaillées indisponibles.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [selectedMatch?.id, selectedMatch?.competitionId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Statistiques détaillées
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
            Possession, tirs, tirs cadrés, corners, fautes, cartons, hors-jeu et performances individuelles officielles.
          </p>
        </div>
      </div>

      {selectableMatches.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[#12121A] border border-white/8 text-center space-y-2">
          <BarChart3 className="w-8 h-8 text-violet-400 mx-auto" />
          <p className="text-sm text-zinc-300">
            Aucun match chargé pour cette date. Sélectionnez une autre journée dans le calendrier.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl bg-[#12121A] border border-white/8 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <label htmlFor="stats-match-select" className="block text-xs text-zinc-400 mb-1.5">
                Choisir une rencontre à analyser
              </label>
              <select
                id="stats-match-select"
                value={selectedMatch?.id || ''}
                onChange={(e) => setSelectedMatchId(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#09090E] border border-white/10 text-sm text-white focus:outline-none focus:border-violet-500"
              >
                {selectableMatches.slice(0, 60).map((m) => (
                  <option key={m.id} value={m.id}>
                    [{m.status === 'live' ? 'DIRECT' : m.status === 'finished' ? 'TERMINÉ' : 'À VENIR'}] {m.home.name}{' '}
                    {m.home.score !== null ? m.home.score : '-'} : {m.away.score !== null ? m.away.score : '-'}{' '}
                    {m.away.name} ({m.competitionName})
                  </option>
                ))}
              </select>
            </div>
            {selectedMatch && (
              <button
                type="button"
                onClick={() => onOpenMatchModal(selectedMatch)}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0 self-end"
              >
                Fiche complète
                <ExternalLink className="w-4 h-4" />
              </button>
            )}
          </div>

          {loading ? (
            <div className="py-12 flex flex-col items-center gap-3 text-zinc-400">
              <RefreshCw className="w-6 h-6 animate-spin text-violet-400" />
              <p className="text-sm">Chargement des statistiques officielles...</p>
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl bg-[#12121A] border border-white/8 text-center space-y-2">
              <AlertCircle className="w-7 h-7 text-amber-400 mx-auto" />
              <p className="text-sm text-zinc-200">{error}</p>
            </div>
          ) : detail && selectedMatch ? (
            <div className="space-y-6">
              {detail.statistics.length === 0 ? (
                <div className="p-6 rounded-2xl bg-[#12121A] border border-white/8 text-center text-sm text-zinc-400">
                  {selectedMatch.status === 'upcoming'
                    ? "Les statistiques détaillées seront disponibles dès le coup d'envoi de cette rencontre."
                    : 'Statistiques collectives non transmises par le fournisseur officiel pour ce match.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                  <div className="rounded-2xl bg-[#12121A] border border-white/8 p-4">
                    <TeamRadarChart
                      statistics={detail.statistics}
                      homeName={selectedMatch.home.shortName}
                      awayName={selectedMatch.away.shortName}
                    />
                  </div>
                  <div className="rounded-2xl bg-[#12121A] border border-white/8 p-5 space-y-4">
                    <h2 className="text-sm font-semibold text-white">
                      Statistiques comparées ({selectedMatch.home.shortName} vs {selectedMatch.away.shortName})
                    </h2>
                    {detail.statistics.map((st) => {
                      const total = st.homeNumeric + st.awayNumeric;
                      const homePct = total > 0 ? Math.round((st.homeNumeric / total) * 100) : 50;
                      const awayPct = total > 0 ? 100 - homePct : 50;
                      return (
                        <div key={st.key} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs sm:text-sm">
                            <span className="font-mono font-bold text-white tabular-nums w-12">
                              {st.homeValue}
                            </span>
                            <span className="text-zinc-400 text-center flex-1">{st.label}</span>
                            <span className="font-mono font-bold text-white tabular-nums w-12 text-right">
                              {st.awayValue}
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-white/8 overflow-hidden flex gap-0.5">
                            <div className="bg-violet-500 h-full" style={{ width: `${homePct}%` }} />
                            <div className="bg-zinc-500 h-full" style={{ width: `${awayPct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Statistiques individuelles des joueurs si transmises */}
              {detail.playerStats && detail.playerStats.length > 0 && (
                <section className="rounded-2xl bg-[#12121A] border border-white/8 overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/8">
                    <h2 className="text-sm font-semibold text-white">
                      Statistiques individuelles des joueurs ({detail.playerStats.length})
                    </h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs sm:text-sm">
                      <thead>
                        <tr className="border-b border-white/8 text-zinc-400 text-xs">
                          <th className="py-2.5 pl-4 pr-2 font-medium">Joueur</th>
                          <th className="py-2.5 px-2 font-medium">Club</th>
                          <th className="py-2.5 px-2 font-medium text-center">Buts</th>
                          <th className="py-2.5 px-2 font-medium text-center">Passes D.</th>
                          <th className="py-2.5 px-2 font-medium text-center">Tirs</th>
                          <th className="py-2.5 px-2 font-medium text-center">Cadrés</th>
                          <th className="py-2.5 pl-2 pr-4 font-medium text-center">Cartons</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/6">
                        {detail.playerStats.slice(0, 30).map((ps) => (
                          <tr key={`${ps.teamId}-${ps.playerId}`} className="hover:bg-white/3">
                            <td className="py-2 pl-4 pr-2 font-medium text-white whitespace-nowrap">
                              {ps.name}
                            </td>
                            <td className="py-2 px-2 text-zinc-400 whitespace-nowrap">{ps.teamName}</td>
                            <td className="py-2 px-2 text-center font-mono text-violet-300 tabular-nums">
                              {ps.goals ?? '—'}
                            </td>
                            <td className="py-2 px-2 text-center font-mono text-zinc-200 tabular-nums">
                              {ps.assists ?? '—'}
                            </td>
                            <td className="py-2 px-2 text-center font-mono text-zinc-300 tabular-nums">
                              {ps.shots ?? '—'}
                            </td>
                            <td className="py-2 px-2 text-center font-mono text-zinc-300 tabular-nums">
                              {ps.shotsOnTarget ?? '—'}
                            </td>
                            <td className="py-2 pl-2 pr-4 text-center font-mono text-zinc-300 tabular-nums">
                              {(ps.yellowCards ?? 0) > 0 || (ps.redCards ?? 0) > 0
                                ? `${ps.yellowCards ?? 0}J / ${ps.redCards ?? 0}R`
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
};
