import {
  computeH2HSummary,
  type CompetitionCategory,
  type CompetitionInfo,
  type H2HMatchRecord,
  type LineupPlayer,
  type MatchDetailResponse,
  type MatchEvent,
  type MatchItem,
  type MatchStatus,
  type PlayerMatchStat,
  type PlayerProfileInfo,
  type StandingRow,
  type StatPair,
  type TeamLineup,
} from './football.ts';

export type SportradarAccessLevel = 'trial' | 'production';

export function getSportradarBaseUrl(
  accessLevel: string = process.env.SPORTRADAR_ACCESS_LEVEL || 'trial',
  locale = 'fr'
): string {
  const level: SportradarAccessLevel = accessLevel === 'production' ? 'production' : 'trial';
  return `https://api.sportradar.com/soccer/${level}/v4/${locale}`;
}

const EUROPEAN_COUNTRIES = new Set([
  'england', 'angleterre', 'spain', 'espagne', 'germany', 'allemagne', 'italy', 'italie',
  'france', 'netherlands', 'pays-bas', 'portugal', 'belgium', 'belgique', 'turkey', 'turquie',
  'scotland', 'écosse', 'switzerland', 'suisse', 'austria', 'autriche', 'greece', 'grèce',
  'denmark', 'danemark', 'sweden', 'suède', 'norway', 'norvège', 'czechia', 'tchéquie',
  'czech republic', 'romania', 'roumanie', 'poland', 'pologne', 'ukraine', 'croatia', 'croatie',
  'serbia', 'serbie', 'hungary', 'hongrie', 'bulgaria', 'bulgarie', 'slovakia', 'slovaquie',
  'slovenia', 'slovénie', 'finland', 'finlande', 'ireland', 'irlande', 'wales', 'pays de galles',
  'northern ireland', 'iceland', 'islande', 'cyprus', 'chypre', 'israel', 'israël',
  'europe', 'international clubs',
]);

const COUNTRY_FR_MAP: Record<string, string> = {
  england: 'Angleterre',
  spain: 'Espagne',
  germany: 'Allemagne',
  italy: 'Italie',
  france: 'France',
  netherlands: 'Pays-Bas',
  portugal: 'Portugal',
  belgium: 'Belgique',
  turkey: 'Turquie',
  scotland: 'Écosse',
  switzerland: 'Suisse',
  austria: 'Autriche',
  greece: 'Grèce',
  denmark: 'Danemark',
  sweden: 'Suède',
  norway: 'Norvège',
  czechia: 'Tchéquie',
  'czech republic': 'Tchéquie',
  romania: 'Roumanie',
  poland: 'Pologne',
  ukraine: 'Ukraine',
  russia: 'Russie',
  'saudi arabia': 'Arabie saoudite',
  usa: 'États-Unis',
  'united states': 'États-Unis',
  brazil: 'Brésil',
  argentina: 'Argentine',
  mali: 'Mali',
  africa: 'Afrique',
  europe: 'Europe',
  'international clubs': 'Europe',
  international: 'International',
};

export function translateCountryFr(raw: string): string {
  const key = raw.trim().toLowerCase();
  return COUNTRY_FR_MAP[key] || raw.trim() || 'International';
}

function inferDivisionInfo(name: string, type?: string): { level: number; label: string } {
  const lower = name.toLowerCase();
  if (type === 'cup' || lower.includes('cup') || lower.includes('coupe') || lower.includes('copa') || lower.includes('pokal') || lower.includes('coppa') || lower.includes('taça')) {
    return { level: 10, label: 'Coupe nationale' };
  }
  if (lower.includes('champions league') || lower.includes('europa league') || lower.includes('conference league') || lower.includes('libertadores')) {
    return { level: 1, label: 'Compétition continentale' };
  }
  if (lower.includes('serie d') || lower.includes('série d') || lower.includes('4th') || lower.includes('league two') || lower.includes('fourth')) {
    return { level: 4, label: '4e division' };
  }
  if (lower.includes('serie c') || lower.includes('série c') || lower.includes('3. liga') || lower.includes('league one') || lower.includes('national') || lower.includes('third')) {
    return { level: 3, label: '3e division' };
  }
  if (
    lower.includes('championship') ||
    lower.includes('ligue 2') ||
    lower.includes('laliga 2') ||
    lower.includes('2. bundesliga') ||
    lower.includes('serie b') ||
    lower.includes('série b') ||
    lower.includes('first division') ||
    lower.includes('first league') ||
    lower.includes('usl championship') ||
    lower.includes('2nd') ||
    lower.includes('segunda')
  ) {
    return { level: 2, label: '2e division' };
  }
  if (lower.includes('paulista') || lower.includes('carioca') || lower.includes('mineiro') || lower.includes('gaucho') || lower.includes('estadual')) {
    return { level: 5, label: 'Championnat régional' };
  }
  return { level: 1, label: '1re division' };
}

function classifyRegionAndCategory(
  rawCountry: string,
  compName: string,
  type?: string
): { region: NonNullable<CompetitionInfo['region']>; category: CompetitionCategory } {
  const c = rawCountry.trim().toLowerCase();
  const n = compName.trim().toLowerCase();

  if (c.includes('saudi') || c.includes('arabie')) {
    return { region: 'middle_east', category: 'saudi' };
  }
  if (c === 'usa' || c.includes('united states') || c.includes('états-unis')) {
    return { region: 'americas', category: 'usa' };
  }
  if (c.includes('brazil') || c.includes('brésil')) {
    return { region: 'americas', category: 'brazil' };
  }
  if (c.includes('russia') || c.includes('russie')) {
    return { region: 'europe', category: 'russia' };
  }
  if (c.includes('africa') || c.includes('afrique') || c === 'mali') {
    return { region: 'africa', category: 'africa' };
  }
  if (n.includes('uefa') || c === 'europe' || c === 'international clubs') {
    return { region: 'europe', category: 'cups' };
  }
  if (EUROPEAN_COUNTRIES.has(c)) {
    return { region: 'europe', category: type === 'cup' ? 'cups' : 'europe' };
  }
  if (c === 'international' || c === 'world') {
    return { region: 'international', category: 'international' };
  }
  return { region: 'international', category: 'other' };
}

export function parseSportradarCompetitions(raw: any): CompetitionInfo[] {
  const list = Array.isArray(raw?.competitions) ? raw.competitions : [];
  const parsed: CompetitionInfo[] = [];

  for (const item of list) {
    const id = String(item?.id || '').trim();
    const name = String(item?.name || '').trim();
    if (!id || !name) continue;
    // Exclude esports/simulated leagues if present in feed
    if (/esoccer|ebasketball|virtual/i.test(name)) continue;

    const rawCountry = String(item?.category?.name || 'International');
    const countryFr = translateCountryFr(rawCountry);
    const { region, category } = classifyRegionAndCategory(rawCountry, name, item?.type);
    const div = inferDivisionInfo(name, item?.type);

    parsed.push({
      id,
      name,
      shortName: name,
      country: countryFr,
      countryCode: item?.category?.country_code ? String(item.category.country_code) : undefined,
      region,
      category,
      divisionLevel: div.level,
      divisionLabel: div.label,
      source: 'sportradar',
      currentSeasonId: item?.current_season?.id ? String(item.current_season.id) : undefined,
      available: true,
      hasStandings: item?.type !== 'cup',
    });
  }

  return prioritizeSportradarCatalog(parsed);
}

export function prioritizeSportradarCatalog(items: CompetitionInfo[]): CompetitionInfo[] {
  const priorityOrder = [
    'Angleterre', 'Espagne', 'Allemagne', 'Italie', 'France', 'Europe',
    'Arabie saoudite', 'États-Unis', 'Brésil', 'Russie', 'Mali', 'Afrique',
  ];
  return [...items].sort((a, b) => {
    const ia = priorityOrder.indexOf(a.country);
    const ib = priorityOrder.indexOf(b.country);
    if (ia !== -1 && ib !== -1 && ia !== ib) return ia - ib;
    if (ia !== -1 && ib === -1) return -1;
    if (ib !== -1 && ia === -1) return 1;
    const da = a.divisionLevel ?? 99;
    const db = b.divisionLevel ?? 99;
    if (da !== db) return da - db;
    return a.name.localeCompare(b.name, 'fr');
  });
}

export function mapSportradarStatus(statusObj: any): {
  status: MatchStatus;
  statusText: string;
  minuteDisplay: string;
  isExtraTime: boolean;
  isPenalties: boolean;
} {
  const rawStatus = String(statusObj?.status || 'not_started').toLowerCase();
  const matchStatus = String(statusObj?.match_status || '').toLowerCase();
  const played = String(statusObj?.clock?.played || '').trim();

  const isExtraTime = matchStatus.includes('overtime') || matchStatus.includes('extra') || rawStatus === 'aet';
  const isPenalties = matchStatus.includes('penalties') || rawStatus === 'ap';

  if (rawStatus === 'live' || rawStatus === 'inprogress' || matchStatus === '1st_half' || matchStatus === '2nd_half' || matchStatus === 'halftime') {
    let statusText = 'En direct';
    if (matchStatus === 'halftime' || matchStatus === 'pause') statusText = 'Mi-temps';
    else if (isPenalties) statusText = 'Tirs au but';
    else if (isExtraTime) statusText = 'Prolongations';

    const minuteDisplay = played
      ? (played.includes("'") ? played : `${played}'`)
      : statusText === 'Mi-temps'
      ? 'MT'
      : 'Live';

    return { status: 'live', statusText, minuteDisplay, isExtraTime, isPenalties };
  }

  if (rawStatus === 'ended' || rawStatus === 'closed' || rawStatus === 'aet' || rawStatus === 'ap') {
    let statusText = 'Terminé';
    if (isPenalties) statusText = 'Terminé (TAB)';
    else if (isExtraTime) statusText = 'Terminé (AP)';
    return {
      status: 'finished',
      statusText,
      minuteDisplay: isPenalties ? 'TAB' : isExtraTime ? 'AP' : 'FT',
      isExtraTime,
      isPenalties,
    };
  }

  if (rawStatus === 'postponed' || rawStatus === 'cancelled' || rawStatus === 'abandoned') {
    return { status: 'postponed', statusText: 'Reporté', minuteDisplay: 'Reporté', isExtraTime: false, isPenalties: false };
  }

  return { status: 'upcoming', statusText: 'À venir', minuteDisplay: '', isExtraTime: false, isPenalties: false };
}

export function parseSportradarSummaryToMatch(summary: any): MatchItem | null {
  const ev = summary?.sport_event;
  const st = summary?.sport_event_status;
  if (!ev || !Array.isArray(ev.competitors) || ev.competitors.length < 2) return null;

  const homeComp = ev.competitors.find((c: any) => c.qualifier === 'home') || ev.competitors[0];
  const awayComp = ev.competitors.find((c: any) => c.qualifier === 'away') || ev.competitors[1];

  const mapped = mapSportradarStatus(st);
  const compInfo = ev.sport_event_context?.competition;
  const catInfo = ev.sport_event_context?.category;
  const countryFr = translateCountryFr(String(catInfo?.name || 'International'));
  const compName = String(compInfo?.name || 'Compétition');
  const div = inferDivisionInfo(compName, compInfo?.type);

  const parseScore = (val: unknown): number | null => {
    if (mapped.status === 'upcoming' || mapped.status === 'postponed') return null;
    if (val === undefined || val === null || val === '') return null;
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
  };

  const homeId = String(homeComp.id || '');
  const awayId = String(awayComp.id || '');
  const statsComps = Array.isArray(summary?.statistics?.totals?.competitors)
    ? summary.statistics.totals.competitors
    : [];
  let yellowCards = 0;
  let redCards = 0;
  let substitutions = 0;
  for (const sc of statsComps) {
    yellowCards += Number(sc?.statistics?.yellow_cards || 0);
    redCards += Number(sc?.statistics?.red_cards || 0);
    substitutions += Number(sc?.statistics?.substitutions || 0);
  }

  return {
    id: String(ev.id),
    competitionId: String(compInfo?.id || 'sr.unknown'),
    competitionName: compName,
    country: countryFr,
    divisionLabel: div.label,
    dateIso: String(ev.start_time || new Date().toISOString()),
    status: mapped.status,
    statusText: mapped.statusText,
    minuteDisplay: mapped.minuteDisplay,
    isExtraTime: mapped.isExtraTime,
    isPenalties: mapped.isPenalties,
    venue: ev.venue?.name ? String(ev.venue.name) : undefined,
    sourceProvider: 'sportradar',
    summaryCounters:
      statsComps.length > 0 ? { yellowCards, redCards, substitutions } : undefined,
    home: {
      id: homeId,
      name: String(homeComp.name || 'Domicile'),
      shortName: String(homeComp.short_name || homeComp.name || 'Domicile'),
      abbreviation: String(homeComp.abbreviation || String(homeComp.name || 'DOM').slice(0, 3).toUpperCase()),
      logo: '',
      score: parseScore(st?.home_score),
      winner: st?.winner_id ? String(st.winner_id) === homeId : undefined,
    },
    away: {
      id: awayId,
      name: String(awayComp.name || 'Extérieur'),
      shortName: String(awayComp.short_name || awayComp.name || 'Extérieur'),
      abbreviation: String(awayComp.abbreviation || String(awayComp.name || 'EXT').slice(0, 3).toUpperCase()),
      logo: '',
      score: parseScore(st?.away_score),
      winner: st?.winner_id ? String(st.winner_id) === awayId : undefined,
    },
  };
}

export function parseSportradarStatistics(summary: any, homeId: string, awayId: string): StatPair[] {
  const comps = Array.isArray(summary?.statistics?.totals?.competitors)
    ? summary.statistics.totals.competitors
    : [];
  if (comps.length < 2) return [];

  const home = comps.find((c: any) => String(c.id) === homeId || c.qualifier === 'home') || comps[0];
  const away = comps.find((c: any) => String(c.id) === awayId || c.qualifier === 'away') || comps[1];
  const hs = home?.statistics || {};
  const as = away?.statistics || {};

  const defs: Array<{ key: string; srKey: string; label: string; isPct?: boolean }> = [
    { key: 'possessionPct', srKey: 'ball_possession', label: 'Possession du ballon (%)', isPct: true },
    { key: 'totalShots', srKey: 'shots_total', label: 'Tirs totaux' },
    { key: 'shotsOnTarget', srKey: 'shots_on_target', label: 'Tirs cadrés' },
    { key: 'wonCorners', srKey: 'corner_kicks', label: 'Corners' },
    { key: 'foulsCommitted', srKey: 'fouls', label: 'Fautes commises' },
    { key: 'offsides', srKey: 'offsides', label: 'Hors-jeu' },
    { key: 'yellowCards', srKey: 'yellow_cards', label: 'Cartons jaunes' },
    { key: 'redCards', srKey: 'red_cards', label: 'Cartons rouges' },
    { key: 'saves', srKey: 'goalkeeper_saves', label: 'Arrêts des gardiens' },
  ];

  const pairs: StatPair[] = [];
  for (const d of defs) {
    const hvRaw = hs[d.srKey];
    const avRaw = as[d.srKey];
    if (hvRaw === undefined && avRaw === undefined) continue;
    const hNum = Number(hvRaw ?? 0);
    const aNum = Number(avRaw ?? 0);
    if (!Number.isFinite(hNum) || !Number.isFinite(aNum)) continue;
    pairs.push({
      key: d.key,
      label: d.label,
      homeValue: d.isPct ? `${hNum}%` : String(hNum),
      awayValue: d.isPct ? `${aNum}%` : String(aNum),
      homeNumeric: hNum,
      awayNumeric: aNum,
    });
  }
  return pairs;
}

export function parseSportradarPlayerStats(summary: any): PlayerMatchStat[] {
  const comps = Array.isArray(summary?.statistics?.totals?.competitors)
    ? summary.statistics.totals.competitors
    : [];
  const stats: PlayerMatchStat[] = [];
  for (const c of comps) {
    const teamId = String(c?.id || '');
    const teamName = String(c?.name || '');
    const players = Array.isArray(c?.players) ? c.players : [];
    for (const p of players) {
      const ps = p?.statistics || {};
      const playerId = String(p?.id || '');
      const name = String(p?.name || '');
      if (!playerId || !name) continue;
      stats.push({
        playerId,
        name,
        teamId,
        teamName,
        minutesPlayed: typeof ps.minutes_played === 'number' ? ps.minutes_played : undefined,
        goals: typeof ps.goals_scored === 'number' ? ps.goals_scored : undefined,
        assists: typeof ps.assists === 'number' ? ps.assists : undefined,
        shots: typeof ps.shots_total === 'number' ? ps.shots_total : undefined,
        shotsOnTarget: typeof ps.shots_on_target === 'number' ? ps.shots_on_target : undefined,
        yellowCards: typeof ps.yellow_cards === 'number' ? ps.yellow_cards : undefined,
        redCards: typeof ps.red_cards === 'number' ? ps.red_cards : undefined,
        saves: typeof ps.goalkeeper_saves === 'number' ? ps.goalkeeper_saves : undefined,
      });
    }
  }
  return stats;
}

export function parseSportradarTimelineToDetail(opts: {
  timeline: any;
  lineupsRaw?: any;
  h2hRaw?: any;
}): MatchDetailResponse | null {
  const { timeline, lineupsRaw, h2hRaw } = opts;
  const match = parseSportradarSummaryToMatch(timeline);
  if (!match) return null;

  const rawEvents = Array.isArray(timeline?.timeline) ? timeline.timeline : [];
  const events: MatchEvent[] = [];

  for (let i = 0; i < rawEvents.length; i += 1) {
    const ev = rawEvents[i];
    const t = String(ev?.type || '').toLowerCase();
    let mappedType: MatchEvent['type'] | null = null;
    if (t === 'score_change') mappedType = ev?.goal_type === 'own' ? 'own-goal' : ev?.goal_type === 'penalty' ? 'penalty-goal' : 'goal';
    else if (t === 'yellow_card') mappedType = 'yellow-card';
    else if (t === 'red_card' || t === 'yellow_red_card') mappedType = 'red-card';
    else if (t === 'substitution') mappedType = 'substitution';
    else if (t === 'match_started') mappedType = 'kickoff';
    else if (t === 'break_start' && ev?.period_name === 'halftime') mappedType = 'halftime';
    else if (t === 'match_ended') mappedType = 'fulltime';
    else if (t === 'penalty_missed') mappedType = 'penalty-missed';

    if (!mappedType) continue;
    const players = Array.isArray(ev?.players) ? ev.players : [];
    const main = players[0]?.name ? String(players[0].name) : '';
    const secondary = players[1]?.name ? String(players[1].name) : undefined;
    const isHome = ev?.competitor === 'home';

    events.push({
      id: String(ev?.id || `sr-ev-${i}`),
      type: mappedType,
      minute: ev?.match_clock ? String(ev.match_clock) : ev?.match_time ? `${ev.match_time}'` : '',
      period: Number(ev?.period || 1),
      teamId: isHome ? match.home.id : match.away.id,
      teamName: isHome ? match.home.shortName : match.away.shortName,
      isHome,
      player: main || String(ev?.type || ''),
      assistOrOut: secondary,
      description: String(ev?.commentaries?.[0]?.text || main || mappedType),
    });
  }

  const statistics = parseSportradarStatistics(timeline, match.home.id, match.away.id);
  const playerStats = parseSportradarPlayerStats(timeline);

  // Lineups parsing
  let homeLineup: TeamLineup | null = null;
  let awayLineup: TeamLineup | null = null;
  const luComps = Array.isArray(lineupsRaw?.lineups?.competitors) ? lineupsRaw.lineups.competitors : [];
  for (const c of luComps) {
    const playersRaw = Array.isArray(c?.players) ? c.players : [];
    const starters: LineupPlayer[] = [];
    const substitutes: LineupPlayer[] = [];
    for (const p of playersRaw) {
      const lp: LineupPlayer = {
        id: String(p?.id || ''),
        name: String(p?.name || 'Joueur'),
        jersey: p?.jersey_number !== undefined ? String(p.jersey_number) : '',
        position: String(p?.type || ''),
        starter: Boolean(p?.starter),
        subbedIn: false,
        subbedOut: false,
      };
      if (lp.starter) starters.push(lp);
      else substitutes.push(lp);
    }
    const lu: TeamLineup = {
      teamId: String(c?.id || ''),
      teamName: String(c?.name || ''),
      formation: String(c?.formation?.type || ''),
      starters,
      substitutes,
    };
    if (c?.qualifier === 'home' || lu.teamId === match.home.id) homeLineup = lu;
    else awayLineup = lu;
  }

  // H2H parsing
  const h2hRecords: H2HMatchRecord[] = [];
  const lastMeetings = Array.isArray(h2hRaw?.last_meetings) ? h2hRaw.last_meetings : [];
  for (const m of lastMeetings) {
    const mMatch = parseSportradarSummaryToMatch(m);
    if (!mMatch || mMatch.status !== 'finished') continue;
    const hs = mMatch.home.score ?? 0;
    const as = mMatch.away.score ?? 0;
    h2hRecords.push({
      id: mMatch.id,
      dateIso: mMatch.dateIso,
      competitionName: mMatch.competitionName,
      homeTeamId: mMatch.home.id,
      awayTeamId: mMatch.away.id,
      homeName: mMatch.home.name,
      awayName: mMatch.away.name,
      homeScore: hs,
      awayScore: as,
      winnerSide: hs > as ? 'home' : as > hs ? 'away' : 'draw',
    });
  }

  return {
    match,
    events,
    statistics,
    lineups: { home: homeLineup, away: awayLineup },
    playerStats: playerStats.length > 0 ? playerStats : undefined,
    h2h: computeH2HSummary(h2hRecords, match.home.name, match.away.name, match.home.id, match.away.id),
    provider: 'Sportradar Soccer v4',
    lastRealUpdateIso: new Date().toISOString(),
  };
}

export function parseSportradarStandings(raw: any, fallbackCompName = 'Classement'): {
  season: string;
  tables: { groupName: string; rows: StandingRow[] }[];
} {
  const standingsList = Array.isArray(raw?.standings) ? raw.standings : [];
  const totalType = standingsList.find((s: any) => s.type === 'total') || standingsList[0];
  const groups = Array.isArray(totalType?.groups) ? totalType.groups : [];

  const tables = groups.map((g: any) => {
    const entries = Array.isArray(g?.standings) ? g.standings : [];
    const rows: StandingRow[] = entries.map((e: any, idx: number) => ({
      rank: Number(e.rank || idx + 1),
      teamId: String(e.competitor?.id || idx),
      teamName: String(e.competitor?.name || 'Club'),
      teamLogo: '',
      played: Number(e.played || 0),
      wins: Number(e.win || 0),
      draws: Number(e.draw || 0),
      losses: Number(e.loss || 0),
      goalsFor: Number(e.goals_for || 0),
      goalsAgainst: Number(e.goals_against || 0),
      goalDifference: Number(e.goals_diff ?? (Number(e.goals_for || 0) - Number(e.goals_against || 0))),
      points: Number(e.points || 0),
      note: e.current_outcome ? String(e.current_outcome) : undefined,
    }));
    return {
      groupName: String(g?.group?.name || fallbackCompName),
      rows,
    };
  });

  return {
    season: String(raw?.season?.name || ''),
    tables,
  };
}

export function parseSportradarPlayerProfile(raw: any): PlayerProfileInfo | null {
  const p = raw?.player;
  if (!p || !p.id || !p.name) return null;
  const roles = Array.isArray(raw?.roles) ? raw.roles : [];
  const activeRole = roles.find((r: any) => r.active) || roles[0];

  const rawSeasons = Array.isArray(raw?.statistics?.seasons) ? raw.statistics.seasons : [];
  const seasonSplits = rawSeasons
    .map((s: any, idx: number) => {
      const t = s?.totals || {};
      const played = typeof t.matches_played === 'number' ? t.matches_played : undefined;
      const goals = typeof t.goals_scored === 'number' ? t.goals_scored : undefined;
      const assists = typeof t.assists === 'number' ? t.assists : undefined;
      const minutes = typeof t.minutes_played === 'number' ? t.minutes_played : undefined;
      const yellows = typeof t.yellow_cards === 'number' ? t.yellow_cards : undefined;
      const reds = typeof t.red_cards === 'number' ? t.red_cards : undefined;
      const shots = typeof t.shots_total === 'number' ? t.shots_total : undefined;
      const shotsOnTarget = typeof t.shots_on_target === 'number' ? t.shots_on_target : undefined;
      if (
        played === undefined &&
        goals === undefined &&
        assists === undefined &&
        minutes === undefined &&
        yellows === undefined &&
        reds === undefined
      ) {
        return null;
      }
      return {
        id: String(s?.id || `sr-season-${idx}`),
        seasonName: String(s?.name || s?.competition?.name || `Saison ${idx + 1}`),
        teamName: s?.competitor?.name ? String(s.competitor.name) : undefined,
        appearances: played,
        goals,
        assists,
        minutesPlayed: minutes,
        yellowCards: yellows,
        redCards: reds,
        shots,
        shotsOnTarget,
      };
    })
    .filter((x: any): x is NonNullable<typeof x> => Boolean(x));

  let aggregatedStats: PlayerProfileInfo['stats'] | undefined;
  if (seasonSplits.length > 0) {
    const sumOpt = (getter: (item: any) => number | undefined): number | undefined => {
      let any = false;
      let total = 0;
      for (const item of seasonSplits) {
        const val = getter(item);
        if (typeof val === 'number' && Number.isFinite(val)) {
          total += val;
          any = true;
        }
      }
      return any ? total : undefined;
    };
    aggregatedStats = {
      appearances: sumOpt((i) => i.appearances),
      goals: sumOpt((i) => i.goals),
      assists: sumOpt((i) => i.assists),
      minutesPlayed: sumOpt((i) => i.minutesPlayed),
      yellowCards: sumOpt((i) => i.yellowCards),
      redCards: sumOpt((i) => i.redCards),
      shots: sumOpt((i) => i.shots),
      shotsOnTarget: sumOpt((i) => i.shotsOnTarget),
    };
  }

  return {
    id: String(p.id),
    name: String(p.name),
    teamId: String(activeRole?.competitor?.id || ''),
    teamName: String(activeRole?.competitor?.name || 'Club'),
    nationality: p.nationality ? String(p.nationality) : undefined,
    position: p.type ? String(p.type) : undefined,
    jersey: activeRole?.jersey_number !== undefined ? String(activeRole.jersey_number) : undefined,
    height: typeof p.height === 'number' ? `${p.height} cm` : undefined,
    weight: typeof p.weight === 'number' ? `${p.weight} kg` : undefined,
    seasonLabel: seasonSplits[0]?.seasonName,
    source: 'sportradar',
    stats: aggregatedStats,
    seasonSplits: seasonSplits.length > 0 ? seasonSplits : undefined,
  };
}
