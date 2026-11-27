import React, { useEffect, useState } from 'react';
import { ArrowLeft, AlertCircle, RefreshCw, Star } from 'lucide-react';
import {
  sortStandings,
  type CompetitionInfo,
  type MatchItem,
  type StandingRow,
  type TeamRef,
} from '../lib/football';
import { fetchMatchesApi, fetchStandingsApi } from '../lib/apiClient';
import { ClubLogo } from './ClubLogo';
import { MatchCard } from './MatchCard';

interface StandingsViewProps {
  competition: CompetitionInfo;
  onBack: () => void;
  isFavoriteCompetition: boolean;
  onToggleFavoriteCompetition: (id: string) => void;
  isFavoriteClub: (teamId: string) => boolean;
  onToggleFavoriteClub: (team: TeamRef, match: MatchItem) => void;
  onSelectMatch: (match: MatchItem) => void;
}

interface StandingsPayload {
  season: string;
  tables: { groupName: string; rows: StandingRow[] }[];
  stale?: boolean;
}

export const StandingsView: React.FC<StandingsViewProps> = ({
  competition,
  onBack,
  isFavoriteCompetition,
  onToggleFavoriteCompetition,
  isFavoriteClub,
  onToggleFavoriteClub,
  onSelectMatch,
}) => {
  const [data, setData] = useState<StandingsPayload | null>(null);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [stJson, mJson] = await Promise.all([
        fetchStandingsApi(competition.id),
        fetchMatchesApi(today, competition.id).catch(() => ({ matches: [] as MatchItem[] })),
      ]);
      setData(stJson);
      setMatches(Array.isArray(mJson?.matches) ? mJson.matches : []);
    } catch (err: any) {
      setError(err?.message || 'Impossible de charger le classement.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [competition.id]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            aria-label="Retour aux compétitions"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-[#12121A] border border-white/10 text-zinc-200 hover:border-violet-500/50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight truncate">
              {competition.name}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400">
              {competition.country} {data?.season ? `· ${data.season}` : ''}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onToggleFavoriteCompetition(competition.id)}
          aria-pressed={isFavoriteCompetition}
          className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-medium inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 ${
            isFavoriteCompetition
              ? 'bg-violet-600 text-white'
              : 'bg-[#12121A] border border-white/10 text-zinc-200 hover:border-violet-500/40'
          }`}
        >
          <Star className={`w-4 h-4 ${isFavoriteCompetition ? 'fill-white' : ''}`} />
          {isFavoriteCompetition ? 'Compétition suivie' : 'Suivre'}
        </button>
      </div>

      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center gap-3 text-zinc-400">
          <RefreshCw className="w-6 h-6 animate-spin text-violet-400" />
          <p className="text-sm">Chargement du classement officiel...</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-[#12121A] border border-white/8 text-center space-y-3">
          <AlertCircle className="w-7 h-7 text-amber-400 mx-auto" />
          <p className="text-sm text-zinc-200">{error}</p>
          <button
            type="button"
            onClick={loadData}
            className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
          >
            Réessayer
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {data?.tables && data.tables.length > 0 ? (
            data.tables.map((group) => {
              const sorted = sortStandings(group.rows);
              return (
                <section
                  key={group.groupName}
                  className="rounded-2xl bg-[#12121A] border border-white/8 overflow-hidden"
                >
                  {data.tables.length > 1 && (
                    <div className="px-4 py-3 border-b border-white/8">
                      <h3 className="text-sm font-semibold text-white">{group.groupName}</h3>
                    </div>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/8 text-xs text-zinc-400">
                          <th className="py-3 pl-4 pr-2 font-medium w-10">#</th>
                          <th className="py-3 px-2 font-medium">Club</th>
                          <th className="py-3 px-2 font-medium text-center">MJ</th>
                          <th className="py-3 px-2 font-medium text-center">V</th>
                          <th className="py-3 px-2 font-medium text-center">N</th>
                          <th className="py-3 px-2 font-medium text-center">D</th>
                          <th className="py-3 px-2 font-medium text-center hidden sm:table-cell">BP</th>
                          <th className="py-3 px-2 font-medium text-center hidden sm:table-cell">BC</th>
                          <th className="py-3 px-2 font-medium text-center">Diff</th>
                          <th className="py-3 pl-2 pr-4 font-bold text-right text-white">Pts</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/6 text-sm">
                        {sorted.map((row) => (
                          <tr key={row.teamId} className="hover:bg-white/3 transition-colors">
                            <td className="py-2.5 pl-4 pr-2 font-mono text-xs text-zinc-400 tabular-nums">
                              {row.rank}
                            </td>
                            <td className="py-2.5 px-2">
                              <div className="flex items-center gap-2.5 min-w-[140px]">
                                <ClubLogo src={row.teamLogo} name={row.teamName} size="sm" />
                                <span className="font-medium text-zinc-100 truncate max-w-[180px] sm:max-w-none">
                                  {row.teamName}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono text-xs text-zinc-300 tabular-nums">
                              {row.played}
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono text-xs text-zinc-300 tabular-nums">
                              {row.wins}
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono text-xs text-zinc-300 tabular-nums">
                              {row.draws}
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono text-xs text-zinc-300 tabular-nums">
                              {row.losses}
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono text-xs text-zinc-400 tabular-nums hidden sm:table-cell">
                              {row.goalsFor}
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono text-xs text-zinc-400 tabular-nums hidden sm:table-cell">
                              {row.goalsAgainst}
                            </td>
                            <td
                              className={`py-2.5 px-2 text-center font-mono text-xs tabular-nums ${
                                row.goalDifference > 0
                                  ? 'text-emerald-400'
                                  : row.goalDifference < 0
                                  ? 'text-rose-400'
                                  : 'text-zinc-400'
                              }`}
                            >
                              {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                            </td>
                            <td className="py-2.5 pl-2 pr-4 text-right font-mono font-bold text-violet-300 tabular-nums">
                              {row.points}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })
          ) : (
            <div className="p-6 rounded-2xl bg-[#12121A] border border-white/8 text-center text-sm text-zinc-400">
              Aucun classement publié pour le moment pour cette compétition (tournoi en phase à élimination directe ou hors saison).
            </div>
          )}

          {/* Competition matches today */}
          <section className="space-y-3">
            <h3 className="text-base font-semibold text-white">Matchs du jour · {competition.shortName}</h3>
            {matches.length === 0 ? (
              <p className="text-sm text-zinc-400">
                Aucun match programmé aujourd&apos;hui dans cette compétition.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {matches.map((m) => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    isFavoriteClub={isFavoriteClub}
                    onToggleFavoriteClub={onToggleFavoriteClub}
                    onSelectMatch={onSelectMatch}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};
