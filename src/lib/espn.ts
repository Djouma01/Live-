import {
  computeH2HSummary,
  type CompetitionInfo,
  type H2HMatchRecord,
  type LineupPlayer,
  type MatchDetailResponse,
  type MatchEvent,
  type MatchItem,
  type MatchStatus,
  type NewsArticle,
  type PlayerMatchStat,
  type StandingRow,
  type StatPair,
  type TeamLineup,
} from './football.ts';

export const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
export const ESPN_STANDINGS_BASE = 'https://site.api.espn.com/apis/v2/sports/soccer';

export interface CompetitionCatalogDef {
  id: string;
  name: string;
  shortName: string;
  country: string;
  region: NonNullable<CompetitionInfo['region']>;
  category: CompetitionInfo['category'];
  divisionLevel: number;
  divisionLabel: string;
  hasStandings: boolean;
  requiresApiFootball?: boolean;
  apiFootballLeagueId?: number;
}

export const COMPETITION_CATALOG: CompetitionCatalogDef[] = [
  // EUROPE - TOP & LOWER DIVISIONS & NATIONAL CUPS
  { id: 'eng.1', name: 'Premier League', shortName: 'Premier League', country: 'Angleterre', region: 'europe', category: 'europe', divisionLevel: 1, divisionLabel: '1re division', hasStandings: true, apiFootballLeagueId: 39 },
  { id: 'eng.2', name: 'Championship', shortName: 'Championship', country: 'Angleterre', region: 'europe', category: 'europe', divisionLevel: 2, divisionLabel: '2e division', hasStandings: true, apiFootballLeagueId: 40 },
  { id: 'eng.3', name: 'League One', shortName: 'League One', country: 'Angleterre', region: 'europe', category: 'europe', divisionLevel: 3, divisionLabel: '3e division', hasStandings: true, apiFootballLeagueId: 41 },
  { id: 'eng.fa', name: 'FA Cup', shortName: 'FA Cup', country: 'Angleterre', region: 'europe', category: 'cups', divisionLevel: 10, divisionLabel: 'Coupe nationale', hasStandings: false, apiFootballLeagueId: 45 },
  { id: 'eng.league_cup', name: 'Carabao Cup', shortName: 'Carabao Cup', country: 'Angleterre', region: 'europe', category: 'cups', divisionLevel: 11, divisionLabel: 'Coupe de la Ligue', hasStandings: false, apiFootballLeagueId: 48 },

  { id: 'esp.1', name: 'La Liga', shortName: 'La Liga', country: 'Espagne', region: 'europe', category: 'europe', divisionLevel: 1, divisionLabel: '1re division', hasStandings: true, apiFootballLeagueId: 140 },
  { id: 'esp.2', name: 'La Liga 2', shortName: 'La Liga 2', country: 'Espagne', region: 'europe', category: 'europe', divisionLevel: 2, divisionLabel: '2e division', hasStandings: true, apiFootballLeagueId: 141 },
  { id: 'esp.copa_del_rey', name: 'Coupe du Roi (Copa del Rey)', shortName: 'Copa del Rey', country: 'Espagne', region: 'europe', category: 'cups', divisionLevel: 10, divisionLabel: 'Coupe nationale', hasStandings: false, apiFootballLeagueId: 143 },

  { id: 'ger.1', name: 'Bundesliga', shortName: 'Bundesliga', country: 'Allemagne', region: 'europe', category: 'europe', divisionLevel: 1, divisionLabel: '1re division', hasStandings: true, apiFootballLeagueId: 78 },
  { id: 'ger.2', name: '2. Bundesliga', shortName: '2. Bundesliga', country: 'Allemagne', region: 'europe', category: 'europe', divisionLevel: 2, divisionLabel: '2e division', hasStandings: true, apiFootballLeagueId: 79 },
  { id: 'ger.dfb_pokal', name: "Coupe d'Allemagne (DFB-Pokal)", shortName: 'DFB-Pokal', country: 'Allemagne', region: 'europe', category: 'cups', divisionLevel: 10, divisionLabel: 'Coupe nationale', hasStandings: false, apiFootballLeagueId: 81 },

  { id: 'ita.1', name: 'Serie A', shortName: 'Serie A', country: 'Italie', region: 'europe', category: 'europe', divisionLevel: 1, divisionLabel: '1re division', hasStandings: true, apiFootballLeagueId: 135 },
  { id: 'ita.2', name: 'Serie B', shortName: 'Serie B', country: 'Italie', region: 'europe', category: 'europe', divisionLevel: 2, divisionLabel: '2e division', hasStandings: true, apiFootballLeagueId: 136 },
  { id: 'ita.coppa_italia', name: 'Coppa Italia', shortName: 'Coppa Italia', country: 'Italie', region: 'europe', category: 'cups', divisionLevel: 10, divisionLabel: 'Coupe nationale', hasStandings: false, apiFootballLeagueId: 137 },

  { id: 'fra.1', name: 'Ligue 1', shortName: 'Ligue 1', country: 'France', region: 'europe', category: 'europe', divisionLevel: 1, divisionLabel: '1re division', hasStandings: true, apiFootballLeagueId: 61 },
  { id: 'fra.2', name: 'Ligue 2', shortName: 'Ligue 2', country: 'France', region: 'europe', category: 'europe', divisionLevel: 2, divisionLabel: '2e division', hasStandings: true, apiFootballLeagueId: 62 },
  { id: 'fra.coupe_de_france', name: 'Coupe de France', shortName: 'Coupe de France', country: 'France', region: 'europe', category: 'cups', divisionLevel: 10, divisionLabel: 'Coupe nationale', hasStandings: false, apiFootballLeagueId: 66 },

  { id: 'ned.1', name: 'Eredivisie', shortName: 'Eredivisie', country: 'Pays-Bas', region: 'europe', category: 'europe', divisionLevel: 1, divisionLabel: '1re division', hasStandings: true, apiFootballLeagueId: 88 },
  { id: 'ned.2', name: 'Eerste Divisie', shortName: 'Eerste Divisie', country: 'Pays-Bas', region: 'europe', category: 'europe', divisionLevel: 2, divisionLabel: '2e division', hasStandings: true, apiFootballLeagueId: 89 },
  { id: 'por.1', name: 'Primeira Liga', shortName: 'Liga Portugal', country: 'Portugal', region: 'europe', category: 'europe', divisionLevel: 1, divisionLabel: '1re division', hasStandings: true, apiFootballLeagueId: 94 },
  { id: 'bel.1', name: 'Jupiler Pro League', shortName: 'Pro League', country: 'Belgique', region: 'europe', category: 'europe', divisionLevel: 1, divisionLabel: '1re division', hasStandings: true, apiFootballLeagueId: 144 },
  { id: 'tur.1', name: 'Süper Lig', shortName: 'Süper Lig', country: 'Turquie', region: 'europe', category: 'europe', divisionLevel: 1, divisionLabel: '1re division', hasStandings: true, apiFootballLeagueId: 203 },
  { id: 'sco.1', name: 'Scottish Premiership', shortName: 'Premiership', country: 'Écosse', region: 'europe', category: 'europe', divisionLevel: 1, divisionLabel: '1re division', hasStandings: true, apiFootballLeagueId: 179 },
  { id: 'sui.1', name: 'Super League Suisse', shortName: 'Super League', country: 'Suisse', region: 'europe', category: 'europe', divisionLevel: 1, divisionLabel: '1re division', hasStandings: true, apiFootballLeagueId: 207 },
  { id: 'aut.1', name: 'Bundesliga Autriche', shortName: 'Bundesliga AUT', country: 'Autriche', region: 'europe', category: 'europe', divisionLevel: 1, divisionLabel: '1re division', hasStandings: true, apiFootballLeagueId: 218 },
  { id: 'gre.1', name: 'Super League Grèce', shortName: 'Super League GR', country: 'Grèce', region: 'europe', category: 'europe', divisionLevel: 1, divisionLabel: '1re division', hasStandings: true, apiFootballLeagueId: 197 },
  { id: 'den.1', name: 'Superliga Danemark', shortName: 'Superliga', country: 'Danemark', region: 'europe', category: 'europe', divisionLevel: 1, divisionLabel: '1re division', hasStandings: true, apiFootballLeagueId: 119 },
  { id: 'swe.1', name: 'Allsvenskan', shortName: 'Allsvenskan', country: 'Suède', region: 'europe', category: 'europe', divisionLevel: 1, divisionLabel: '1re division', hasStandings: true, apiFootballLeagueId: 113 },
  { id: 'nor.1', name: 'Eliteserien', shortName: 'Eliteserien', country: 'Norvège', region: 'europe', category: 'europe', divisionLevel: 1, divisionLabel: '1re division', hasStandings: true, apiFootballLeagueId: 103 },
  { id: 'cze.1', name: 'Chance Liga', shortName: 'Liga Tchéquie', country: 'Tchéquie', region: 'europe', category: 'europe', divisionLevel: 1, divisionLabel: '1re division', hasStandings: true, apiFootballLeagueId: 345 },
  { id: 'rou.1', name: 'SuperLiga Roumanie', shortName: 'Liga 1 ROU', country: 'Roumanie', region: 'europe', category: 'europe', divisionLevel: 1, divisionLabel: '1re division', hasStandings: true, apiFootballLeagueId: 283 },

  // COMPÉTITIONS EUROPÉENNES
  { id: 'uefa.champions', name: 'Ligue des champions UEFA', shortName: 'LDC UEFA', country: 'Europe', region: 'europe', category: 'cups', divisionLevel: 1, divisionLabel: 'Compétition européenne', hasStandings: true, apiFootballLeagueId: 2 },
  { id: 'uefa.europa', name: 'Europa League UEFA', shortName: 'Europa League', country: 'Europe', region: 'europe', category: 'cups', divisionLevel: 2, divisionLabel: 'Compétition européenne', hasStandings: true, apiFootballLeagueId: 3 },
  { id: 'uefa.europa.conf', name: 'Conference League UEFA', shortName: 'Conference League', country: 'Europe', region: 'europe', category: 'cups', divisionLevel: 3, divisionLabel: 'Compétition européenne', hasStandings: true, apiFootballLeagueId: 848 },

  // RUSSIE
  { id: 'rus.1', name: 'Premier League Russie', shortName: 'Premier Liga RUS', country: 'Russie', region: 'europe', category: 'russia', divisionLevel: 1, divisionLabel: '1re division', hasStandings: true, apiFootballLeagueId: 235 },

  // ARABIE SAOUDITE
  { id: 'ksa.1', name: 'Saudi Pro League', shortName: 'Saudi Pro League', country: 'Arabie saoudite', region: 'middle_east', category: 'saudi', divisionLevel: 1, divisionLabel: '1re division', hasStandings: true, apiFootballLeagueId: 307 },

  // ÉTATS-UNIS
  { id: 'usa.1', name: 'MLS (Major League Soccer)', shortName: 'MLS', country: 'États-Unis', region: 'americas', category: 'usa', divisionLevel: 1, divisionLabel: '1re division', hasStandings: true, apiFootballLeagueId: 253 },

  // BRÉSIL & AMÉRIQUE DU SUD
  { id: 'bra.1', name: 'Brasileirão Série A', shortName: 'Série A Brésil', country: 'Brésil', region: 'americas', category: 'brazil', divisionLevel: 1, divisionLabel: '1re division', hasStandings: true, apiFootballLeagueId: 71 },
  { id: 'bra.2', name: 'Brasileirão Série B', shortName: 'Série B Brésil', country: 'Brésil', region: 'americas', category: 'brazil', divisionLevel: 2, divisionLabel: '2e division', hasStandings: true, apiFootballLeagueId: 72 },
  { id: 'arg.1', name: 'Liga Profesional Argentine', shortName: 'Liga Argentina', country: 'Argentine', region: 'americas', category: 'other', divisionLevel: 1, divisionLabel: '1re division', hasStandings: true, apiFootballLeagueId: 128 },

  // AFRIQUE & INTERNATIONAL
  { id: 'caf.champions', name: 'Ligue des champions CAF', shortName: 'LDC CAF', country: 'Afrique', region: 'africa', category: 'africa', divisionLevel: 1, divisionLabel: 'Compétition continentale', hasStandings: true, apiFootballLeagueId: 12 },
  { id: 'caf.nations', name: "Coupe d'Afrique des Nations", shortName: 'CAN', country: 'Afrique', region: 'africa', category: 'africa', divisionLevel: 2, divisionLabel: 'Sélections africaines', hasStandings: true, apiFootballLeagueId: 6 },
  { id: 'fifa.world', name: 'Coupe du monde FIFA', shortName: 'Coupe du monde', country: 'International', region: 'international', category: 'international', divisionLevel: 1, divisionLabel: 'Mondial', hasStandings: true, apiFootballLeagueId: 1 },
  { id: 'mli.1', name: 'Championnat du Mali (Ligue 1)', shortName: 'Ligue 1 Mali', country: 'Mali', region: 'africa', category: 'africa', divisionLevel: 1, divisionLabel: '1re division', hasStandings: true, requiresApiFootball: true, apiFootballLeagueId: 400 },
];

export function mapEspnStatus(statusObj: any): {
  status: MatchStatus;
  statusText: string;
  minuteDisplay: string;
  isExtraTime: boolean;
  isPenalties: boolean;
} {
  const type = statusObj?.type || {};
  const state = type.state || 'pre';
  const name = String(type.name || '');
  const desc = String(type.description || '');
  const detail = String(type.shortDetail || type.detail || '');
  const clock = String(statusObj?.displayClock || '');

  const isExtraTime = /ET|AET|EXTRA/i.test(name) || /ET|AET/i.test(detail);
  const isPenalties = /PEN|SHOOTOUT/i.test(name) || /PEN/i.test(detail);

  if (state === 'in') {
    let statusText = 'En direct';
    if (name.includes('HALFTIME') || /HT/i.test(detail)) {
      statusText = 'Mi-temps';
    } else if (isPenalties) {
      statusText = 'Tirs au but';
    } else if (isExtraTime) {
      statusText = 'Prolongations';
    }
    const minuteDisplay = clock && clock !== "0'" ? clock : detail && detail !== 'Halftime' ? detail : statusText;
    return { status: 'live', statusText, minuteDisplay, isExtraTime, isPenalties };
  }

  if (state === 'post' || type.completed) {
    let statusText = 'Terminé';
    if (isPenalties) statusText = 'Terminé (TAB)';
    else if (isExtraTime) statusText = 'Terminé (AP)';
    if (name.includes('POSTPONED') || desc.toLowerCase().includes('postponed')) {
      return { status: 'postponed', statusText: 'Reporté', minuteDisplay: 'Reporté', isExtraTime: false, isPenalties: false };
    }
    return { status: 'finished', statusText, minuteDisplay: isPenalties ? 'TAB' : isExtraTime ? 'AP' : 'FT', isExtraTime, isPenalties };
  }

  if (name.includes('POSTPONED') || name.includes('CANCELED')) {
    return { status: 'postponed', statusText: 'Reporté', minuteDisplay: 'Reporté', isExtraTime: false, isPenalties: false };
  }

  return { status: 'upcoming', statusText: 'À venir', minuteDisplay: '', isExtraTime: false, isPenalties: false };
}

export function parseEspnEventToMatch(event: any, compDef: CompetitionCatalogDef): MatchItem | null {
  const comp = event?.competitions?.[0];
  if (!comp || !Array.isArray(comp.competitors) || comp.competitors.length < 2) return null;

  const homeComp = comp.competitors.find((c: any) => c.homeAway === 'home') || comp.competitors[0];
  const awayComp = comp.competitors.find((c: any) => c.homeAway === 'away') || comp.competitors[1];

  const mappedStatus = mapEspnStatus(comp.status || event.status);

  const parseScore = (c: any): number | null => {
    if (mappedStatus.status === 'upcoming' || mappedStatus.status === 'postponed') return null;
    const raw = c?.score;
    const val = typeof raw === 'object' ? raw?.displayValue ?? raw?.value : raw;
    if (val === undefined || val === null || val === '') return null;
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
  };

  const parsePen = (c: any): number | null => {
    const s = c?.shootoutScore;
    if (s === undefined || s === null || s === '') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  const details = Array.isArray(comp.details) ? comp.details : [];
  let redCardsCount = 0;
  let yellowCardsCount = 0;
  let substitutionsCount = 0;
  for (const d of details) {
    const t = String(d?.type?.type || d?.type?.text || '').toLowerCase();
    if (d?.redCard || t.includes('red')) redCardsCount += 1;
    else if (d?.yellowCard || t.includes('yellow')) yellowCardsCount += 1;
    else if (t.includes('substitution')) substitutionsCount += 1;
  }

  return {
    id: String(event.id),
    competitionId: compDef.id,
    competitionName: compDef.name,
    country: compDef.country,
    divisionLabel: compDef.divisionLabel,
    dateIso: String(event.date || comp.date || new Date().toISOString()),
    status: mappedStatus.status,
    statusText: mappedStatus.statusText,
    minuteDisplay: mappedStatus.minuteDisplay,
    isExtraTime: mappedStatus.isExtraTime,
    isPenalties: mappedStatus.isPenalties,
    venue: comp.venue?.fullName || undefined,
    sourceProvider: 'espn',
    summaryCounters:
      details.length > 0
        ? { redCards: redCardsCount, yellowCards: yellowCardsCount, substitutions: substitutionsCount }
        : undefined,
    home: {
      id: String(homeComp.team?.id || homeComp.id),
      name: String(homeComp.team?.displayName || homeComp.team?.name || 'Équipe domicile'),
      shortName: String(homeComp.team?.shortDisplayName || homeComp.team?.name || 'Domicile'),
      abbreviation: String(homeComp.team?.abbreviation || 'DOM'),
      logo: String(homeComp.team?.logo || homeComp.team?.logos?.[0]?.href || ''),
      score: parseScore(homeComp),
      penaltyScore: parsePen(homeComp),
      winner: Boolean(homeComp.winner),
      form: typeof homeComp.form === 'string' ? homeComp.form : undefined,
    },
    away: {
      id: String(awayComp.team?.id || awayComp.id),
      name: String(awayComp.team?.displayName || awayComp.team?.name || 'Équipe extérieure'),
      shortName: String(awayComp.team?.shortDisplayName || awayComp.team?.name || 'Extérieur'),
      abbreviation: String(awayComp.team?.abbreviation || 'EXT'),
      logo: String(awayComp.team?.logo || awayComp.team?.logos?.[0]?.href || ''),
      score: parseScore(awayComp),
      penaltyScore: parsePen(awayComp),
      winner: Boolean(awayComp.winner),
      form: typeof awayComp.form === 'string' ? awayComp.form : undefined,
    },
  };
}

function mapStatLabelFr(name: string): string | null {
  const map: Record<string, string> = {
    possessionPct: 'Possession du ballon (%)',
    totalShots: 'Tirs totaux',
    shotsOnTarget: 'Tirs cadrés',
    wonCorners: 'Corners',
    foulsCommitted: 'Fautes commises',
    offsides: 'Hors-jeu',
    yellowCards: 'Cartons jaunes',
    redCards: 'Cartons rouges',
    saves: 'Arrêts des gardiens',
  };
  return map[name] || null;
}

const STAT_ORDER = [
  'possessionPct',
  'totalShots',
  'shotsOnTarget',
  'wonCorners',
  'foulsCommitted',
  'offsides',
  'yellowCards',
  'redCards',
  'saves',
];

function translateEventType(rawType: string, text: string): { type: MatchEvent['type']; label: string; ignore?: boolean } {
  const t = rawType.toLowerCase();
  const txt = text.toLowerCase();
  if (t.includes('delay') || t === 'start-delay' || t === 'end-delay') {
    return { type: 'other', label: '', ignore: true };
  }
  if (t.includes('missed') || txt.includes('penalty missed')) {
    return { type: 'penalty-missed', label: 'Penalty manqué' };
  }
  if (t === 'goal' || t.includes('goal') || txt.includes('goal!')) {
    if (txt.includes('own goal')) return { type: 'own-goal', label: 'But contre son camp' };
    if (txt.includes('penalty') || txt.includes('converts the penalty')) return { type: 'penalty-goal', label: 'But sur penalty' };
    return { type: 'goal', label: 'But' };
  }
  if (t === 'red-card' || t === 'red card' || txt.includes('red card')) {
    return { type: 'red-card', label: 'Carton rouge' };
  }
  if (t === 'yellow-card' || t === 'yellow card' || txt.includes('yellow card')) {
    return { type: 'yellow-card', label: 'Carton jaune' };
  }
  if (t === 'substitution' || t.includes('substitution')) {
    return { type: 'substitution', label: 'Remplacement' };
  }
  if (t === 'kickoff') return { type: 'kickoff', label: "Coup d'envoi" };
  if (t === 'halftime') return { type: 'halftime', label: 'Mi-temps' };
  if (t === 'start-2nd-half') return { type: 'second-half', label: 'Début de la 2e mi-temps' };
  if (t === 'end-regular-time' || t === 'end-match' || t === 'fulltime') {
    return { type: 'fulltime', label: 'Fin du match' };
  }
  return { type: 'other', label: '', ignore: true };
}

function parseLineupsAndPlayerStats(
  sum: any,
  homeId: string,
  awayId: string
): {
  lineups: { home: TeamLineup | null; away: TeamLineup | null };
  playerStats: PlayerMatchStat[];
} {
  const rosters = Array.isArray(sum?.rosters) ? sum.rosters : [];
  const playerStats: PlayerMatchStat[] = [];

  const toTeamLineup = (r: any): TeamLineup | null => {
    if (!r || !Array.isArray(r.roster) || r.roster.length === 0) return null;
    const starters: LineupPlayer[] = [];
    const substitutes: LineupPlayer[] = [];
    const teamId = String(r.team?.id || '');
    const teamName = String(r.team?.displayName || '');

    for (const p of r.roster) {
      const playerId = String(p.athlete?.id || `${teamId}-${p.jersey || Math.random()}`);
      const name = String(p.athlete?.displayName || p.athlete?.shortName || 'Joueur');
      const jersey = String(p.jersey || '');
      const position = String(p.position?.abbreviation || p.position?.displayName || '');

      const player: LineupPlayer = {
        id: playerId,
        name,
        jersey,
        position,
        starter: Boolean(p.starter),
        subbedIn: Boolean(p.subbedIn),
        subbedOut: Boolean(p.subbedOut),
      };
      if (player.starter) starters.push(player);
      else substitutes.push(player);

      // Extract real player-level boxscore stats when present (never fabricate missing numbers)
      const statEntries = Array.isArray(p.stats) ? p.stats : [];
      if (statEntries.length > 0) {
        const sMap = new Map<string, number>();
        for (const st of statEntries) {
          const val = Number(st?.value);
          if (Number.isFinite(val)) {
            sMap.set(String(st.name || st.abbreviation || ''), val);
          }
        }
        const goals = sMap.get('totalGoals') ?? sMap.get('goals');
        const assists = sMap.get('goalAssists') ?? sMap.get('assists');
        const shots = sMap.get('totalShots') ?? sMap.get('shots');
        const shotsOnTarget = sMap.get('shotsOnTarget');
        const yellowCards = sMap.get('yellowCards');
        const redCards = sMap.get('redCards');
        const saves = sMap.get('saves');

        if (
          goals !== undefined ||
          assists !== undefined ||
          shots !== undefined ||
          yellowCards !== undefined ||
          redCards !== undefined ||
          saves !== undefined
        ) {
          playerStats.push({
            playerId,
            name,
            teamId,
            teamName,
            position: position || undefined,
            jersey: jersey || undefined,
            goals,
            assists,
            shots,
            shotsOnTarget,
            yellowCards,
            redCards,
            saves,
          });
        }
      }
    }

    return {
      teamId,
      teamName,
      formation: String(r.formation || ''),
      starters,
      substitutes,
    };
  };

  let home: TeamLineup | null = null;
  let away: TeamLineup | null = null;

  for (const r of rosters) {
    const tid = String(r.team?.id || '');
    if (r.homeAway === 'home' || tid === homeId) home = toTeamLineup(r);
    else if (r.homeAway === 'away' || tid === awayId) away = toTeamLineup(r);
  }
  if (!home && rosters[0]) home = toTeamLineup(rosters[0]);
  if (!away && rosters[1]) away = toTeamLineup(rosters[1]);
  return { lineups: { home, away }, playerStats };
}

export function getPriorEspnSeasons(now: Date = new Date()): number[] {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-indexed: July=6, August=7
  const currentSeasonStart = month >= 7 ? year : year - 1;
  return [currentSeasonStart - 1, currentSeasonStart - 2];
}

export function parseEspnSummaryToDetail(
  sum: any,
  compDef: CompetitionCatalogDef,
  matchId: string,
  homeSched?: any | any[]
): MatchDetailResponse | null {
  const headerEvent = sum?.header;
  const comp = headerEvent?.competitions?.[0];
  if (!comp) return null;

  const match = parseEspnEventToMatch(
    { id: headerEvent.id || matchId, date: comp.date, competitions: [comp], status: comp.status },
    compDef
  );
  if (!match) return null;

  const rawKeyEvents = Array.isArray(sum?.keyEvents)
    ? sum.keyEvents
    : Array.isArray(comp?.details)
    ? comp.details
    : [];

  const events: MatchEvent[] = rawKeyEvents
    .map((ev: any, idx: number): MatchEvent | null => {
      const rawType = String(ev?.type?.type || ev?.type?.text || (ev.scoringPlay ? 'goal' : ev.redCard ? 'red-card' : 'other'));
      const text = String(ev?.text || ev?.shortText || '');
      const translated = translateEventType(rawType, text);
      if (translated.ignore) return null;
      const participants = Array.isArray(ev?.participants) ? ev.participants : [];
      const mainPlayer = String(participants[0]?.athlete?.displayName || '');
      const secondPlayer = String(participants[1]?.athlete?.displayName || '');
      const evTeamId = String(ev?.team?.id || '');

      return {
        id: String(ev?.id || `ev-${idx}`),
        type: translated.type,
        minute: String(ev?.clock?.displayValue || ''),
        period: Number(ev?.period?.number || 1),
        teamId: evTeamId,
        teamName: String(ev?.team?.displayName || ''),
        isHome: evTeamId ? evTeamId === match.home.id : undefined,
        player: mainPlayer ? (translated.type === 'penalty-missed' ? `${mainPlayer} (${translated.label})` : mainPlayer) : translated.label,
        assistOrOut: secondPlayer || undefined,
        description: text || translated.label,
      };
    })
    .filter((ev: MatchEvent | null): ev is MatchEvent => Boolean(ev));

  const boxTeams = Array.isArray(sum?.boxscore?.teams) ? sum.boxscore.teams : [];
  const homeBox = boxTeams.find((t: any) => String(t.team?.id) === match.home.id || t.homeAway === 'home') || boxTeams[0];
  const awayBox = boxTeams.find((t: any) => String(t.team?.id) === match.away.id || t.homeAway === 'away') || boxTeams[1];

  const homeStatsMap = new Map<string, string>(
    (homeBox?.statistics || []).map((s: any) => [String(s.name), String(s.displayValue ?? '0')])
  );
  const awayStatsMap = new Map<string, string>(
    (awayBox?.statistics || []).map((s: any) => [String(s.name), String(s.displayValue ?? '0')])
  );

  const statistics: StatPair[] = [];
  for (const statKey of STAT_ORDER) {
    const label = mapStatLabelFr(statKey);
    if (!label) continue;
    const hv = homeStatsMap.get(statKey);
    const av = awayStatsMap.get(statKey);
    if (hv === undefined && av === undefined) continue;
    const hVal = hv ?? '0';
    const aVal = av ?? '0';
    statistics.push({
      key: statKey,
      label,
      homeValue: statKey === 'possessionPct' && !hVal.includes('%') ? `${hVal}%` : hVal,
      awayValue: statKey === 'possessionPct' && !aVal.includes('%') ? `${aVal}%` : aVal,
      homeNumeric: Number.parseFloat(hVal) || 0,
      awayNumeric: Number.parseFloat(aVal) || 0,
    });
  }

  const { lineups, playerStats } = parseLineupsAndPlayerStats(sum, match.home.id, match.away.id);

  const h2hRecords: H2HMatchRecord[] = [];
  const schedList = Array.isArray(homeSched) ? homeSched : homeSched ? [homeSched] : [];
  const seenH2HIds = new Set<string>();

  for (const schedObj of schedList) {
    const schedEvents = Array.isArray(schedObj?.events) ? schedObj.events : [];
    for (const se of schedEvents) {
      const seId = String(se?.id || '');
      if (!seId || seId === match.id || seenH2HIds.has(seId)) continue;
      const seComp = se?.competitions?.[0];
      if (!seComp || !seComp.status?.type?.completed) continue;
      const comps = Array.isArray(seComp.competitors) ? seComp.competitors : [];
      const hasAway = comps.some((c: any) => String(c.team?.id) === match.away.id);
      if (!hasAway) continue;

      seenH2HIds.add(seId);
      const hc = comps.find((c: any) => c.homeAway === 'home') || comps[0];
      const ac = comps.find((c: any) => c.homeAway === 'away') || comps[1];
      const hs = Number(hc?.score?.value ?? hc?.score?.displayValue ?? 0);
      const as = Number(ac?.score?.value ?? ac?.score?.displayValue ?? 0);
      h2hRecords.push({
        id: seId,
        dateIso: String(se.date),
        competitionName: String(se?.league?.shortName || se?.league?.name || se.season?.displayName || compDef.name),
        homeTeamId: String(hc?.team?.id || ''),
        awayTeamId: String(ac?.team?.id || ''),
        homeName: String(hc?.team?.displayName || 'Domicile'),
        awayName: String(ac?.team?.displayName || 'Extérieur'),
        homeScore: hs,
        awayScore: as,
        winnerSide: hs > as ? 'home' : as > hs ? 'away' : 'draw',
      });
    }
  }

  return {
    match,
    events,
    statistics,
    lineups,
    playerStats: playerStats.length > 0 ? playerStats : undefined,
    h2h: computeH2HSummary(h2hRecords, match.home.name, match.away.name, match.home.id, match.away.id),
    provider: 'Flux Officiel Live',
    lastRealUpdateIso: new Date().toISOString(),
  };
}

export function parseEspnStandings(data: any, compDef: CompetitionCatalogDef): {
  competition: CompetitionCatalogDef;
  season: string;
  tables: { groupName: string; rows: StandingRow[] }[];
} {
  const groups = Array.isArray(data?.children) && data.children.length > 0
    ? data.children
    : data?.standings
    ? [{ name: compDef.name, standings: data.standings }]
    : [];

  const tables = groups.map((g: any) => {
    const entries = Array.isArray(g?.standings?.entries) ? g.standings.entries : [];
    const rows: StandingRow[] = entries.map((entry: any, idx: number) => {
      const stats = new Map<string, number>(
        (entry.stats || []).map((s: any) => [String(s.name), Number(s.value ?? s.displayValue ?? 0)])
      );
      return {
        rank: stats.get('rank') || idx + 1,
        teamId: String(entry.team?.id || idx),
        teamName: String(entry.team?.displayName || entry.team?.name || 'Club'),
        teamLogo: String(entry.team?.logos?.[0]?.href || ''),
        played: stats.get('gamesPlayed') || 0,
        wins: stats.get('wins') || 0,
        draws: stats.get('ties') || 0,
        losses: stats.get('losses') || 0,
        goalsFor: stats.get('pointsFor') || 0,
        goalsAgainst: stats.get('pointsAgainst') || 0,
        goalDifference: stats.get('pointDifferential') || 0,
        points: stats.get('points') || 0,
        note: entry.note?.description ? String(entry.note.description) : undefined,
      };
    });
    return {
      groupName: String(g.name || compDef.name),
      rows,
    };
  });

  return {
    competition: compDef,
    season: data?.season?.displayName || '',
    tables,
  };
}

export function parseEspnNewsArticles(articlesRaw: any[], leagueLabel: string): NewsArticle[] {
  return articlesRaw.map((a: any): NewsArticle => ({
    id: String(a.dataSourceIdentifier || a.id || a.headline),
    title: String(a.headline || ''),
    summary: String(a.description || ''),
    imageUrl: String(a.images?.[0]?.url || ''),
    publishedAt: String(a.published || new Date().toISOString()),
    source: 'ESPN Soccer',
    url: String(a.links?.web?.href || a.links?.mobile?.href || 'https://www.espn.com/soccer/'),
    league: leagueLabel,
  }));
}
