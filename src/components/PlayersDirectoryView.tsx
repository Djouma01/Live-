import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, User, RefreshCw, ArrowLeft, Info } from 'lucide-react';
import {
  extractTeamsFromMatches,
  type MatchItem,
  type PlayerProfileInfo,
} from '../lib/football';
import { fetchPlayerProfileApi, fetchTeamDetailApi } from '../lib/apiClient';
import { mergePlayerProfiles } from '../lib/playerStats';
import { PlayerSeasonStatsModal } from './PlayerSeasonStatsModal';

interface PlayersDirectoryViewProps {
  matches: MatchItem[];
  initialSelectedPlayer?: PlayerProfileInfo | null;
  onClearInitialPlayer?: () => void;
}

export const PlayersDirectoryView: React.FC<PlayersDirectoryViewProps> = ({
  matches,
  initialSelectedPlayer = null,
  onClearInitialPlayer,
}) => {
  const [search, setSearch] = useState('');
  const [players, setPlayers] = useState<PlayerProfileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerProfileInfo | null>(initialSelectedPlayer);
  const [profileLoading, setProfileLoading] = useState(false);

  const [statsModalPlayer, setStatsModalPlayer] = useState<PlayerProfileInfo | null>(null);
  const [statsModalLoading, setStatsModalLoading] = useState(false);
  const modalRequestSeqRef = useRef(0);

  useEffect(() => {
    if (initialSelectedPlayer) {
      setSelectedPlayer(initialSelectedPlayer);
    }
  }, [initialSelectedPlayer]);

  const topTeams = useMemo(() => extractTeamsFromMatches(matches).slice(0, 6), [matches]);

  useEffect(() => {
    let cancelled = false;
    const loadSampleRosters = async () => {
      if (topTeams.length === 0) return;
      setLoading(true);
      try {
        const settled = await Promise.allSettled(
          topTeams.map((t) => fetchTeamDetailApi(t.competitionId, t.id))
        );
        if (cancelled) return;
        const map = new Map<string, PlayerProfileInfo>();
        for (const res of settled) {
          if (res.status === 'fulfilled' && Array.isArray(res.value.players)) {
            for (const p of res.value.players) {
              if (!map.has(p.id)) {
                map.set(p.id, p);
              }
            }
          }
        }
        setPlayers(Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'fr')));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadSampleRosters();
    return () => {
      cancelled = true;
    };
  }, [topTeams]);

  const openPlayer = async (p: PlayerProfileInfo) => {
    setSelectedPlayer(p);
    onClearInitialPlayer?.();
    setProfileLoading(true);
    try {
      const full = await fetchPlayerProfileApi(p.id, p.competitionId);
      if (full) setSelectedPlayer(mergePlayerProfiles(p, full));
    } finally {
      setProfileLoading(false);
    }
  };

  const openStatsModal = async (p: PlayerProfileInfo) => {
    const seq = ++modalRequestSeqRef.current;
    setStatsModalPlayer(p);
    setStatsModalLoading(true);
    try {
      const full = await fetchPlayerProfileApi(p.id, p.competitionId);
      if (modalRequestSeqRef.current !== seq) return;
      if (full) {
        setStatsModalPlayer((curr) => (curr && curr.id === p.id ? mergePlayerProfiles(curr, full) : curr));
      }
    } finally {
      if (modalRequestSeqRef.current === seq) {
        setStatsModalLoading(false);
      }
    }
  };

  const closeStatsModal = () => {
    modalRequestSeqRef.current += 1;
    setStatsModalPlayer(null);
    setStatsModalLoading(false);
  };

  const filteredPlayers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return players;
    return players.filter((p) =>
      `${p.name} ${p.teamName} ${p.position || ''} ${p.nationality || ''}`.toLowerCase().includes(q)
    );
  }, [players, search]);

  if (selectedPlayer) {
    const st = selectedPlayer.stats;
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => {
                setSelectedPlayer(null);
                onClearInitialPlayer?.();
              }}
              aria-label="Retour à la liste des joueurs"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-[#12121A] border border-white/10 text-zinc-200 hover:border-violet-500/40 shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-white truncate">
                {selectedPlayer.name}
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400">
                {selectedPlayer.teamName || 'Club officiel'}
                {selectedPlayer.position ? ` · ${selectedPlayer.position}` : ''}
                {selectedPlayer.jersey ? ` · #${selectedPlayer.jersey}` : ''}
                {selectedPlayer.nationality ? ` · ${selectedPlayer.nationality}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => openStatsModal(selectedPlayer)}
            aria-label={`Statistiques saisonnières de ${selectedPlayer.name}`}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#12121A] border border-white/10 hover:border-violet-500/40 text-xs sm:text-sm font-medium text-zinc-200 hover:text-white inline-flex items-center gap-2 shrink-0 transition-colors"
          >
            <Info className="w-4 h-4 text-violet-400" aria-hidden="true" />
            <span className="hidden sm:inline">Détails saison</span>
          </button>
        </div>

        {profileLoading ? (
          <div className="py-10 flex flex-col items-center gap-3 text-zinc-400">
            <RefreshCw className="w-6 h-6 animate-spin text-violet-400" />
            <p className="text-sm">Chargement de la fiche joueur...</p>
          </div>
        ) : st ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {typeof st.appearances === 'number' && (
              <div className="p-4 rounded-2xl bg-[#12121A] border border-white/8">
                <p className="text-xs text-zinc-400">Matchs joués</p>
                <p className="text-2xl font-display font-bold text-white tabular-nums mt-1">{st.appearances}</p>
              </div>
            )}
            {typeof st.goals === 'number' && (
              <div className="p-4 rounded-2xl bg-[#12121A] border border-white/8">
                <p className="text-xs text-zinc-400">Buts</p>
                <p className="text-2xl font-display font-bold text-violet-300 tabular-nums mt-1">{st.goals}</p>
              </div>
            )}
            {typeof st.assists === 'number' && (
              <div className="p-4 rounded-2xl bg-[#12121A] border border-white/8">
                <p className="text-xs text-zinc-400">Passes décisives</p>
                <p className="text-2xl font-display font-bold text-white tabular-nums mt-1">{st.assists}</p>
              </div>
            )}
            {typeof st.minutesPlayed === 'number' && (
              <div className="p-4 rounded-2xl bg-[#12121A] border border-white/8">
                <p className="text-xs text-zinc-400">Minutes jouées</p>
                <p className="text-2xl font-display font-bold text-white tabular-nums mt-1">{st.minutesPlayed}&apos;</p>
              </div>
            )}
          </div>
        ) : (
          <div className="p-5 rounded-2xl bg-[#12121A] border border-white/8 text-sm text-zinc-300 space-y-2">
            <p className="font-semibold text-white">Statistiques individuelles officielles</p>
            <p className="text-xs text-zinc-400">
              Aucune statistique individuelle cumulée supplémentaire n&apos;a été transmise par la source pour ce joueur sur cette fiche. Consultez ses statistiques par match dans l&apos;onglet « Statistiques » de chaque rencontre.
            </p>
          </div>
        )}

        {statsModalPlayer && (
          <PlayerSeasonStatsModal
            player={statsModalPlayer}
            loading={statsModalLoading}
            onClose={closeStatsModal}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Joueurs &amp; Effectifs
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
            Effectifs officiels issus des clubs en lice. Cliquez sur l&apos;icône Info pour consulter les statistiques saisonnières détaillées.
          </p>
        </div>
        <span className="text-xs font-mono text-zinc-400 tabular-nums">
          {filteredPlayers.length} joueurs chargés
        </span>
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un joueur, poste ou club..."
          aria-label="Rechercher un joueur"
          className="w-full min-h-[44px] pl-10 pr-4 rounded-xl bg-[#12121A] border border-white/10 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-violet-500"
        />
      </div>

      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-3 text-zinc-400">
          <RefreshCw className="w-6 h-6 animate-spin text-violet-400" />
          <p className="text-sm">Chargement des effectifs officiels des matchs du jour...</p>
        </div>
      ) : filteredPlayers.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[#12121A] border border-white/8 text-center space-y-2">
          <User className="w-8 h-8 text-violet-400 mx-auto" />
          <p className="text-sm text-zinc-300">
            Aucun joueur trouvé. Ouvrez un club dans la rubrique « Équipes » ou sélectionnez une date avec des matchs actifs.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredPlayers.slice(0, 60).map((p) => (
            <div
              key={`${p.id}-${p.teamId}`}
              className="rounded-2xl bg-[#12121A] border border-white/8 hover:border-violet-500/40 p-4 flex items-center justify-between gap-2 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => openPlayer(p)}
                    className="text-sm font-semibold text-white hover:text-violet-300 truncate text-left transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                  >
                    {p.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => openStatsModal(p)}
                    aria-label={`Statistiques saisonnières de ${p.name}`}
                    title={`Statistiques saisonnières de ${p.name}`}
                    data-testid={`player-info-btn-${p.id}`}
                    className="shrink-0 min-h-[36px] min-w-[36px] -my-1.5 flex items-center justify-center rounded-lg text-zinc-400 hover:text-violet-300 hover:bg-violet-500/15 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                  >
                    <Info className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
                <p className="text-xs text-zinc-400 truncate mt-0.5">
                  {p.teamName} {p.position ? `· ${p.position}` : ''}
                </p>
              </div>
              {p.jersey && (
                <span className="font-mono text-xs font-bold text-violet-300 shrink-0 tabular-nums">
                  #{p.jersey}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {statsModalPlayer && (
        <PlayerSeasonStatsModal
          player={statsModalPlayer}
          loading={statsModalLoading}
          onClose={closeStatsModal}
        />
      )}
    </div>
  );
};
