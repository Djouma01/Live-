import React, { useEffect, useRef, useState } from 'react';
import { Star, ChevronRight } from 'lucide-react';
import {
  detectScoreChangeSides,
  formatLocalTimeFr,
  type MatchItem,
  type TeamRef,
} from '../lib/football';
import { ClubLogo } from './ClubLogo';

interface MatchCardProps {
  match: MatchItem;
  isFavoriteClub: (teamId: string) => boolean;
  onToggleFavoriteClub: (team: TeamRef, match: MatchItem) => void;
  onSelectMatch: (match: MatchItem) => void;
}

export const MatchCard: React.FC<MatchCardProps> = ({
  match,
  isFavoriteClub,
  onToggleFavoriteClub,
  onSelectMatch,
}) => {
  const isLive = match.status === 'live';
  const isFinished = match.status === 'finished';
  const isUpcoming = match.status === 'upcoming';
  const homeFav = isFavoriteClub(match.home.id);
  const awayFav = isFavoriteClub(match.away.id);
  const anyFav = homeFav || awayFav;

  const [flashHome, setFlashHome] = useState(false);
  const [flashAway, setFlashAway] = useState(false);

  const prevSnapshotRef = useRef<{
    matchId: string;
    homeScore: number | null;
    awayScore: number | null;
  }>({
    matchId: match.id,
    homeScore: match.home.score,
    awayScore: match.away.score,
  });
  const homeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const awayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const prev = prevSnapshotRef.current;

    if (prev.matchId !== match.id) {
      prevSnapshotRef.current = {
        matchId: match.id,
        homeScore: match.home.score,
        awayScore: match.away.score,
      };
      setFlashHome(false);
      setFlashAway(false);
      return;
    }

    const { homeChanged, awayChanged } = detectScoreChangeSides(
      prev.homeScore,
      prev.awayScore,
      match.home.score,
      match.away.score
    );

    prevSnapshotRef.current = {
      matchId: match.id,
      homeScore: match.home.score,
      awayScore: match.away.score,
    };

    if (homeChanged) {
      setFlashHome(true);
      if (homeTimerRef.current) clearTimeout(homeTimerRef.current);
      homeTimerRef.current = setTimeout(() => setFlashHome(false), 3500);
    }

    if (awayChanged) {
      setFlashAway(true);
      if (awayTimerRef.current) clearTimeout(awayTimerRef.current);
      awayTimerRef.current = setTimeout(() => setFlashAway(false), 3500);
    }
  }, [match.id, match.home.score, match.away.score]);

  useEffect(() => {
    return () => {
      if (homeTimerRef.current) clearTimeout(homeTimerRef.current);
      if (awayTimerRef.current) clearTimeout(awayTimerRef.current);
    };
  }, []);

  const anyFlash = flashHome || flashAway;
  const flashState =
    flashHome && flashAway ? 'both' : flashHome ? 'home' : flashAway ? 'away' : 'none';

  const kickoffTime = formatLocalTimeFr(match.dateIso);

  return (
    <article
      data-goal-flash={flashState}
      className={`group rounded-2xl bg-[#12121A] border transition-colors duration-200 ${
        anyFlash
          ? 'border-emerald-400/75 shadow-lg shadow-emerald-500/15'
          : isLive
          ? 'border-violet-500/45 shadow-sm shadow-violet-950/30'
          : 'border-white/8 hover:border-violet-500/35'
      }`}
    >
      {/* Card Header: Unboxed metadata + Favorite button */}
      <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2 border-b border-white/6">
        <div className="flex items-center gap-2 min-w-0 text-xs text-zinc-400">
          <span className="truncate font-medium text-zinc-300">{match.competitionName}</span>
          <span aria-hidden="true">·</span>
          <span className="shrink-0">{match.country}</span>
          {isLive && (
            <>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1.5 font-mono font-bold text-violet-400 whitespace-nowrap shrink-0">
                <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" aria-hidden="true" />
                {match.minuteDisplay || 'Direct'}
              </span>
            </>
          )}
          {anyFlash && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono font-bold text-emerald-300 whitespace-nowrap shrink-0">
                BUT !
              </span>
            </>
          )}
          {isFinished && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-zinc-400 font-medium whitespace-nowrap shrink-0">
                {match.statusText}
              </span>
            </>
          )}
          {isUpcoming && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-violet-300 font-medium whitespace-nowrap shrink-0">
                {kickoffTime}
              </span>
            </>
          )}
          {match.status === 'postponed' && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-amber-400 font-medium whitespace-nowrap shrink-0">Reporté</span>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => onToggleFavoriteClub(homeFav ? match.home : match.away.id === match.home.id ? match.home : match.home, match)}
          aria-label={anyFav ? `Retirer ${match.home.name} des favoris` : `Ajouter ${match.home.name} aux favoris`}
          aria-pressed={anyFav}
          className={`min-h-[44px] min-w-[44px] -my-2 -mr-2 flex items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
            anyFav ? 'text-violet-400 hover:text-violet-300' : 'text-zinc-500 hover:text-zinc-200'
          }`}
        >
          <Star className={`w-4 h-4 ${anyFav ? 'fill-violet-400' : ''}`} />
        </button>
      </div>

      {/* Main clickable match score body */}
      <button
        type="button"
        onClick={() => onSelectMatch(match)}
        aria-label={`Ouvrir le match ${match.home.name} contre ${match.away.name}`}
        className="w-full text-left px-4 py-3.5 flex items-center justify-between gap-3 rounded-b-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
      >
        <div className="flex-1 min-w-0 space-y-2.5">
          {/* Home Row */}
          <div
            className={`flex items-center justify-between gap-3 transition-colors duration-200 ${
              flashHome ? 'bg-emerald-500/12 rounded-xl px-2 py-0.5 -mx-2' : ''
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <ClubLogo src={match.home.logo} name={match.home.name} abbreviation={match.home.abbreviation} size="sm" />
              <span
                className={`text-sm sm:text-base truncate ${
                  flashHome
                    ? 'font-bold text-emerald-200'
                    : match.home.winner
                    ? 'font-bold text-white'
                    : 'font-medium text-zinc-100'
                }`}
              >
                {match.home.name}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 font-mono tabular-nums">
              {match.home.score !== null ? (
                <span
                  data-testid="match-home-score"
                  data-flashing={flashHome ? 'true' : 'false'}
                  className={`text-lg sm:text-xl font-bold min-w-[1.75rem] text-center transition-colors ${
                    flashHome
                      ? 'animate-goal-flash text-emerald-200 bg-emerald-500/25 border border-emerald-400/70 rounded-lg px-2 py-0.5'
                      : isLive
                      ? 'text-violet-300 text-right'
                      : match.home.winner
                      ? 'text-white text-right'
                      : 'text-zinc-300 text-right'
                  }`}
                >
                  {match.home.score}
                </span>
              ) : (
                <span className="text-sm text-zinc-600 w-7 text-right">-</span>
              )}
              {match.isPenalties && match.home.penaltyScore !== null && match.home.penaltyScore !== undefined && (
                <span className="text-xs text-violet-400">({match.home.penaltyScore})</span>
              )}
            </div>
          </div>

          {/* Away Row */}
          <div
            className={`flex items-center justify-between gap-3 transition-colors duration-200 ${
              flashAway ? 'bg-emerald-500/12 rounded-xl px-2 py-0.5 -mx-2' : ''
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <ClubLogo src={match.away.logo} name={match.away.name} abbreviation={match.away.abbreviation} size="sm" />
              <span
                className={`text-sm sm:text-base truncate ${
                  flashAway
                    ? 'font-bold text-emerald-200'
                    : match.away.winner
                    ? 'font-bold text-white'
                    : 'font-medium text-zinc-100'
                }`}
              >
                {match.away.name}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 font-mono tabular-nums">
              {match.away.score !== null ? (
                <span
                  data-testid="match-away-score"
                  data-flashing={flashAway ? 'true' : 'false'}
                  className={`text-lg sm:text-xl font-bold min-w-[1.75rem] text-center transition-colors ${
                    flashAway
                      ? 'animate-goal-flash text-emerald-200 bg-emerald-500/25 border border-emerald-400/70 rounded-lg px-2 py-0.5'
                      : isLive
                      ? 'text-violet-300 text-right'
                      : match.away.winner
                      ? 'text-white text-right'
                      : 'text-zinc-300 text-right'
                  }`}
                >
                  {match.away.score}
                </span>
              ) : (
                <span className="text-sm text-zinc-600 w-7 text-right">-</span>
              )}
              {match.isPenalties && match.away.penaltyScore !== null && match.away.penaltyScore !== undefined && (
                <span className="text-xs text-violet-400">({match.away.penaltyScore})</span>
              )}
            </div>
          </div>
        </div>

        <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-violet-400 transition-colors shrink-0" aria-hidden="true" />
      </button>
    </article>
  );
};
