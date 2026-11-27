import React, { useMemo, useState } from 'react';
import { Search, Star, Shield, RefreshCw, ArrowLeft, MapPin } from 'lucide-react';
import {
  extractTeamsFromMatches,
  type FavoriteClub,
  type MatchItem,
  type PlayerProfileInfo,
  type TeamDirectoryEntry,
  type TeamRef,
} from '../lib/football';
import { fetchTeamDetailApi } from '../lib/apiClient';
import { ClubLogo } from './ClubLogo';
import { MatchCard } from './MatchCard';

interface TeamsDirectoryViewProps {
  matches: MatchItem[];
  favoriteClubs: FavoriteClub[];
  isFavoriteClub: (teamId: string) => boolean;
  onToggleFavoriteClub: (team: TeamRef, match: MatchItem) => void;
  onSelectMatch: (match: MatchItem) => void;
  onSelectPlayer: (player: PlayerProfileInfo) => void;
}

export const TeamsDirectoryView: React.FC<TeamsDirectoryViewProps> = ({
  matches,
  favoriteClubs,
  isFavoriteClub,
  onToggleFavoriteClub,
  onSelectMatch,
  onSelectPlayer,
}) => {
  const [search, setSearch] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<TeamDirectoryEntry | null>(null);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamInfo, setTeamInfo] = useState<{
    team: { id: string; name: string; logo?: string; venue?: string; country?: string };
    players: PlayerProfileInfo[];
    matches: MatchItem[];
  } | null>(null);

  const directoryTeams = useMemo(() => {
    const map = new Map<string, TeamDirectoryEntry>();
    for (const fc of favoriteClubs) {
      map.set(fc.id, {
        id: fc.id,
        name: fc.name,
        shortName: fc.name,
        abbreviation: fc.name.slice(0, 3).toUpperCase(),
        logo: fc.logo,
        competitionId: fc.competitionId,
        competitionName: fc.competitionName,
        country: 'Favori',
      });
    }
    for (const t of extractTeamsFromMatches(matches)) {
      if (!map.has(t.id)) {
        map.set(t.id, t);
      }
    }
    const q = search.trim().toLowerCase();
    return Array.from(map.values())
      .filter((t) => {
        if (!q) return true;
        return `${t.name} ${t.competitionName} ${t.country}`.toLowerCase().includes(q);
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, [matches, favoriteClubs, search]);

  const openTeamProfile = async (entry: TeamDirectoryEntry) => {
    setSelectedTeam(entry);
    setTeamLoading(true);
    try {
      const detail = await fetchTeamDetailApi(entry.competitionId, entry.id);
      setTeamInfo(detail);
    } catch {
      setTeamInfo({
        team: { id: entry.id, name: entry.name, logo: entry.logo, venue: entry.venue, country: entry.country },
        players: [],
        matches: matches.filter((m) => m.home.id === entry.id || m.away.id === entry.id),
      });
    } finally {
      setTeamLoading(false);
    }
  };

  if (selectedTeam) {
    const teamDisplay = teamInfo?.team || selectedTeam;
    const isFav = isFavoriteClub(selectedTeam.id);
    const dummyMatch: MatchItem = teamInfo?.matches[0] || {
      id: `team-${selectedTeam.id}`,
      competitionId: selectedTeam.competitionId,
      competitionName: selectedTeam.competitionName,
      country: selectedTeam.country,
      dateIso: new Date().toISOString(),
      status: 'upcoming',
      statusText: 'À venir',
      minuteDisplay: '',
      isExtraTime: false,
      isPenalties: false,
      home: {
        id: selectedTeam.id,
        name: selectedTeam.name,
        shortName: selectedTeam.shortName,
        abbreviation: selectedTeam.abbreviation,
        logo: selectedTeam.logo,
        score: null,
      },
      away: {
        id: selectedTeam.id,
        name: selectedTeam.name,
        shortName: selectedTeam.shortName,
        abbreviation: selectedTeam.abbreviation,
        logo: selectedTeam.logo,
        score: null,
      },
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSelectedTeam(null)}
              aria-label="Retour aux équipes"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-[#12121A] border border-white/10 text-zinc-200 hover:border-violet-500/40"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <ClubLogo src={teamDisplay.logo || selectedTeam.logo} name={teamDisplay.name} size="md" />
            <div className="min-w-0">
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-white truncate">
                {teamDisplay.name}
              </h2>
              <p className="text-xs text-zinc-400 flex items-center gap-2 truncate">
                <span>{selectedTeam.competitionName}</span>
                {teamDisplay.venue && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 truncate">
                      <MapPin className="w-3 h-3" />
                      {teamDisplay.venue}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              onToggleFavoriteClub(
                {
                  id: selectedTeam.id,
                  name: selectedTeam.name,
                  shortName: selectedTeam.shortName,
                  abbreviation: selectedTeam.abbreviation,
                  logo: selectedTeam.logo,
                  score: null,
                },
                dummyMatch
              )
            }
            className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-medium inline-flex items-center gap-2 transition-colors ${
              isFav
                ? 'bg-violet-600 text-white'
                : 'bg-[#12121A] border border-white/10 text-zinc-200 hover:border-violet-500/40'
            }`}
          >
            <Star className={`w-4 h-4 ${isFav ? 'fill-white' : ''}`} />
            {isFav ? 'Club suivi' : 'Suivre ce club'}
          </button>
        </div>

        {teamLoading ? (
          <div className="py-14 flex flex-col items-center justify-center gap-3 text-zinc-400">
            <RefreshCw className="w-6 h-6 animate-spin text-violet-400" />
            <p className="text-sm">Chargement de l&apos;effectif et des matchs du club...</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Effectif officiel */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-zinc-300">
                Effectif officiel ({teamInfo?.players.length || 0})
              </h3>
              {!teamInfo || teamInfo.players.length === 0 ? (
                <p className="text-xs text-zinc-400 p-4 rounded-2xl bg-[#12121A] border border-white/8">
                  Effectif détaillé non transmis par le fournisseur pour ce club actuellement. Consultez les compositions dans les fiches matchs.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {teamInfo.players.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onSelectPlayer(p)}
                      className="p-3 rounded-xl bg-[#12121A] border border-white/8 hover:border-violet-500/40 text-left flex items-center justify-between gap-2 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{p.name}</p>
                        <p className="text-xs text-zinc-400 truncate">
                          {p.position || 'Joueur'} {p.nationality ? `· ${p.nationality}` : ''}
                        </p>
                      </div>
                      {p.jersey && (
                        <span className="font-mono text-xs font-bold text-violet-300 shrink-0 tabular-nums">
                          #{p.jersey}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* Calendrier / Résultats du club */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-zinc-300">
                Rencontres récentes &amp; à venir ({teamInfo?.matches.length || 0})
              </h3>
              {!teamInfo || teamInfo.matches.length === 0 ? (
                <p className="text-xs text-zinc-400">Aucune rencontre récente trouvée.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {teamInfo.matches.slice(0, 12).map((m) => (
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
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Équipes &amp; Clubs
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
            Consultez les fiches clubs, effectifs officiels et calendriers sans quitter l&apos;application.
          </p>
        </div>
        <span className="text-xs font-mono text-zinc-400 tabular-nums">
          {directoryTeams.length} clubs indexés
        </span>
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un club (Real Madrid, PSG, Al Hilal...)"
          aria-label="Rechercher une équipe"
          className="w-full min-h-[44px] pl-10 pr-4 rounded-xl bg-[#12121A] border border-white/10 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-violet-500"
        />
      </div>

      {directoryTeams.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[#12121A] border border-white/8 text-center space-y-2">
          <Shield className="w-8 h-8 text-violet-400 mx-auto" />
          <p className="text-sm text-zinc-300">Aucun club correspondant à votre recherche.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {directoryTeams.slice(0, 60).map((team) => {
            const fav = isFavoriteClub(team.id);
            return (
              <div
                key={team.id}
                className="rounded-2xl bg-[#12121A] border border-white/8 hover:border-violet-500/40 p-4 flex items-center justify-between gap-3 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => openTeamProfile(team)}
                  className="flex-1 text-left flex items-center gap-3 min-w-0"
                >
                  <ClubLogo src={team.logo} name={team.name} abbreviation={team.abbreviation} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{team.name}</p>
                    <p className="text-xs text-zinc-400 truncate">
                      {team.competitionName} · {team.country}
                    </p>
                  </div>
                </button>
                <span className="text-xs text-violet-300 shrink-0 font-medium">
                  {fav ? 'Suivi' : 'Voir'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
