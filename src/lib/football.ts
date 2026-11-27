export type MatchStatus = 'live' | 'upcoming' | 'finished' | 'postponed';

export type CompetitionCategory =
  | 'europe'
  | 'cups'
  | 'saudi'
  | 'usa'
  | 'brazil'
  | 'russia'
  | 'africa'
  | 'international'
  | 'other';

export interface CompetitionInfo {
  id: string;
  name: string;
  shortName: string;
  country: string;
  countryCode?: string;
  region?: 'europe' | 'middle_east' | 'americas' | 'africa' | 'international';
  category: CompetitionCategory;
  divisionLevel?: number;
  divisionLabel?: string;
  source?: 'sportradar' | 'espn' | 'api-football';
  currentSeasonId?: string;
  available: boolean;
  hasStandings: boolean;
  providerNote?: string;
  logo?: string;
}

export interface TeamRef {
  id: string;
  name: string;
  shortName: string;
  abbreviation: string;
  logo: string;
  score: number | null;
  penaltyScore?: number | null;
  winner?: boolean;
  form?: string;
}

export interface MatchItem {
  id: string;
  competitionId: string;
  competitionName: string;
  country: string;
  divisionLabel?: string;
  dateIso: string;
  status: MatchStatus;
  statusText: string;
  minuteDisplay: string;
  isExtraTime: boolean;
  isPenalties: boolean;
  venue?: string;
  home: TeamRef;
  away: TeamRef;
  sourceProvider?: 'sportradar' | 'espn' | 'api-football';
  summaryCounters?: {
    redCards: number;
    yellowCards: number;
    substitutions: number;
  };
}

export type MatchEventType =
  | 'goal'
  | 'own-goal'
  | 'penalty-goal'
  | 'penalty-missed'
  | 'yellow-card'
  | 'red-card'
  | 'substitution'
  | 'kickoff'
  | 'halftime'
  | 'second-half'
  | 'fulltime'
  | 'other';

export interface MatchEvent {
  id: string;
  type: MatchEventType;
  minute: string;
  period: number;
  teamId: string;
  teamName: string;
  isHome?: boolean;
  player: string;
  assistOrOut?: string;
  description: string;
}

export interface StatPair {
  key: string;
  label: string;
  homeValue: string;
  awayValue: string;
  homeNumeric: number;
  awayNumeric: number;
}

export interface LineupPlayer {
  id: string;
  name: string;
  jersey: string;
  position: string;
  starter: boolean;
  subbedIn: boolean;
  subbedOut: boolean;
}

export interface PlayerMatchStat {
  playerId: string;
  name: string;
  teamId: string;
  teamName: string;
  position?: string;
  jersey?: string;
  minutesPlayed?: number;
  goals?: number;
  assists?: number;
  shots?: number;
  shotsOnTarget?: number;
  yellowCards?: number;
  redCards?: number;
  saves?: number;
}

export interface PlayerSeasonSplit {
  id: string;
  seasonName: string;
  teamName?: string;
  leagueSlug?: string;
  appearances?: number;
  starts?: number;
  minutesPlayed?: number;
  goals?: number;
  assists?: number;
  shots?: number;
  shotsOnTarget?: number;
  foulsCommitted?: number;
  foulsSuffered?: number;
  offsides?: number;
  yellowCards?: number;
  redCards?: number;
  saves?: number;
  cleanSheets?: number;
  goalsConceded?: number;
}

export interface PlayerProfileInfo {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  competitionId?: string;
  competitionName?: string;
  nationality?: string;
  position?: string;
  jersey?: string;
  age?: number;
  height?: string;
  weight?: string;
  seasonLabel?: string;
  source: 'sportradar' | 'espn';
  stats?: {
    appearances?: number;
    starts?: number;
    subIns?: number;
    goals?: number;
    assists?: number;
    minutesPlayed?: number;
    yellowCards?: number;
    redCards?: number;
    shots?: number;
    shotsOnTarget?: number;
    foulsCommitted?: number;
    foulsSuffered?: number;
    offsides?: number;
    ownGoals?: number;
    saves?: number;
    cleanSheets?: number;
    goalsConceded?: number;
  };
  seasonSplits?: PlayerSeasonSplit[];
}

export interface TeamDirectoryEntry {
  id: string;
  name: string;
  shortName: string;
  abbreviation: string;
  logo: string;
  competitionId: string;
  competitionName: string;
  country: string;
  venue?: string;
}

export interface TeamLineup {
  teamId: string;
  teamName: string;
  formation: string;
  starters: LineupPlayer[];
  substitutes: LineupPlayer[];
}

export interface H2HMatchRecord {
  id: string;
  dateIso: string;
  competitionName: string;
  homeTeamId?: string;
  awayTeamId?: string;
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  winnerSide: 'home' | 'away' | 'draw';
}

export interface HeadToHeadSummary {
  homeWins: number;
  draws: number;
  awayWins: number;
  homeGoals?: number;
  awayGoals?: number;
  matches: H2HMatchRecord[];
}

export interface MatchDetailResponse {
  match: MatchItem;
  events: MatchEvent[];
  statistics: StatPair[];
  lineups: {
    home: TeamLineup | null;
    away: TeamLineup | null;
  };
  playerStats?: PlayerMatchStat[];
  h2h: HeadToHeadSummary;
  provider: string;
  lastRealUpdateIso?: string;
}

export interface StandingRow {
  rank: number;
  teamId: string;
  teamName: string;
  teamLogo: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  note?: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  imageUrl: string;
  publishedAt: string;
  source: string;
  url: string;
  league?: string;
}

export interface FavoriteClub {
  id: string;
  name: string;
  logo: string;
  competitionId: string;
  competitionName: string;
}

export interface FavoritesState {
  clubs: FavoriteClub[];
  competitions: string[];
}

export interface NotificationPrefs {
  enabled: boolean;
  kickoff: boolean;
  goals: boolean;
  redCards: boolean;
  halftimeFulltime: boolean;
}

export interface ClubNotificationPrefs {
  customized: boolean;
  goals: boolean;
  cards: boolean;
  substitutions: boolean;
  finalResult: boolean;
}

export type ClubNotificationPrefsMap = Record<string, ClubNotificationPrefs>;

export interface LiveAlertNotification {
  id: string;
  matchId: string;
  kind: 'kickoff' | 'goal' | 'red-card' | 'yellow-card' | 'substitution' | 'halftime' | 'fulltime';
  title: string;
  body: string;
  timestamp: string;
}

export interface CountryGroupInfo {
  country: string;
  region: string;
  competitions: CompetitionInfo[];
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  enabled: true,
  kickoff: true,
  goals: true,
  redCards: true,
  halftimeFulltime: true,
};

export function getDefaultClubNotificationPrefs(globalPrefs: NotificationPrefs): ClubNotificationPrefs {
  return {
    customized: false,
    goals: globalPrefs.goals,
    cards: globalPrefs.redCards,
    substitutions: false,
    finalResult: globalPrefs.halftimeFulltime,
  };
}

export function getEffectiveClubNotificationPrefs(
  clubId: string,
  globalPrefs: NotificationPrefs,
  clubPrefsMap: ClubNotificationPrefsMap = {}
): ClubNotificationPrefs {
  const custom = clubPrefsMap[clubId];
  if (custom && custom.customized) {
    return custom;
  }
  return getDefaultClubNotificationPrefs(globalPrefs);
}

export function groupMatchesByStatus(matches: MatchItem[]): {
  live: MatchItem[];
  upcoming: MatchItem[];
  finished: MatchItem[];
} {
  const live: MatchItem[] = [];
  const upcoming: MatchItem[] = [];
  const finished: MatchItem[] = [];

  for (const m of matches) {
    if (m.status === 'live') {
      live.push(m);
    } else if (m.status === 'finished') {
      finished.push(m);
    } else {
      upcoming.push(m);
    }
  }

  live.sort((a, b) => parseMinuteNumber(b.minuteDisplay) - parseMinuteNumber(a.minuteDisplay));
  upcoming.sort((a, b) => new Date(a.dateIso).getTime() - new Date(b.dateIso).getTime());
  finished.sort((a, b) => new Date(b.dateIso).getTime() - new Date(a.dateIso).getTime());

  return { live, upcoming, finished };
}

export function parseMinuteNumber(minuteDisplay: string): number {
  const m = minuteDisplay.match(/\d+/);
  return m ? Number.parseInt(m[0], 10) : 0;
}

export function filterMatches(
  matches: MatchItem[],
  opts: { competitionId?: string; country?: string; search?: string }
): MatchItem[] {
  const comp = opts.competitionId?.trim() || 'all';
  const country = opts.country?.trim() || 'all';
  const query = opts.search?.trim().toLowerCase() || '';

  return matches.filter((m) => {
    if (comp !== 'all' && m.competitionId !== comp) return false;
    if (country !== 'all' && m.country !== country) return false;
    if (query) {
      const haystack = `${m.home.name} ${m.away.name} ${m.competitionName} ${m.country}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

export function groupCompetitionsByCountryAndDivision(
  competitions: CompetitionInfo[]
): CountryGroupInfo[] {
  const byCountry = new Map<string, { region: string; competitions: CompetitionInfo[] }>();
  for (const c of competitions) {
    if (!c.available) continue;
    const key = c.country || 'International';
    const existing = byCountry.get(key) || {
      region: c.region || (c.category === 'europe' || c.category === 'cups' ? 'europe' : 'international'),
      competitions: [],
    };
    existing.competitions.push(c);
    byCountry.set(key, existing);
  }

  const groups: CountryGroupInfo[] = Array.from(byCountry.entries()).map(([country, info]) => ({
    country,
    region: info.region,
    competitions: [...info.competitions].sort(
      (a, b) => (a.divisionLevel ?? 99) - (b.divisionLevel ?? 99) || a.name.localeCompare(b.name, 'fr')
    ),
  }));

  const priorityCountries = [
    'Angleterre',
    'Espagne',
    'Allemagne',
    'Italie',
    'France',
    'Europe',
    'Arabie saoudite',
    'États-Unis',
    'Brésil',
    'Russie',
    'Mali',
    'Afrique',
    'International',
  ];

  groups.sort((a, b) => {
    const ia = priorityCountries.indexOf(a.country);
    const ib = priorityCountries.indexOf(b.country);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.country.localeCompare(b.country, 'fr');
  });

  return groups;
}

export function computeMatchesDataSignature(matches: MatchItem[]): string {
  return matches
    .map(
      (m) =>
        `${m.id}:${m.status}:${m.minuteDisplay}:${m.home.score ?? '-'}-${m.away.score ?? '-'}:${
          m.summaryCounters?.yellowCards ?? 0
        }-${m.summaryCounters?.redCards ?? 0}-${m.summaryCounters?.substitutions ?? 0}`
    )
    .sort()
    .join('|');
}

export function detectScoreChangeSides(
  prevHomeScore: number | null,
  prevAwayScore: number | null,
  nextHomeScore: number | null,
  nextAwayScore: number | null
): { homeChanged: boolean; awayChanged: boolean } {
  const homeChanged =
    prevHomeScore !== null && nextHomeScore !== null && nextHomeScore !== prevHomeScore;
  const awayChanged =
    prevAwayScore !== null && nextAwayScore !== null && nextAwayScore !== prevAwayScore;
  return { homeChanged, awayChanged };
}

export function extractTeamsFromMatches(matches: MatchItem[]): TeamDirectoryEntry[] {
  const map = new Map<string, TeamDirectoryEntry>();
  for (const m of matches) {
    if (!map.has(m.home.id)) {
      map.set(m.home.id, {
        id: m.home.id,
        name: m.home.name,
        shortName: m.home.shortName,
        abbreviation: m.home.abbreviation,
        logo: m.home.logo,
        competitionId: m.competitionId,
        competitionName: m.competitionName,
        country: m.country,
        venue: m.venue,
      });
    }
    if (!map.has(m.away.id)) {
      map.set(m.away.id, {
        id: m.away.id,
        name: m.away.name,
        shortName: m.away.shortName,
        abbreviation: m.away.abbreviation,
        logo: m.away.logo,
        competitionId: m.competitionId,
        competitionName: m.competitionName,
        country: m.country,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

export function sortStandings(rows: StandingRow[]): StandingRow[] {
  return [...rows].sort((a, b) => {
    if (a.rank !== b.rank && a.rank > 0 && b.rank > 0) return a.rank - b.rank;
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    return b.goalsFor - a.goalsFor;
  });
}

export function computeH2HSummary(
  records: H2HMatchRecord[],
  homeClubName: string,
  awayClubName: string,
  homeTeamId?: string,
  awayTeamId?: string
): HeadToHeadSummary {
  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;
  let homeGoals = 0;
  let awayGoals = 0;

  const normHome = homeClubName.toLowerCase();
  const normAway = awayClubName.toLowerCase();

  for (const r of records) {
    const isSameHomeById = homeTeamId && r.homeTeamId ? r.homeTeamId === homeTeamId : false;
    const isSameAwayById = awayTeamId && r.awayTeamId ? r.awayTeamId === awayTeamId : false;
    const isSwappedById =
      homeTeamId && awayTeamId && r.homeTeamId && r.awayTeamId
        ? r.homeTeamId === awayTeamId && r.awayTeamId === homeTeamId
        : false;

    const rHome = r.homeName.toLowerCase();
    const rAway = r.awayName.toLowerCase();
    const currentHomeWasRecordHome =
      isSameHomeById ||
      (!isSwappedById && (rHome.includes(normHome) || normHome.includes(rHome)));

    if (currentHomeWasRecordHome) {
      homeGoals += r.homeScore;
      awayGoals += r.awayScore;
    } else {
      homeGoals += r.awayScore;
      awayGoals += r.homeScore;
    }

    if (r.homeScore === r.awayScore) {
      draws += 1;
      continue;
    }

    const recordWinnerIsRecordHome = r.homeScore > r.awayScore;
    if (isSameHomeById && isSameAwayById) {
      if (recordWinnerIsRecordHome) homeWins += 1;
      else awayWins += 1;
      continue;
    }
    if (isSwappedById) {
      if (recordWinnerIsRecordHome) awayWins += 1;
      else homeWins += 1;
      continue;
    }

    const winnerName = recordWinnerIsRecordHome ? rHome : rAway;
    if (winnerName.includes(normHome) || normHome.includes(winnerName)) {
      homeWins += 1;
    } else if (winnerName.includes(normAway) || normAway.includes(winnerName)) {
      awayWins += 1;
    }
  }

  return {
    homeWins,
    draws,
    awayWins,
    homeGoals,
    awayGoals,
    matches: [...records].sort((a, b) => new Date(b.dateIso).getTime() - new Date(a.dateIso).getTime()),
  };
}

export function detectMatchChanges(
  previous: MatchItem[],
  next: MatchItem[],
  prefs: NotificationPrefs,
  favoriteClubIds: Set<string> = new Set(),
  favoriteCompetitions: Set<string> = new Set(),
  clubPrefsMap: ClubNotificationPrefsMap = {}
): LiveAlertNotification[] {
  if (!prefs.enabled || previous.length === 0) return [];

  const prevMap = new Map(previous.map((m) => [m.id, m]));
  const alerts: LiveAlertNotification[] = [];
  const hasFavoritesFilter = favoriteClubIds.size > 0 || favoriteCompetitions.size > 0;

  for (const curr of next) {
    const prev = prevMap.get(curr.id);
    if (!prev) continue;

    const homeFav = favoriteClubIds.has(curr.home.id);
    const awayFav = favoriteClubIds.has(curr.away.id);
    const compFav = favoriteCompetitions.has(curr.competitionId);

    // If user has favorites configured, prioritize favorite clubs/competitions; otherwise watch live matches
    const isFollowed = !hasFavoritesFilter || homeFav || awayFav || compFav;
    if (!isFollowed) continue;

    // Resolve per-club overrides when one or both favorite clubs are customized
    const customClubConfigs: ClubNotificationPrefs[] = [];
    if (homeFav && clubPrefsMap[curr.home.id]?.customized) {
      customClubConfigs.push(clubPrefsMap[curr.home.id]);
    }
    if (awayFav && clubPrefsMap[curr.away.id]?.customized) {
      customClubConfigs.push(clubPrefsMap[curr.away.id]);
    }

    const useClubOverrides = customClubConfigs.length > 0 && !compFav;
    const allowGoals = useClubOverrides
      ? customClubConfigs.some((c) => c.goals)
      : customClubConfigs.length > 0
      ? prefs.goals || customClubConfigs.some((c) => c.goals)
      : prefs.goals;
    const allowCards = useClubOverrides
      ? customClubConfigs.some((c) => c.cards)
      : customClubConfigs.length > 0
      ? prefs.redCards || customClubConfigs.some((c) => c.cards)
      : prefs.redCards;
    const allowSubs = customClubConfigs.some((c) => c.substitutions);
    const allowFinalResult = useClubOverrides
      ? customClubConfigs.some((c) => c.finalResult)
      : customClubConfigs.length > 0
      ? prefs.halftimeFulltime || customClubConfigs.some((c) => c.finalResult)
      : prefs.halftimeFulltime;

    // 1. Kickoff
    if (prefs.kickoff && prev.status === 'upcoming' && curr.status === 'live') {
      alerts.push({
        id: `kickoff-${curr.id}-${Date.now()}`,
        matchId: curr.id,
        kind: 'kickoff',
        title: `Coup d'envoi · ${curr.competitionName}`,
        body: `${curr.home.name} vs ${curr.away.name} vient de commencer.`,
        timestamp: new Date().toISOString(),
      });
    }

    // 2. Goals scored
    if (
      allowGoals &&
      curr.home.score !== null &&
      curr.away.score !== null &&
      prev.home.score !== null &&
      prev.away.score !== null
    ) {
      if (curr.home.score > prev.home.score || curr.away.score > prev.away.score) {
        const scorerTeam = curr.home.score > prev.home.score ? curr.home.name : curr.away.name;
        alerts.push({
          id: `goal-${curr.id}-${curr.home.score}-${curr.away.score}`,
          matchId: curr.id,
          kind: 'goal',
          title: `BUT ! ${scorerTeam} (${curr.minuteDisplay || 'Direct'})`,
          body: `${curr.home.name} ${curr.home.score} - ${curr.away.score} ${curr.away.name} · ${curr.competitionName}`,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // 3. Cards & Substitutions (when event counters are provided by live feed)
    if (curr.summaryCounters && prev.summaryCounters) {
      if (allowCards && curr.summaryCounters.redCards > prev.summaryCounters.redCards) {
        alerts.push({
          id: `red-${curr.id}-${curr.summaryCounters.redCards}`,
          matchId: curr.id,
          kind: 'red-card',
          title: `Carton rouge · ${curr.competitionName}`,
          body: `${curr.home.name} vs ${curr.away.name} (${curr.minuteDisplay || 'Direct'})`,
          timestamp: new Date().toISOString(),
        });
      }
      if (allowCards && curr.summaryCounters.yellowCards > prev.summaryCounters.yellowCards) {
        alerts.push({
          id: `yellow-${curr.id}-${curr.summaryCounters.yellowCards}`,
          matchId: curr.id,
          kind: 'yellow-card',
          title: `Carton jaune · ${curr.competitionName}`,
          body: `${curr.home.name} vs ${curr.away.name} (${curr.minuteDisplay || 'Direct'})`,
          timestamp: new Date().toISOString(),
        });
      }
      if (allowSubs && curr.summaryCounters.substitutions > prev.summaryCounters.substitutions) {
        alerts.push({
          id: `sub-${curr.id}-${curr.summaryCounters.substitutions}`,
          matchId: curr.id,
          kind: 'substitution',
          title: `Remplacement · ${curr.competitionName}`,
          body: `${curr.home.name} vs ${curr.away.name} (${curr.minuteDisplay || 'Direct'})`,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // 4. Halftime / Fulltime
    if (prefs.halftimeFulltime) {
      const prevUpper = prev.statusText.toLowerCase();
      const currUpper = curr.statusText.toLowerCase();
      if (curr.status === 'live' && !prevUpper.includes('mi-temps') && currUpper.includes('mi-temps')) {
        alerts.push({
          id: `ht-${curr.id}`,
          matchId: curr.id,
          kind: 'halftime',
          title: `Mi-temps · ${curr.competitionName}`,
          body: `${curr.home.name} ${curr.home.score ?? 0} - ${curr.away.score ?? 0} ${curr.away.name}`,
          timestamp: new Date().toISOString(),
        });
      }
    }
    if (allowFinalResult && prev.status !== 'finished' && curr.status === 'finished') {
      alerts.push({
        id: `ft-${curr.id}`,
        matchId: curr.id,
        kind: 'fulltime',
        title: `Fin du match · ${curr.competitionName}`,
        body: `Score final : ${curr.home.name} ${curr.home.score ?? 0} - ${curr.away.score ?? 0} ${curr.away.name}`,
        timestamp: new Date().toISOString(),
      });
    }
  }

  return alerts;
}

export function formatLocalTimeFr(dateIso: string): string {
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function formatLocalDateFr(dateIso: string): string {
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function formatShortDateWithYearFr(dateIso: string): string {
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function toYmdDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
