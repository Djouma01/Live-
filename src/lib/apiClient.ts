import {
  COMPETITION_CATALOG,
  ESPN_BASE,
  ESPN_STANDINGS_BASE,
  getPriorEspnSeasons,
  parseEspnEventToMatch,
  parseEspnNewsArticles,
  parseEspnStandings,
  parseEspnSummaryToDetail,
} from './espn.ts';
import {
  computeMatchesDataSignature,
  groupCompetitionsByCountryAndDivision,
  type CompetitionInfo,
  type CountryGroupInfo,
  type MatchDetailResponse,
  type MatchItem,
  type NewsArticle,
  type PlayerProfileInfo,
  type StandingRow,
} from './football.ts';
import {
  extractTransferItemsFromEspnArticles,
  mergeAndSortTransfers,
  parseEspnTransactionsToTransfers,
  type MatchTransfersResponse,
  type TransferItem,
} from './transfers.ts';
import { parseEspnAthleteOverviewToProfile } from './playerStats.ts';

export function getApiBaseUrl(): string {
  try {
    const envBase = (import.meta as any)?.env?.VITE_API_BASE_URL;
    if (typeof envBase === 'string' && envBase.trim()) {
      return envBase.trim().replace(/\/+$/, '');
    }
  } catch {
    // Ignore when running outside Vite
  }
  return '';
}

export function isJsonResponse(res: Response): boolean {
  const ct = res.headers.get('content-type') || '';
  return ct.toLowerCase().includes('application/json');
}

async function tryBackendJson<T>(path: string): Promise<T | null> {
  const base = getApiBaseUrl();
  try {
    const res = await fetch(`${base}${path}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok || !isJsonResponse(res)) {
      return null;
    }
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function fetchDirectJson<T>(url: string): Promise<T> {
  // Simple GET without custom headers avoids CORS preflight issues
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Fournisseur sportif indisponible (HTTP ${res.status})`);
  }
  return (await res.json()) as T;
}

export async function fetchCompetitionsApi(): Promise<{
  competitions: CompetitionInfo[];
  providerName: string;
  hasApiFootballKey: boolean;
  sportradarConfigured?: boolean;
}> {
  const backend = await tryBackendJson<{
    competitions: CompetitionInfo[];
    providerName: string;
    hasApiFootballKey: boolean;
    sportradarConfigured?: boolean;
  }>('/api/competitions');
  if (backend) return backend;

  // Fallback direct client-side (static host without backend Node)
  const priorityFallback = COMPETITION_CATALOG.slice(0, 16);
  const checks = await Promise.all(
    priorityFallback.map(async (def): Promise<CompetitionInfo> => {
      if (def.requiresApiFootball) {
        return {
          id: def.id,
          name: def.name,
          shortName: def.shortName,
          country: def.country,
          region: def.region,
          category: def.category,
          divisionLevel: def.divisionLevel,
          divisionLabel: def.divisionLabel,
          available: false,
          hasStandings: def.hasStandings,
          providerNote: 'Requiert le serveur backend avec API_FOOTBALL_KEY ou SPORTRADAR_API_KEY.',
        };
      }
      try {
        const data = await fetchDirectJson<any>(`${ESPN_BASE}/${def.id}/scoreboard`);
        const leagueObj = data?.leagues?.[0];
        return {
          id: def.id,
          name: def.name,
          shortName: def.shortName,
          country: def.country,
          region: def.region,
          category: def.category,
          divisionLevel: def.divisionLevel,
          divisionLabel: def.divisionLabel,
          available: Boolean(leagueObj),
          hasStandings: def.hasStandings,
          logo: leagueObj?.logos?.[0]?.href || undefined,
        };
      } catch {
        return {
          id: def.id,
          name: def.name,
          shortName: def.shortName,
          country: def.country,
          region: def.region,
          category: def.category,
          divisionLevel: def.divisionLevel,
          divisionLabel: def.divisionLabel,
          available: false,
          hasStandings: def.hasStandings,
          providerNote: 'Temporairement indisponible auprès du fournisseur de données.',
        };
      }
    })
  );

  return {
    competitions: checks,
    providerName: 'Flux Officiel Live (ESPN Soccer)',
    hasApiFootballKey: false,
    sportradarConfigured: false,
  };
}

export async function fetchCountriesApi(): Promise<{
  countries: CountryGroupInfo[];
  providerName: string;
  sportradarConfigured?: boolean;
}> {
  const backend = await tryBackendJson<{
    countries: CountryGroupInfo[];
    providerName: string;
    sportradarConfigured?: boolean;
  }>('/api/countries');
  if (backend) return backend;

  const fallback = await fetchCompetitionsApi();
  return {
    countries: groupCompetitionsByCountryAndDivision(fallback.competitions),
    providerName: fallback.providerName,
    sportradarConfigured: fallback.sportradarConfigured,
  };
}

export async function fetchMatchesApi(
  dateYmd: string,
  competitionFilter: string
): Promise<{
  matches: MatchItem[];
  stale?: boolean;
  providerName?: string;
  sportradarConfigured?: boolean;
  lastRealUpdateIso?: string;
  dataSignature?: string;
}> {
  const backend = await tryBackendJson<{
    matches: MatchItem[];
    stale?: boolean;
    providerName?: string;
    sportradarConfigured?: boolean;
    lastRealUpdateIso?: string;
    dataSignature?: string;
  }>(
    `/api/matches?date=${encodeURIComponent(dateYmd)}&competition=${encodeURIComponent(competitionFilter)}`
  );
  if (backend) return backend;

  const espnDate = dateYmd.replace(/-/g, '');
  const targetDefs = COMPETITION_CATALOG.filter(
    (c) => !c.requiresApiFootball && (competitionFilter === 'all' || c.id === competitionFilter)
  ).slice(0, competitionFilter === 'all' ? 18 : 1);

  const batches = await Promise.all(
    targetDefs.map(async (def) => {
      try {
        const data = await fetchDirectJson<any>(`${ESPN_BASE}/${def.id}/scoreboard?dates=${espnDate}`);
        const events = Array.isArray(data?.events) ? data.events : [];
        return events
          .map((ev: any) => parseEspnEventToMatch(ev, def))
          .filter((m: MatchItem | null): m is MatchItem => Boolean(m));
      } catch {
        return [] as MatchItem[];
      }
    })
  );

  const matches = batches.flat();
  return {
    matches,
    stale: false,
    providerName: 'Flux Officiel Live (ESPN Soccer)',
    sportradarConfigured: false,
    lastRealUpdateIso: new Date().toISOString(),
    dataSignature: computeMatchesDataSignature(matches),
  };
}

export async function fetchMatchDetailApi(
  competitionId: string,
  matchId: string
): Promise<MatchDetailResponse> {
  const backend = await tryBackendJson<MatchDetailResponse>(
    `/api/matches/${encodeURIComponent(competitionId)}/${encodeURIComponent(matchId)}`
  );
  if (backend) return backend;

  const compDef = COMPETITION_CATALOG.find((c) => c.id === competitionId);
  if (!compDef || compDef.requiresApiFootball) {
    throw new Error('Détails du match indisponibles.');
  }

  const sum = await fetchDirectJson<any>(
    `${ESPN_BASE}/${competitionId}/summary?event=${encodeURIComponent(matchId)}`
  );
  const comp = sum?.header?.competitions?.[0];
  const homeId = comp?.competitors?.find((c: any) => c.homeAway === 'home')?.team?.id;

  let homeSchedules: any[] = [];
  if (homeId) {
    const seasons: (number | null)[] = [null, ...getPriorEspnSeasons()];
    const settled = await Promise.allSettled(
      seasons.map((season) =>
        fetchDirectJson<any>(
          `${ESPN_BASE}/all/teams/${encodeURIComponent(String(homeId))}/schedule${season ? `?season=${season}` : ''}`
        )
      )
    );
    homeSchedules = settled
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
      .map((r) => r.value);
  }

  const detail = parseEspnSummaryToDetail(sum, compDef, matchId, homeSchedules);
  if (!detail) {
    throw new Error('Détails du match introuvables.');
  }
  return detail;
}

export async function fetchStandingsApi(competitionId: string): Promise<{
  season: string;
  tables: { groupName: string; rows: StandingRow[] }[];
  stale?: boolean;
}> {
  const backend = await tryBackendJson<{
    season: string;
    tables: { groupName: string; rows: StandingRow[] }[];
    stale?: boolean;
  }>(`/api/standings/${encodeURIComponent(competitionId)}`);
  if (backend) return backend;

  const compDef = COMPETITION_CATALOG.find((c) => c.id === competitionId);
  if (!compDef || compDef.requiresApiFootball) {
    throw new Error('Classement indisponible pour cette compétition.');
  }
  const data = await fetchDirectJson<any>(`${ESPN_STANDINGS_BASE}/${competitionId}/standings`);
  const parsed = parseEspnStandings(data, compDef);
  return { season: parsed.season, tables: parsed.tables, stale: false };
}

export async function fetchTeamDetailApi(
  competitionId: string,
  teamId: string
): Promise<{
  team: { id: string; name: string; logo?: string; venue?: string; country?: string };
  players: PlayerProfileInfo[];
  matches: MatchItem[];
}> {
  const backend = await tryBackendJson<{
    team: { id: string; name: string; logo?: string; venue?: string; country?: string };
    players: PlayerProfileInfo[];
    matches: MatchItem[];
  }>(`/api/teams/${encodeURIComponent(competitionId)}/${encodeURIComponent(teamId)}`);
  if (backend) return backend;

  const matches = await fetchTeamMatchesApi(competitionId, teamId);
  return {
    team: {
      id: teamId,
      name: matches[0]?.home.id === teamId ? matches[0].home.name : matches[0]?.away.name || 'Club',
    },
    players: [],
    matches,
  };
}

export async function fetchPlayerProfileApi(
  playerId: string,
  competitionId?: string
): Promise<PlayerProfileInfo | null> {
  const qs = competitionId ? `?competition=${encodeURIComponent(competitionId)}` : '';
  const backend = await tryBackendJson<{ player: PlayerProfileInfo }>(
    `/api/players/${encodeURIComponent(playerId)}${qs}`
  );
  if (backend?.player) return backend.player;

  if (playerId.startsWith('sr:player:')) return null;
  const leagueSlug =
    competitionId && !competitionId.startsWith('sr:') && !competitionId.startsWith('af-')
      ? competitionId
      : 'eng.1';
  try {
    const [athleteRes, overviewRes] = await Promise.allSettled([
      fetchDirectJson<any>(
        `https://site.web.api.espn.com/apis/common/v3/sports/soccer/${encodeURIComponent(leagueSlug)}/athletes/${encodeURIComponent(playerId)}`
      ),
      fetchDirectJson<any>(
        `https://site.web.api.espn.com/apis/common/v3/sports/soccer/${encodeURIComponent(leagueSlug)}/athletes/${encodeURIComponent(playerId)}/overview`
      ),
    ]);
    const athleteData = athleteRes.status === 'fulfilled' ? athleteRes.value : null;
    const overviewData = overviewRes.status === 'fulfilled' ? overviewRes.value : null;
    return parseEspnAthleteOverviewToProfile(athleteData, overviewData, { id: playerId });
  } catch {
    return null;
  }
}

export async function fetchTeamMatchesApi(
  competitionId: string,
  teamId: string
): Promise<MatchItem[]> {
  const backend = await tryBackendJson<{ matches: MatchItem[] }>(
    `/api/team/${encodeURIComponent(competitionId)}/${encodeURIComponent(teamId)}/matches`
  );
  if (backend) return Array.isArray(backend.matches) ? backend.matches : [];

  const compDef = COMPETITION_CATALOG.find((c) => c.id === competitionId) || COMPETITION_CATALOG[0];
  try {
    const data = await fetchDirectJson<any>(
      `${ESPN_BASE}/all/teams/${encodeURIComponent(teamId)}/schedule`
    );
    const events = Array.isArray(data?.events) ? data.events : [];
    return events
      .map((ev: any) => {
        const slug = ev?.league?.slug;
        const evCompDef = COMPETITION_CATALOG.find((c) => c.id === slug) || compDef;
        return parseEspnEventToMatch(ev, evCompDef);
      })
      .filter((m: MatchItem | null): m is MatchItem => Boolean(m));
  } catch {
    return [];
  }
}

export async function fetchNewsApi(): Promise<NewsArticle[]> {
  const backend = await tryBackendJson<{ articles: NewsArticle[] }>('/api/news');
  if (backend) return Array.isArray(backend.articles) ? backend.articles : [];

  const endpoints = [
    { code: 'fifa.world', label: 'International' },
    { code: 'uefa.champions', label: 'Ligue des champions' },
    { code: 'eng.1', label: 'Premier League' },
    { code: 'fra.1', label: 'Ligue 1' },
  ];

  const results = await Promise.all(
    endpoints.map(async (ep) => {
      try {
        const data = await fetchDirectJson<any>(`${ESPN_BASE}/${ep.code}/news?limit=8`);
        const articles = Array.isArray(data?.articles) ? data.articles : [];
        return parseEspnNewsArticles(articles, ep.label);
      } catch {
        return [] as NewsArticle[];
      }
    })
  );

  const seen = new Set<string>();
  const all: NewsArticle[] = [];
  for (const art of results.flat()) {
    if (!art.title || seen.has(art.title)) continue;
    seen.add(art.title);
    all.push(art);
  }
  all.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  return all.slice(0, 24);
}

export async function fetchMatchTransfersApi(params: {
  competitionId: string;
  homeId: string;
  homeName: string;
  homeShortName: string;
  awayId: string;
  awayName: string;
  awayShortName: string;
}): Promise<MatchTransfersResponse> {
  const qs = new URLSearchParams({
    competition: params.competitionId,
    homeId: params.homeId,
    homeName: params.homeName,
    homeShortName: params.homeShortName,
    awayId: params.awayId,
    awayName: params.awayName,
    awayShortName: params.awayShortName,
  });

  const backend = await tryBackendJson<MatchTransfersResponse>(`/api/transfers?${qs.toString()}`);
  if (backend) {
    return {
      items: Array.isArray(backend.items) ? backend.items : [],
      sourceName: backend.sourceName || 'ESPN Transfer Talk',
    };
  }

  const urls = [`${ESPN_BASE}/all/news?limit=50`];
  if (params.homeId && !params.homeId.startsWith('af-') && !params.homeId.startsWith('sr:')) {
    urls.push(`${ESPN_BASE}/all/news?team=${encodeURIComponent(params.homeId)}&limit=15`);
  }
  if (params.awayId && !params.awayId.startsWith('af-') && !params.awayId.startsWith('sr:')) {
    urls.push(`${ESPN_BASE}/all/news?team=${encodeURIComponent(params.awayId)}&limit=15`);
  }

  const [newsSettled, txRes] = await Promise.all([
    Promise.allSettled(urls.map((u) => fetchDirectJson<any>(u))),
    !params.competitionId.startsWith('sr:')
      ? fetchDirectJson<any>(
          `${ESPN_BASE}/${encodeURIComponent(params.competitionId)}/transactions?limit=30`
        ).catch(() => null)
      : Promise.resolve(null),
  ]);

  const rawArticles: any[] = [];
  for (const r of newsSettled) {
    if (r.status === 'fulfilled' && Array.isArray(r.value?.articles)) {
      rawArticles.push(...r.value.articles);
    }
  }

  const ctx = {
    homeId: params.homeId,
    homeName: params.homeName,
    homeShortName: params.homeShortName,
    awayId: params.awayId,
    awayName: params.awayName,
    awayShortName: params.awayShortName,
  };

  const collected: TransferItem[] = [
    ...extractTransferItemsFromEspnArticles(rawArticles, ctx),
    ...(txRes && Array.isArray(txRes.transactions)
      ? parseEspnTransactionsToTransfers(txRes.transactions, ctx)
      : []),
  ];

  return {
    items: mergeAndSortTransfers(collected),
    sourceName: 'ESPN Transfer Talk',
  };
}
