import React, { useEffect, useState } from 'react';
import {
  X,
  Star,
  ArrowLeftRight,
  AlertCircle,
  RefreshCw,
  MapPin,
  Calendar,
  Sparkles,
  PlayCircle,
  CheckCircle2,
  History,
  ChevronRight,
  ArrowRightLeft,
  ExternalLink,
} from 'lucide-react';
import {
  formatLocalDateFr,
  formatLocalTimeFr,
  formatShortDateWithYearFr,
  type MatchDetailResponse,
  type MatchItem,
  type StatPair,
  type TeamLineup,
  type TeamRef,
} from '../lib/football';
import { fetchMatchDetailApi, fetchMatchTransfersApi } from '../lib/apiClient';
import type { MatchTransfersResponse } from '../lib/transfers';
import { ClubLogo } from './ClubLogo';
import { TeamRadarChart } from './TeamRadarChart';

interface MatchDetailModalProps {
  match: MatchItem;
  onClose: () => void;
  isFavoriteClub: (teamId: string) => boolean;
  onToggleFavoriteClub: (team: TeamRef, match: MatchItem) => void;
  bonusUnlocked: boolean;
  isOnline: boolean;
  onRequestRewardedAd: () => void;
}

type DetailTab = 'events' | 'stats' | 'lineups' | 'h2h' | 'transfers';
type TransferClubFilter = 'all' | 'home' | 'away';

export const MatchDetailModal: React.FC<MatchDetailModalProps> = ({
  match,
  onClose,
  isFavoriteClub,
  onToggleFavoriteClub,
  bonusUnlocked,
  isOnline,
  onRequestRewardedAd,
}) => {
  const [activeTab, setActiveTab] = useState<DetailTab>('events');
  const [detail, setDetail] = useState<MatchDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transfers, setTransfers] = useState<MatchTransfersResponse | null>(null);
  const [transfersLoading, setTransfersLoading] = useState(true);
  const [transfersError, setTransfersError] = useState<string | null>(null);
  const [transferFilter, setTransferFilter] = useState<TransferClubFilter>('all');

  const loadDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await fetchMatchDetailApi(match.competitionId, match.id);
      setDetail(json);
    } catch (err: any) {
      setError(err?.message || 'Erreur lors du chargement des détails du match.');
    } finally {
      setLoading(false);
    }
  };

  const loadTransfers = async () => {
    setTransfersLoading(true);
    setTransfersError(null);
    try {
      const res = await fetchMatchTransfersApi({
        competitionId: match.competitionId,
        homeId: match.home.id,
        homeName: match.home.name,
        homeShortName: match.home.shortName,
        awayId: match.away.id,
        awayName: match.away.name,
        awayShortName: match.away.shortName,
      });
      setTransfers(res);
    } catch (err: any) {
      setTransfersError(err?.message || 'Impossible de charger les transferts pour le moment.');
    } finally {
      setTransfersLoading(false);
    }
  };

  useEffect(() => {
    setTransferFilter('all');
    loadDetail();
    loadTransfers();
  }, [match.id, match.competitionId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const currentMatch = detail?.match || match;
  const homeFav = isFavoriteClub(currentMatch.home.id);
  const awayFav = isFavoriteClub(currentMatch.away.id);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="match-detail-title"
    >
      <div className="w-full sm:max-w-3xl max-h-[92vh] sm:max-h-[88vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-[#0F0F16] border border-white/10 overflow-hidden shadow-2xl">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-white/8 shrink-0">
          <div className="min-w-0">
            <p id="match-detail-title" className="text-sm font-semibold text-white truncate">
              {currentMatch.competitionName}
            </p>
            <p className="text-xs text-zinc-400 flex items-center gap-2 truncate">
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3 h-3" aria-hidden="true" />
                {formatLocalDateFr(currentMatch.dateIso)} · {formatLocalTimeFr(currentMatch.dateIso)}
              </span>
              {currentMatch.venue && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">{currentMatch.venue}</span>
                  </span>
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer les détails du match"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-zinc-400 hover:text-white hover:bg-white/8 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scoreboard Hero */}
        <div className="px-5 py-5 bg-gradient-to-b from-violet-950/25 to-transparent border-b border-white/8 shrink-0">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
            {/* Home Club */}
            <div className="flex flex-col items-center text-center gap-2">
              <ClubLogo
                src={currentMatch.home.logo}
                name={currentMatch.home.name}
                abbreviation={currentMatch.home.abbreviation}
                size="lg"
              />
              <span className="text-sm sm:text-base font-semibold text-white leading-tight line-clamp-2">
                {currentMatch.home.name}
              </span>
              <button
                type="button"
                onClick={() => onToggleFavoriteClub(currentMatch.home, currentMatch)}
                aria-label={homeFav ? `Retirer ${currentMatch.home.name} des favoris` : `Suivre ${currentMatch.home.name}`}
                aria-pressed={homeFav}
                className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  homeFav
                    ? 'bg-violet-600/25 text-violet-200 border border-violet-500/40'
                    : 'bg-white/5 text-zinc-400 hover:text-white border border-white/10'
                }`}
              >
                <Star className={`w-3.5 h-3.5 ${homeFav ? 'fill-violet-400 text-violet-400' : ''}`} />
                {homeFav ? 'Suivi' : 'Suivre'}
              </button>
            </div>

            {/* Score Center */}
            <div className="flex flex-col items-center justify-center gap-1.5 min-w-[96px]">
              {currentMatch.status === 'live' && (
                <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-violet-300">
                  <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" aria-hidden="true" />
                  {currentMatch.minuteDisplay || 'Direct'}
                </span>
              )}
              {currentMatch.status !== 'live' && (
                <span className="text-xs font-medium text-zinc-400">{currentMatch.statusText}</span>
              )}

              <div className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-white tabular-nums flex items-center gap-2">
                <span>{currentMatch.home.score !== null ? currentMatch.home.score : '-'}</span>
                <span className="text-zinc-600 text-3xl">:</span>
                <span>{currentMatch.away.score !== null ? currentMatch.away.score : '-'}</span>
              </div>

              {currentMatch.isPenalties &&
                currentMatch.home.penaltyScore !== null &&
                currentMatch.away.penaltyScore !== null && (
                  <span className="text-xs font-mono text-violet-300 tabular-nums">
                    TAB : {currentMatch.home.penaltyScore} - {currentMatch.away.penaltyScore}
                  </span>
                )}
              {currentMatch.isExtraTime && !currentMatch.isPenalties && (
                <span className="text-xs text-violet-300">Après prolongations</span>
              )}
            </div>

            {/* Away Club */}
            <div className="flex flex-col items-center text-center gap-2">
              <ClubLogo
                src={currentMatch.away.logo}
                name={currentMatch.away.name}
                abbreviation={currentMatch.away.abbreviation}
                size="lg"
              />
              <span className="text-sm sm:text-base font-semibold text-white leading-tight line-clamp-2">
                {currentMatch.away.name}
              </span>
              <button
                type="button"
                onClick={() => onToggleFavoriteClub(currentMatch.away, currentMatch)}
                aria-label={awayFav ? `Retirer ${currentMatch.away.name} des favoris` : `Suivre ${currentMatch.away.name}`}
                aria-pressed={awayFav}
                className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  awayFav
                    ? 'bg-violet-600/25 text-violet-200 border border-violet-500/40'
                    : 'bg-white/5 text-zinc-400 hover:text-white border border-white/10'
                }`}
              >
                <Star className={`w-3.5 h-3.5 ${awayFav ? 'fill-violet-400 text-violet-400' : ''}`} />
                {awayFav ? 'Suivi' : 'Suivre'}
              </button>
            </div>
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div
          className="grid grid-cols-5 border-b border-white/8 bg-[#12121A] shrink-0"
          role="tablist"
          aria-label="Sections du match"
        >
          {(
            [
              { id: 'events', label: 'Résumé', shortLabel: 'Résumé' },
              { id: 'stats', label: 'Statistiques', shortLabel: 'Stats' },
              { id: 'lineups', label: 'Compositions', shortLabel: 'Compos' },
              { id: 'h2h', label: 'Face-à-face', shortLabel: 'H2H' },
              { id: 'transfers', label: 'Transferts', shortLabel: 'Mercato' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activeTab === t.id}
              onClick={() => setActiveTab(t.id)}
              className={`min-h-[44px] px-1.5 sm:px-2 text-[11px] sm:text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                activeTab === t.id
                  ? 'border-violet-500 text-white bg-violet-500/10'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span className="sm:hidden">{t.shortLabel}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Scrollable Detail Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-zinc-400">
              <RefreshCw className="w-6 h-6 animate-spin text-violet-400" />
              <p className="text-sm">Chargement des données officielles du match...</p>
            </div>
          ) : error ? (
            <div className="py-10 px-4 rounded-2xl bg-[#161622] border border-white/8 text-center space-y-3">
              <AlertCircle className="w-7 h-7 text-amber-400 mx-auto" />
              <p className="text-sm text-zinc-200">{error}</p>
              <button
                type="button"
                onClick={loadDetail}
                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
              >
                Réessayer
              </button>
            </div>
          ) : detail ? (
            <>
              {/* TAB 1: EVENTS */}
              {activeTab === 'events' && (
                <div className="space-y-3">
                  {detail.events.length === 0 ? (
                    <div className="py-10 text-center text-sm text-zinc-400">
                      {currentMatch.status === 'upcoming'
                        ? "Les événements du match s'afficheront en direct dès le coup d'envoi."
                        : 'Aucun événement détaillé transmis par le fournisseur pour cette rencontre.'}
                    </div>
                  ) : (
                    <ul className="divide-y divide-white/6">
                      {detail.events.map((ev) => (
                        <li key={ev.id} className="py-3 flex items-start gap-3">
                          <span className="font-mono text-xs font-bold text-violet-300 w-10 pt-0.5 shrink-0 tabular-nums">
                            {ev.minute || '·'}
                          </span>
                          <EventBadge type={ev.type} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-white">
                              {ev.player}
                              {ev.teamName ? (
                                <span className="text-zinc-400 font-normal"> · {ev.teamName}</span>
                              ) : null}
                            </p>
                            {ev.assistOrOut && (
                              <p className="text-xs text-zinc-400 mt-0.5">
                                {ev.type === 'substitution' ? `Remplace : ${ev.assistOrOut}` : `Passe décisive : ${ev.assistOrOut}`}
                              </p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Aperçu Face-à-Face directement visible dans Résumé */}
                  <div className="pt-4 mt-4 border-t border-white/8">
                    <div className="p-4 rounded-2xl bg-[#151520] border border-white/8 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                          <History className="w-4 h-4 text-violet-400" />
                          Face-à-Face (Head-to-Head)
                        </h3>
                        <button
                          type="button"
                          onClick={() => setActiveTab('h2h')}
                          className="text-xs font-medium text-violet-300 hover:text-violet-200 inline-flex items-center gap-1 transition-colors"
                        >
                          Voir l&apos;historique ({detail.h2h.matches.length})
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {detail.h2h.matches.length === 0 ? (
                        <p className="text-xs text-zinc-400">
                          Aucune confrontation récente enregistrée entre ces deux clubs sur les dernières saisons.
                        </p>
                      ) : (
                        <>
                          <div className="grid grid-cols-3 gap-2 text-center text-xs">
                            <div className="py-2 px-2 rounded-xl bg-violet-500/10 border border-violet-500/20">
                              <span className="font-mono font-bold text-base text-violet-300 tabular-nums">
                                {detail.h2h.homeWins}
                              </span>
                              <p className="text-zinc-400 truncate mt-0.5">{currentMatch.home.shortName}</p>
                            </div>
                            <div className="py-2 px-2 rounded-xl bg-white/5 border border-white/8">
                              <span className="font-mono font-bold text-base text-zinc-200 tabular-nums">
                                {detail.h2h.draws}
                              </span>
                              <p className="text-zinc-400 mt-0.5">Nuls</p>
                            </div>
                            <div className="py-2 px-2 rounded-xl bg-white/5 border border-white/8">
                              <span className="font-mono font-bold text-base text-white tabular-nums">
                                {detail.h2h.awayWins}
                              </span>
                              <p className="text-zinc-400 truncate mt-0.5">{currentMatch.away.shortName}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-2 text-xs text-zinc-300 pt-1">
                            <span className="truncate">
                              Dernier duel : <span className="text-white font-medium">{detail.h2h.matches[0].homeName}</span> {detail.h2h.matches[0].homeScore} - {detail.h2h.matches[0].awayScore} <span className="text-white font-medium">{detail.h2h.matches[0].awayName}</span>
                            </span>
                            <span className="text-zinc-500 shrink-0">
                              {formatShortDateWithYearFr(detail.h2h.matches[0].dateIso)}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: STATS */}
              {activeTab === 'stats' && (
                <div className="space-y-4">
                  {detail.statistics.length === 0 ? (
                    <div className="py-10 text-center text-sm text-zinc-400">
                      {currentMatch.status === 'upcoming'
                        ? 'Les statistiques détaillées seront disponibles une fois la rencontre commencée.'
                        : 'Statistiques avancées non disponibles auprès de la source pour ce match.'}
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <TeamRadarChart
                        statistics={detail.statistics}
                        homeName={currentMatch.home.shortName}
                        awayName={currentMatch.away.shortName}
                      />

                      <div className="space-y-4">
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
                              <div
                                className="bg-violet-500 h-full transition-all duration-300"
                                style={{ width: `${homePct}%` }}
                              />
                              <div
                                className="bg-zinc-500 h-full transition-all duration-300"
                                style={{ width: `${awayPct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                      </div>

                      {/* Statistiques individuelles des joueurs (si transmises par la source officielle) */}
                      {detail.playerStats && detail.playerStats.length > 0 && (
                        <div className="mt-5 pt-4 border-t border-white/8 space-y-2.5">
                          <h4 className="text-xs sm:text-sm font-semibold text-white">
                            Statistiques individuelles des joueurs ({detail.playerStats.length})
                          </h4>
                          <div className="overflow-x-auto rounded-2xl bg-[#151520] border border-white/8">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="border-b border-white/8 text-zinc-400">
                                  <th className="py-2 pl-3 pr-2 font-medium">Joueur</th>
                                  <th className="py-2 px-2 font-medium">Club</th>
                                  <th className="py-2 px-2 font-medium text-center">Buts</th>
                                  <th className="py-2 px-2 font-medium text-center">Passes</th>
                                  <th className="py-2 px-2 font-medium text-center">Tirs</th>
                                  <th className="py-2 pl-2 pr-3 font-medium text-center">Cartons</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/6">
                                {detail.playerStats.slice(0, 24).map((ps) => (
                                  <tr key={`${ps.teamId}-${ps.playerId}`}>
                                    <td className="py-2 pl-3 pr-2 text-white font-medium whitespace-nowrap">
                                      {ps.name}
                                    </td>
                                    <td className="py-2 px-2 text-zinc-400 whitespace-nowrap">
                                      {ps.teamName}
                                    </td>
                                    <td className="py-2 px-2 text-center font-mono text-violet-300 tabular-nums">
                                      {ps.goals ?? '—'}
                                    </td>
                                    <td className="py-2 px-2 text-center font-mono text-zinc-200 tabular-nums">
                                      {ps.assists ?? '—'}
                                    </td>
                                    <td className="py-2 px-2 text-center font-mono text-zinc-300 tabular-nums">
                                      {ps.shots ?? '—'}
                                    </td>
                                    <td className="py-2 pl-2 pr-3 text-center font-mono text-zinc-300 tabular-nums">
                                      {(ps.yellowCards ?? 0) > 0 || (ps.redCards ?? 0) > 0
                                        ? `${ps.yellowCards ?? 0}J/${ps.redCards ?? 0}R`
                                        : '—'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Contenu bonus débloqué par publicité vidéo récompensée */}
                      <BonusTacticalSection
                        statistics={detail.statistics}
                        homeName={currentMatch.home.shortName}
                        awayName={currentMatch.away.shortName}
                        unlocked={bonusUnlocked}
                        isOnline={isOnline}
                        onRequestUnlock={onRequestRewardedAd}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: LINEUPS */}
              {activeTab === 'lineups' && (
                <div className="space-y-6">
                  {!detail.lineups.home && !detail.lineups.away ? (
                    <div className="py-10 text-center text-sm text-zinc-400">
                      Les compositions officielles sont publiées environ 1 heure avant le coup d&apos;envoi (si transmises par le fournisseur).
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <LineupColumn
                        title={currentMatch.home.name}
                        lineup={detail.lineups.home}
                      />
                      <LineupColumn
                        title={currentMatch.away.name}
                        lineup={detail.lineups.away}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: H2H */}
              {activeTab === 'h2h' && (() => {
                const totalH2H = detail.h2h.homeWins + detail.h2h.draws + detail.h2h.awayWins;
                const homePct = totalH2H > 0 ? Math.round((detail.h2h.homeWins / totalH2H) * 100) : 34;
                const drawPct = totalH2H > 0 ? Math.round((detail.h2h.draws / totalH2H) * 100) : 32;
                const awayPct = totalH2H > 0 ? Math.max(0, 100 - homePct - drawPct) : 34;

                return (
                  <div className="space-y-5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
                        <History className="w-4 h-4 text-violet-400" />
                        Face-à-Face (Confrontations directes)
                      </h3>
                      <span className="text-xs font-mono text-zinc-400 tabular-nums">
                        {detail.h2h.matches.length} {detail.h2h.matches.length > 1 ? 'rencontres' : 'rencontre'}
                      </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#151520] border border-white/8 space-y-4">
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div>
                          <p className="text-2xl font-display font-bold text-violet-300 tabular-nums">
                            {detail.h2h.homeWins}
                          </p>
                          <p className="text-xs text-zinc-400 truncate">Victoires · {currentMatch.home.shortName}</p>
                        </div>
                        <div>
                          <p className="text-2xl font-display font-bold text-zinc-200 tabular-nums">
                            {detail.h2h.draws}
                          </p>
                          <p className="text-xs text-zinc-400">Matchs nuls</p>
                        </div>
                        <div>
                          <p className="text-2xl font-display font-bold text-white tabular-nums">
                            {detail.h2h.awayWins}
                          </p>
                          <p className="text-xs text-zinc-400 truncate">Victoires · {currentMatch.away.shortName}</p>
                        </div>
                      </div>

                      {totalH2H > 0 && (
                        <>
                          <div className="h-2 rounded-full bg-white/8 overflow-hidden flex gap-0.5">
                            <div className="bg-violet-500 h-full" style={{ width: `${homePct}%` }} />
                            <div className="bg-zinc-500 h-full" style={{ width: `${drawPct}%` }} />
                            <div className="bg-zinc-200 h-full" style={{ width: `${awayPct}%` }} />
                          </div>
                          {typeof detail.h2h.homeGoals === 'number' && typeof detail.h2h.awayGoals === 'number' && (
                            <div className="flex items-center justify-between text-xs text-zinc-400 pt-1 border-t border-white/6">
                              <span>
                                Buts inscrits : <strong className="text-violet-300 font-mono tabular-nums">{detail.h2h.homeGoals}</strong> ({currentMatch.home.shortName})
                              </span>
                              <span>
                                <strong className="text-white font-mono tabular-nums">{detail.h2h.awayGoals}</strong> ({currentMatch.away.shortName})
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {detail.h2h.matches.length === 0 ? (
                      <div className="py-8 text-center text-sm text-zinc-400">
                        Aucune confrontation récente enregistrée sur les dernières saisons.
                      </div>
                    ) : (
                      <ul className="divide-y divide-white/8 rounded-2xl bg-[#151520]/60 border border-white/8 px-4">
                        {detail.h2h.matches.map((h) => {
                          const homeWon = h.homeScore > h.awayScore;
                          const awayWon = h.awayScore > h.homeScore;
                          return (
                            <li key={h.id} className="py-3.5 flex items-center justify-between gap-3 text-sm">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs text-zinc-500">
                                  {formatShortDateWithYearFr(h.dateIso)} · {h.competitionName}
                                </p>
                                <p className="text-zinc-300 truncate mt-0.5">
                                  <span className={homeWon ? 'text-white font-semibold' : ''}>{h.homeName}</span>
                                  <span className="text-zinc-500 mx-1.5">vs</span>
                                  <span className={awayWon ? 'text-white font-semibold' : ''}>{h.awayName}</span>
                                </p>
                              </div>
                              <span className="font-mono font-bold text-white tabular-nums shrink-0 px-3 py-1 rounded-lg bg-white/8 border border-white/8">
                                {h.homeScore} - {h.awayScore}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })()}
            </>
          ) : null}

          {/* TAB 5: TRANSFERTS (indépendant du détail match si besoin) */}
          {activeTab === 'transfers' && (() => {
            const allItems = transfers?.items || [];
            const filteredItems = allItems.filter((item) => {
              if (transferFilter === 'all') return true;
              return item.clubSide === transferFilter || item.clubSide === 'both';
            });

            return (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
                      <ArrowRightLeft className="w-4 h-4 text-violet-400" />
                      Rumeurs &amp; Officialisations de Transferts
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Source dédiée : {transfers?.sourceName || 'ESPN Transfer Talk'}
                    </p>
                  </div>
                </div>

                {/* Filtre par club */}
                <div className="flex items-center gap-2 flex-wrap">
                  {(
                    [
                      { id: 'all', label: `Tous (${allItems.length})` },
                      { id: 'home', label: currentMatch.home.shortName },
                      { id: 'away', label: currentMatch.away.shortName },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setTransferFilter(f.id)}
                      className={`min-h-[36px] px-3 py-1 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
                        transferFilter === f.id
                          ? 'bg-violet-600 text-white'
                          : 'bg-[#151520] border border-white/10 text-zinc-300 hover:border-violet-500/40'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {transfersLoading ? (
                  <div className="py-10 flex flex-col items-center justify-center gap-3 text-zinc-400">
                    <RefreshCw className="w-5 h-5 animate-spin text-violet-400" />
                    <p className="text-sm">Recherche des derniers mouvements et rumeurs mercato...</p>
                  </div>
                ) : transfersError ? (
                  <div className="p-6 rounded-2xl bg-[#151520] border border-white/8 text-center space-y-3">
                    <AlertCircle className="w-6 h-6 text-amber-400 mx-auto" />
                    <p className="text-sm text-zinc-200">{transfersError}</p>
                    <button
                      type="button"
                      onClick={loadTransfers}
                      className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium"
                    >
                      Réessayer
                    </button>
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-[#151520] border border-white/8 text-center space-y-2">
                    <ArrowRightLeft className="w-6 h-6 text-violet-400 mx-auto" />
                    <p className="text-sm font-medium text-white">
                      Aucune actualité mercato récente trouvée
                    </p>
                    <p className="text-xs text-zinc-400 max-w-md mx-auto">
                      Aucune rumeur ou officialisation récente concernant {currentMatch.home.shortName} ou {currentMatch.away.shortName} n&apos;est remontée par la source dédiée pour le moment.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {filteredItems.map((item) => (
                      <li
                        key={item.id}
                        className="p-4 rounded-2xl bg-[#151520] border border-white/8 hover:border-violet-500/35 transition-colors space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-md font-semibold ${
                                item.status === 'official'
                                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-violet-500/15 text-violet-300 border border-violet-500/30'
                              }`}
                            >
                              {item.status === 'official' ? 'Officialisé' : 'Rumeur'}
                            </span>
                            <span className="text-zinc-300 font-medium">{item.clubName}</span>
                          </div>
                          <span className="text-zinc-500">
                            {formatShortDateWithYearFr(item.publishedAt)}
                          </span>
                        </div>

                        <h4 className="text-sm font-semibold text-white leading-snug">
                          {item.title}
                        </h4>

                        {item.summary && (
                          <p className="text-xs text-zinc-400 leading-relaxed">
                            {item.summary}
                          </p>
                        )}

                        <div className="pt-1 flex items-center justify-between text-xs">
                          <span className="text-zinc-500">{item.source}</span>
                          {item.url && (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-violet-400 hover:text-violet-300 font-medium"
                            >
                              Lire la source
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

const EventBadge: React.FC<{ type: MatchDetailResponse['events'][number]['type'] }> = ({ type }) => {
  if (type === 'goal' || type === 'penalty-goal' || type === 'own-goal') {
    return (
      <span
        className="w-6 h-6 rounded-full bg-violet-500/20 border border-violet-400/50 text-violet-200 flex items-center justify-center text-[11px] font-bold shrink-0"
        title="But"
      >
        ⚽
      </span>
    );
  }
  if (type === 'penalty-missed') {
    return (
      <span
        className="w-6 h-6 rounded-full bg-rose-500/15 border border-rose-400/40 text-rose-300 flex items-center justify-center text-[11px] font-bold shrink-0"
        title="Penalty manqué"
      >
        ✕
      </span>
    );
  }
  if (type === 'yellow-card') {
    return <span className="w-3.5 h-5 rounded-sm bg-amber-400 shrink-0 mt-0.5 mx-1" title="Carton jaune" />;
  }
  if (type === 'red-card') {
    return <span className="w-3.5 h-5 rounded-sm bg-rose-500 shrink-0 mt-0.5 mx-1" title="Carton rouge" />;
  }
  if (type === 'substitution') {
    return (
      <span className="w-6 h-6 rounded-full bg-emerald-500/15 text-emerald-300 flex items-center justify-center shrink-0">
        <ArrowLeftRight className="w-3.5 h-3.5" />
      </span>
    );
  }
  return <span className="w-2 h-2 rounded-full bg-zinc-500 shrink-0 mt-2 mx-2" />;
};

const LineupColumn: React.FC<{ title: string; lineup: TeamLineup | null }> = ({ title, lineup }) => {
  if (!lineup) {
    return (
      <div className="p-4 rounded-2xl bg-[#151520] border border-white/8 text-sm text-zinc-400">
        Composition non communiquée pour {title}.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-white/8 pb-2">
        <h4 className="text-sm font-semibold text-white">{title}</h4>
        {lineup.formation && (
          <span className="font-mono text-xs font-bold text-violet-300">
            {lineup.formation}
          </span>
        )}
      </div>

      <div>
        <p className="text-xs font-medium text-zinc-400 mb-2">Onze titulaires ({lineup.starters.length})</p>
        <ul className="space-y-1.5">
          {lineup.starters.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-2 text-sm py-1 border-b border-white/4 last:border-none"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="font-mono text-xs text-violet-300 w-6 tabular-nums shrink-0">
                  {p.jersey || '-'}
                </span>
                <span className="text-zinc-100 truncate">{p.name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 text-xs">
                {p.subbedOut && <span className="text-rose-400">Sorti</span>}
                <span className="text-zinc-500 font-mono">{p.position}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {lineup.substitutes.length > 0 && (
        <div>
          <p className="text-xs font-medium text-zinc-400 mb-2">Remplaçants ({lineup.substitutes.length})</p>
          <ul className="space-y-1.5">
            {lineup.substitutes.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 text-xs py-1 text-zinc-300"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="font-mono text-zinc-500 w-6 tabular-nums shrink-0">
                    {p.jersey || '-'}
                  </span>
                  <span className="truncate">{p.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {p.subbedIn && <span className="text-emerald-400 font-medium">Entré</span>}
                  <span className="text-zinc-500 font-mono">{p.position}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const BonusTacticalSection: React.FC<{
  statistics: StatPair[];
  homeName: string;
  awayName: string;
  unlocked: boolean;
  isOnline: boolean;
  onRequestUnlock: () => void;
}> = ({ statistics, homeName, awayName, unlocked, isOnline, onRequestUnlock }) => {
  const findStat = (key: string) => statistics.find((s) => s.key === key);
  const shots = findStat('totalShots');
  const onTarget = findStat('shotsOnTarget');
  const corners = findStat('wonCorners');
  const poss = findStat('possessionPct');

  const homeAcc =
    shots && onTarget && shots.homeNumeric > 0
      ? Math.round((onTarget.homeNumeric / shots.homeNumeric) * 100)
      : 0;
  const awayAcc =
    shots && onTarget && shots.awayNumeric > 0
      ? Math.round((onTarget.awayNumeric / shots.awayNumeric) * 100)
      : 0;

  return (
    <div className="mt-6 pt-5 border-t border-white/10">
      {unlocked ? (
        <div className="p-4 rounded-2xl bg-violet-950/25 border border-violet-500/35 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Analyse Tactique Bonus (Débloquée)
            </h4>
            <span className="text-[11px] font-mono text-violet-300">24h</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-black/30 border border-white/6 space-y-1">
              <p className="text-zinc-400">Précision des tirs ({homeName})</p>
              <p className="font-mono text-base font-bold text-white tabular-nums">{homeAcc}%</p>
            </div>
            <div className="p-3 rounded-xl bg-black/30 border border-white/6 space-y-1">
              <p className="text-zinc-400">Précision des tirs ({awayName})</p>
              <p className="font-mono text-base font-bold text-white tabular-nums">{awayAcc}%</p>
            </div>
            <div className="p-3 rounded-xl bg-black/30 border border-white/6 space-y-1">
              <p className="text-zinc-400">Domination territoriale</p>
              <p className="font-medium text-violet-200">
                {poss
                  ? poss.homeNumeric >= poss.awayNumeric
                    ? `${homeName} (${poss.homeValue})`
                    : `${awayName} (${poss.awayValue})`
                  : 'Équilibrée'}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-black/30 border border-white/6 space-y-1">
              <p className="text-zinc-400">Pression sur coups de pied arrêtés</p>
              <p className="font-mono font-medium text-white tabular-nums">
                {corners ? `${corners.homeValue} vs ${corners.awayValue} corners` : '—'}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-[#151520] border border-violet-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-400" />
              Analyse Tactique Bonus
            </p>
            <p className="text-xs text-zinc-400">
              {isOnline
                ? 'Regardez une courte vidéo récompensée pour calculer la précision des tirs et la domination territoriale (valable 24h).'
                : 'Connexion Internet requise pour charger la vidéo récompensée. Les statistiques principales restent disponibles.'}
            </p>
          </div>
          <button
            type="button"
            disabled={!isOnline}
            onClick={onRequestUnlock}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-45 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-colors"
          >
            <PlayCircle className="w-4 h-4" />
            Débloquer (Vidéo)
          </button>
        </div>
      )}
    </div>
  );
};
