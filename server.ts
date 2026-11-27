import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  computeMatchesDataSignature,
  groupCompetitionsByCountryAndDivision,
  type CompetitionInfo,
  type MatchItem,
  type MatchStatus,
  type NewsArticle,
  type PlayerProfileInfo,
} from './src/lib/football.ts';
import {
  COMPETITION_CATALOG,
  ESPN_BASE,
  ESPN_STANDINGS_BASE,
  getPriorEspnSeasons,
  parseEspnEventToMatch,
  parseEspnNewsArticles,
  parseEspnStandings,
  parseEspnSummaryToDetail,
} from './src/lib/espn.ts';
import {
  getSportradarBaseUrl,
  parseSportradarCompetitions,
  parseSportradarPlayerProfile,
  parseSportradarStandings,
  parseSportradarSummaryToMatch,
  parseSportradarTimelineToDetail,
} from './src/lib/sportradar.ts';
import {
  extractTransferItemsFromEspnArticles,
  mergeAndSortTransfers,
  parseEspnTransactionsToTransfers,
  type TransferItem,
} from './src/lib/transfers.ts';
import {
  parseEspnAthleteOverviewToProfile,
  parseEspnRosterAthlete,
} from './src/lib/playerStats.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

// Shared TTL + In-Flight Coalescing + Stale-on-error Cache to protect Sportradar/API limits
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  updatedAt: number;
}
const cache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<{ data: unknown; stale: boolean }>>();
let rateLimitedUntil = 0;

// Sliding-window IP protection against abuse / excessive requests
const ipRequestLog = new Map<string, { count: number; resetAt: number }>();

function allowClientIp(ip: string, limitPerMinute = 180): boolean {
  const now = Date.now();
  const entry = ipRequestLog.get(ip);
  if (!entry || now > entry.resetAt) {
    ipRequestLog.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= limitPerMinute) return false;
  entry.count += 1;
  return true;
}

class ApiHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  async function next() {
    while (idx < items.length) {
      const curr = idx;
      idx += 1;
      results[curr] = await worker(items[curr]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, Math.max(items.length, 1)) }, () => next()));
  return results;
}

async function fetchJsonWithCache<T>(
  key: string,
  url: string,
  ttlMs: number,
  headers?: Record<string, string>
): Promise<{ data: T; stale: boolean }> {
  const now = Date.now();
  const existing = cache.get(key) as CacheEntry<T> | undefined;
  if (existing && now < existing.expiresAt) {
    return { data: existing.data, stale: false };
  }

  if (now < rateLimitedUntil && existing) {
    return { data: existing.data, stale: true };
  }

  const pending = inFlight.get(key);
  if (pending) {
    return pending as Promise<{ data: T; stale: boolean }>;
  }

  const task = (async (): Promise<{ data: T; stale: boolean }> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'DjoumaFootLive/2.0',
          ...headers,
        },
      });

      if (res.status === 429) {
        const retryHeader = Number(res.headers.get('retry-after') || '60');
        rateLimitedUntil = Date.now() + (Number.isFinite(retryHeader) ? retryHeader : 60) * 1000;
        if (existing) return { data: existing.data, stale: true };
        throw new ApiHttpError(429, 'Limite de requêtes API atteinte. Réessayez dans un instant.');
      }

      if (!res.ok) {
        if (existing) return { data: existing.data, stale: true };
        throw new ApiHttpError(res.status, `Fournisseur indisponible (HTTP ${res.status})`);
      }

      const data = (await res.json()) as T;
      cache.set(key, { data, expiresAt: Date.now() + ttlMs, updatedAt: Date.now() });
      return { data, stale: false };
    } catch (err) {
      if (existing) return { data: existing.data, stale: true };
      throw err;
    } finally {
      clearTimeout(timer);
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, task);
  return task;
}

async function fetchSportradarJson<T>(endpointPath: string, ttlMs: number): Promise<{ data: T; stale: boolean }> {
  const apiKey = process.env.SPORTRADAR_API_KEY;
  if (!apiKey) {
    throw new ApiHttpError(503, 'SPORTRADAR_API_KEY non configurée.');
  }
  const base = getSportradarBaseUrl(process.env.SPORTRADAR_ACCESS_LEVEL, 'fr');
  return fetchJsonWithCache<T>(
    `sr-${endpointPath}`,
    `${base}/${endpointPath}`,
    ttlMs,
    { 'x-api-key': apiKey }
  );
}

// Optional API-Football integration when user configures API_FOOTBALL_KEY
async function fetchApiFootballMaliMatches(dateYmd: string): Promise<MatchItem[]> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return [];
  try {
    const { data } = await fetchJsonWithCache<any>(
      `af-mali-${dateYmd}`,
      `https://v3.football.api-sports.io/fixtures?league=400&season=${dateYmd.slice(0, 4)}&date=${dateYmd}`,
      120_000,
      { 'x-apisports-key': key }
    );
    const list = Array.isArray(data?.response) ? data.response : [];
    return list.map((item: any): MatchItem => {
      const short = item.fixture?.status?.short || 'NS';
      const elapsed = item.fixture?.status?.elapsed;
      let status: MatchStatus = 'upcoming';
      let statusText = 'À venir';
      if (['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(short)) {
        status = 'live';
        statusText = short === 'HT' ? 'Mi-temps' : short === 'ET' ? 'Prolongations' : short === 'P' ? 'Tirs au but' : 'En direct';
      } else if (['FT', 'AET', 'PEN'].includes(short)) {
        status = 'finished';
        statusText = short === 'PEN' ? 'Terminé (TAB)' : short === 'AET' ? 'Terminé (AP)' : 'Terminé';
      }
      return {
        id: `af-${item.fixture?.id}`,
        competitionId: 'mli.1',
        competitionName: 'Championnat du Mali (Ligue 1)',
        country: 'Mali',
        divisionLabel: '1re division',
        dateIso: item.fixture?.date,
        status,
        statusText,
        minuteDisplay: elapsed ? `${elapsed}'` : '',
        isExtraTime: short === 'ET' || short === 'AET',
        isPenalties: short === 'P' || short === 'PEN',
        venue: item.fixture?.venue?.name || undefined,
        sourceProvider: 'api-football',
        home: {
          id: `af-${item.teams?.home?.id}`,
          name: item.teams?.home?.name || 'Domicile',
          shortName: item.teams?.home?.name || 'Domicile',
          abbreviation: (item.teams?.home?.name || 'DOM').slice(0, 3).toUpperCase(),
          logo: item.teams?.home?.logo || '',
          score: item.goals?.home ?? null,
        },
        away: {
          id: `af-${item.teams?.away?.id}`,
          name: item.teams?.away?.name || 'Extérieur',
          shortName: item.teams?.away?.name || 'Extérieur',
          abbreviation: (item.teams?.away?.name || 'EXT').slice(0, 3).toUpperCase(),
          logo: item.teams?.away?.logo || '',
          score: item.goals?.away ?? null,
        },
      };
    });
  } catch {
    return [];
  }
}

async function getAvailableCompetitions(): Promise<{
  competitions: CompetitionInfo[];
  providerName: string;
  sportradarConfigured: boolean;
  hasApiFootballKey: boolean;
  hasFootballDataKey: boolean;
}> {
  const sportradarConfigured = Boolean(process.env.SPORTRADAR_API_KEY);
  const hasApiFootballKey = Boolean(process.env.API_FOOTBALL_KEY);
  const hasFootballDataKey = Boolean(process.env.FOOTBALL_DATA_API_KEY);

  let sportradarCompetitions: CompetitionInfo[] = [];
  let sportradarActive = false;

  if (sportradarConfigured) {
    try {
      const { data } = await fetchSportradarJson<any>('competitions.json', 6 * 60 * 60_000);
      sportradarCompetitions = parseSportradarCompetitions(data);
      sportradarActive = sportradarCompetitions.length > 0;
    } catch {
      sportradarActive = false;
    }
  }

  // Always check ESPN / API-Football fallback catalog (concurrently bounded to 8)
  const fallbackChecks = await mapWithConcurrency(
    COMPETITION_CATALOG,
    8,
    async (def): Promise<CompetitionInfo> => {
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
          source: 'api-football',
          available: hasApiFootballKey,
          hasStandings: def.hasStandings,
          providerNote: hasApiFootballKey
            ? 'Connecté via API-Football'
            : 'Requiert API_FOOTBALL_KEY ou SPORTRADAR_API_KEY côté serveur.',
        };
      }

      try {
        const { data } = await fetchJsonWithCache<any>(
          `probe-${def.id}`,
          `${ESPN_BASE}/${def.id}/scoreboard`,
          15 * 60_000
        );
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
          source: 'espn',
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
          source: 'espn',
          available: false,
          hasStandings: def.hasStandings,
          providerNote: 'Temporairement indisponible auprès du fournisseur de données.',
        };
      }
    }
  );

  // When Sportradar is active, put all dynamic Sportradar competitions first and retain Mali/unique fallback items
  const combined = sportradarActive
    ? [
        ...sportradarCompetitions,
        ...fallbackChecks.filter(
          (fc) =>
            fc.id === 'mali-ligue-1' ||
            !sportradarCompetitions.some(
              (sc) => sc.country === fc.country && sc.name.toLowerCase() === fc.name.toLowerCase()
            )
        ),
      ]
    : fallbackChecks;

  const providerName = sportradarActive
    ? 'Sportradar Soccer v4'
    : hasApiFootballKey
    ? 'API-Football + Flux Officiel Live'
    : 'Flux Officiel Live (ESPN Soccer)';

  return {
    competitions: combined,
    providerName,
    sportradarConfigured,
    hasApiFootballKey,
    hasFootballDataKey,
  };
}

async function fetchMatchesUnified(
  dateParam: string,
  compFilter: string
): Promise<{
  matches: MatchItem[];
  stale: boolean;
  providerName: string;
  sportradarConfigured: boolean;
  partialErrors?: string[];
}> {
  const sportradarConfigured = Boolean(process.env.SPORTRADAR_API_KEY);
  const todayStr = new Date().toISOString().slice(0, 10);
  const ttl = dateParam === todayStr ? 15_000 : 120_000;

  let srMatches: MatchItem[] = [];
  let srStale = false;
  let srUsed = false;

  if (sportradarConfigured && !compFilter.includes('.')) {
    try {
      const [{ data: dateData, stale: dStale }, liveRes] = await Promise.all([
        fetchSportradarJson<any>(`schedules/${dateParam}/summaries.json`, ttl),
        dateParam === todayStr
          ? fetchSportradarJson<any>('schedules/live/summaries.json', 10_000).catch(() => null)
          : Promise.resolve(null),
      ]);
      srStale = dStale || Boolean(liveRes?.stale);
      const map = new Map<string, MatchItem>();
      const dateList = Array.isArray(dateData?.summaries) ? dateData.summaries : [];
      const liveList = Array.isArray(liveRes?.data?.summaries) ? liveRes.data.summaries : [];
      for (const s of [...dateList, ...liveList]) {
        const m = parseSportradarSummaryToMatch(s);
        if (!m) continue;
        if (compFilter !== 'all' && m.competitionId !== compFilter) continue;
        map.set(m.id, m);
      }
      srMatches = Array.from(map.values());
      srUsed = true;
    } catch {
      srUsed = false;
    }
  }

  // ESPN + API-Football (if Sportradar didn't return matches or specific ESPN competition requested)
  const shouldFetchFallback = !srUsed || compFilter === 'mli.1' || compFilter.includes('.');
  let fallbackMatches: MatchItem[] = [];
  let fallbackStale = false;
  const errors: string[] = [];

  if (shouldFetchFallback) {
    const espnDate = dateParam.replace(/-/g, '');
    const targetDefs = COMPETITION_CATALOG.filter(
      (c) => !c.requiresApiFootball && (compFilter === 'all' || c.id === compFilter)
    );

    const batches = await mapWithConcurrency(targetDefs, 8, async (def) => {
      try {
        const url = `${ESPN_BASE}/${def.id}/scoreboard?dates=${espnDate}`;
        const { data, stale } = await fetchJsonWithCache<any>(`sb-${def.id}-${espnDate}`, url, ttl);
        if (stale) fallbackStale = true;
        const events = Array.isArray(data?.events) ? data.events : [];
        return events
          .map((ev: any) => parseEspnEventToMatch(ev, def))
          .filter((m: MatchItem | null): m is MatchItem => Boolean(m));
      } catch (e: any) {
        errors.push(`${def.shortName}: ${e?.message || 'erreur'}`);
        return [] as MatchItem[];
      }
    });
    fallbackMatches = batches.flat();
  }

  let matches = srUsed ? [...srMatches, ...fallbackMatches] : fallbackMatches;
  if ((compFilter === 'all' || compFilter === 'mli.1') && process.env.API_FOOTBALL_KEY) {
    const maliMatches = await fetchApiFootballMaliMatches(dateParam);
    matches = matches.concat(maliMatches);
  }

  return {
    matches,
    stale: srStale || fallbackStale,
    providerName: srUsed ? 'Sportradar Soccer v4' : 'Flux Officiel Live (ESPN Soccer)',
    sportradarConfigured,
    partialErrors: errors.length > 0 && matches.length > 0 ? errors : undefined,
  };
}

// Shared SSE Live Broadcaster (polls ONCE on server when clients are listening)
interface LiveSnapshotState {
  matches: MatchItem[];
  dataSignature: string;
  lastRealUpdateIso: string;
  providerName: string;
  stale: boolean;
}
let liveSnapshotState: LiveSnapshotState = {
  matches: [],
  dataSignature: '',
  lastRealUpdateIso: new Date().toISOString(),
  providerName: 'Flux Officiel Live',
  stale: false,
};
const sseClients = new Set<express.Response>();

async function refreshSharedLiveSnapshot(): Promise<LiveSnapshotState> {
  const today = new Date().toISOString().slice(0, 10);
  const res = await fetchMatchesUnified(today, 'all');
  const nextSig = computeMatchesDataSignature(res.matches);
  const changed = nextSig !== liveSnapshotState.dataSignature || liveSnapshotState.matches.length === 0;
  const nowIso = new Date().toISOString();

  liveSnapshotState = {
    matches: res.matches,
    dataSignature: nextSig,
    lastRealUpdateIso: changed ? nowIso : liveSnapshotState.lastRealUpdateIso,
    providerName: res.providerName,
    stale: res.stale,
  };

  if (sseClients.size > 0) {
    const payload = JSON.stringify({
      type: 'snapshot',
      matches: liveSnapshotState.matches,
      dataSignature: liveSnapshotState.dataSignature,
      lastRealUpdateIso: liveSnapshotState.lastRealUpdateIso,
      hasNewData: changed,
      providerName: liveSnapshotState.providerName,
      stale: liveSnapshotState.stale,
      serverTickIso: nowIso,
    });
    for (const client of sseClients) {
      try {
        client.write(`data: ${payload}\n\n`);
      } catch {
        sseClients.delete(client);
      }
    }
  }
  return liveSnapshotState;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // CORS + rate-limit abuse protection on /api/*
  app.use('/api', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    const clientIp = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'local');
    if (!allowClientIp(clientIp, 240)) {
      res.status(429).json({ error: 'Protection anti-abus : limite de requêtes atteinte. Patientez 1 minute.' });
      return;
    }
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      app: 'DJOUMA FOOT LIVE',
      author: 'Djouma Coulibaly',
      firebaseProjectId: 'djouma-foot-live',
      sportradarConfigured: Boolean(process.env.SPORTRADAR_API_KEY),
      sportradarAccessLevel: process.env.SPORTRADAR_ACCESS_LEVEL === 'production' ? 'production' : 'trial',
      rateLimited: Date.now() < rateLimitedUntil,
      lastRealUpdateIso: liveSnapshotState.lastRealUpdateIso,
    });
  });

  // Real-time Server-Sent Events stream (1 shared server cache -> N clients)
  app.get('/api/live-stream', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    sseClients.add(res);
    try {
      const snap =
        liveSnapshotState.matches.length > 0
          ? liveSnapshotState
          : await refreshSharedLiveSnapshot();
      res.write(
        `data: ${JSON.stringify({
          type: 'snapshot',
          matches: snap.matches,
          dataSignature: snap.dataSignature,
          lastRealUpdateIso: snap.lastRealUpdateIso,
          hasNewData: true,
          providerName: snap.providerName,
          stale: snap.stale,
          serverTickIso: new Date().toISOString(),
        })}\n\n`
      );
    } catch {
      // Keep stream open gracefully
    }

    const heartbeat = setInterval(() => {
      try {
        res.write(`event: heartbeat\ndata: ${JSON.stringify({ serverTickIso: new Date().toISOString(), lastRealUpdateIso: liveSnapshotState.lastRealUpdateIso })}\n\n`);
      } catch {
        clearInterval(heartbeat);
      }
    }, 5_000);

    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
  });

  // Background shared sync every 15s ONLY while clients are connected over SSE
  setInterval(() => {
    if (sseClients.size > 0) {
      refreshSharedLiveSnapshot().catch(() => undefined);
    }
  }, 15_000);

  app.get('/api/competitions', async (_req, res) => {
    try {
      const result = await getAvailableCompetitions();
      res.json(result);
    } catch (err: any) {
      res.status(err?.status || 502).json({
        error: err?.message || 'Impossible de charger les compétitions.',
      });
    }
  });

  app.get('/api/countries', async (_req, res) => {
    try {
      const result = await getAvailableCompetitions();
      const countries = groupCompetitionsByCountryAndDivision(result.competitions);
      res.json({
        countries,
        providerName: result.providerName,
        sportradarConfigured: result.sportradarConfigured,
      });
    } catch (err: any) {
      res.status(err?.status || 502).json({
        error: err?.message || 'Impossible de charger les pays et championnats.',
      });
    }
  });

  app.get('/api/matches', async (req, res) => {
    const dateParam = typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
      ? req.query.date
      : new Date().toISOString().slice(0, 10);
    const compFilter = typeof req.query.competition === 'string' ? req.query.competition : 'all';

    try {
      const result = await fetchMatchesUnified(dateParam, compFilter);
      const dataSignature = computeMatchesDataSignature(result.matches);
      const nowIso = new Date().toISOString();

      if (dateParam === new Date().toISOString().slice(0, 10) && compFilter === 'all') {
        const changed = dataSignature !== liveSnapshotState.dataSignature;
        liveSnapshotState = {
          matches: result.matches,
          dataSignature,
          lastRealUpdateIso: changed || !liveSnapshotState.lastRealUpdateIso ? nowIso : liveSnapshotState.lastRealUpdateIso,
          providerName: result.providerName,
          stale: result.stale,
        };
      }

      res.json({
        date: dateParam,
        matches: result.matches,
        stale: result.stale,
        providerName: result.providerName,
        sportradarConfigured: result.sportradarConfigured,
        partialErrors: result.partialErrors,
        dataSignature,
        lastRealUpdateIso:
          dateParam === new Date().toISOString().slice(0, 10) && compFilter === 'all'
            ? liveSnapshotState.lastRealUpdateIso
            : nowIso,
        fetchedAt: nowIso,
      });
    } catch (err: any) {
      res.status(err?.status || 502).json({
        error: err?.message || 'Erreur lors de la récupération des scores en direct.',
      });
    }
  });

  app.get('/api/matches/:competition/:id', async (req, res) => {
    const { competition, id } = req.params;

    // Sportradar match ID path (sr:sport_event:...)
    if (id.startsWith('sr:sport_event:')) {
      if (!process.env.SPORTRADAR_API_KEY) {
        res.status(503).json({ error: 'SPORTRADAR_API_KEY requise pour cet événement Sportradar.' });
        return;
      }
      try {
        const { data: timeline } = await fetchSportradarJson<any>(
          `sport_events/${encodeURIComponent(id)}/timeline.json`,
          10_000
        );
        const luRes = await fetchSportradarJson<any>(
          `sport_events/${encodeURIComponent(id)}/lineups.json`,
          60_000
        ).catch(() => null);

        const comps = timeline?.sport_event?.competitors || [];
        let h2hRes: any = null;
        if (comps.length >= 2 && comps[0]?.id && comps[1]?.id) {
          h2hRes = await fetchSportradarJson<any>(
            `competitors/${encodeURIComponent(comps[0].id)}/versus/${encodeURIComponent(comps[1].id)}/summaries.json`,
            10 * 60_000
          ).catch(() => null);
        }

        const detail = parseSportradarTimelineToDetail({
          timeline,
          lineupsRaw: luRes?.data,
          h2hRaw: h2hRes?.data,
        });
        if (!detail) {
          res.status(404).json({ error: 'Détails Sportradar introuvables.' });
          return;
        }
        res.json(detail);
        return;
      } catch (err: any) {
        res.status(err?.status || 502).json({
          error: err?.message || 'Impossible de charger les détails Sportradar.',
        });
        return;
      }
    }

    const compDef = COMPETITION_CATALOG.find((c) => c.id === competition);
    if (!compDef || compDef.requiresApiFootball) {
      res.status(404).json({ error: 'Compétition ou match non pris en charge par le flux public.' });
      return;
    }

    try {
      const { data: sum } = await fetchJsonWithCache<any>(
        `summary-${competition}-${id}`,
        `${ESPN_BASE}/${competition}/summary?event=${encodeURIComponent(id)}`,
        12_000
      );

      const comp = sum?.header?.competitions?.[0];
      if (!comp) {
        res.status(404).json({ error: 'Détails du match introuvables.' });
        return;
      }

      const homeComp = comp.competitors?.find((c: any) => c.homeAway === 'home') || comp.competitors?.[0];
      const homeId = homeComp?.team?.id || homeComp?.id;
      let homeSchedules: any[] = [];
      if (homeId) {
        const seasons: (number | null)[] = [null, ...getPriorEspnSeasons()];
        const settled = await Promise.allSettled(
          seasons.map((season) =>
            fetchJsonWithCache<any>(
              `sched-all-${homeId}-${season ?? 'current'}`,
              `${ESPN_BASE}/all/teams/${encodeURIComponent(String(homeId))}/schedule${season ? `?season=${season}` : ''}`,
              10 * 60_000
            )
          )
        );
        homeSchedules = settled
          .filter((r): r is PromiseFulfilledResult<{ data: any; stale: boolean }> => r.status === 'fulfilled')
          .map((r) => r.value.data);
      }

      const detail = parseEspnSummaryToDetail(sum, compDef, id, homeSchedules);
      if (!detail) {
        res.status(404).json({ error: 'Données du match incomplètes.' });
        return;
      }

      res.json(detail);
    } catch (err: any) {
      res.status(err?.status || 502).json({
        error: err?.message || 'Impossible de charger les détails du match.',
      });
    }
  });

  app.get('/api/standings/:competition', async (req, res) => {
    const { competition } = req.params;

    if (competition.startsWith('sr:competition:')) {
      if (!process.env.SPORTRADAR_API_KEY) {
        res.status(503).json({ error: 'SPORTRADAR_API_KEY requise pour cette compétition Sportradar.' });
        return;
      }
      try {
        const { data: seasonsData } = await fetchSportradarJson<any>(
          `competitions/${encodeURIComponent(competition)}/seasons.json`,
          60 * 60_000
        );
        const seasons = Array.isArray(seasonsData?.seasons) ? seasonsData.seasons : [];
        const latestSeason = seasons[seasons.length - 1] || seasons[0];
        if (!latestSeason?.id) {
          res.json({ season: '', tables: [], stale: false });
          return;
        }
        const { data: standingsRaw, stale } = await fetchSportradarJson<any>(
          `seasons/${encodeURIComponent(latestSeason.id)}/standings.json`,
          5 * 60_000
        );
        const parsed = parseSportradarStandings(standingsRaw);
        res.json({ ...parsed, stale });
        return;
      } catch (err: any) {
        res.status(err?.status || 502).json({
          error: err?.message || 'Classement Sportradar temporairement indisponible.',
        });
        return;
      }
    }

    const compDef = COMPETITION_CATALOG.find((c) => c.id === competition);
    if (!compDef || compDef.requiresApiFootball) {
      res.status(404).json({
        error: compDef?.requiresApiFootball
          ? 'Le classement du Championnat du Mali requiert API_FOOTBALL_KEY sur le serveur.'
          : 'Compétition inconnue.',
      });
      return;
    }

    try {
      const { data, stale } = await fetchJsonWithCache<any>(
        `standings-${competition}`,
        `${ESPN_STANDINGS_BASE}/${competition}/standings`,
        5 * 60_000
      );

      const parsed = parseEspnStandings(data, compDef);
      res.json({
        ...parsed,
        stale,
      });
    } catch (err: any) {
      res.status(err?.status || 502).json({
        error: err?.message || 'Classement temporairement indisponible pour cette compétition.',
      });
    }
  });

  app.get('/api/teams/:competition/:teamId', async (req, res) => {
    const { competition, teamId } = req.params;

    if (teamId.startsWith('sr:competitor:')) {
      if (!process.env.SPORTRADAR_API_KEY) {
        res.status(503).json({ error: 'SPORTRADAR_API_KEY requise.' });
        return;
      }
      try {
        const [{ data: profile }, schedRes] = await Promise.all([
          fetchSportradarJson<any>(`competitors/${encodeURIComponent(teamId)}/profile.json`, 30 * 60_000),
          fetchSportradarJson<any>(`competitors/${encodeURIComponent(teamId)}/summaries.json`, 5 * 60_000).catch(() => null),
        ]);
        const playersRaw = Array.isArray(profile?.players) ? profile.players : [];
        const players: PlayerProfileInfo[] = playersRaw.map((p: any) => ({
          id: String(p.id),
          name: String(p.name || ''),
          teamId,
          teamName: String(profile?.competitor?.name || 'Club'),
          nationality: p.nationality ? String(p.nationality) : undefined,
          position: p.type ? String(p.type) : undefined,
          jersey: p.jersey_number !== undefined ? String(p.jersey_number) : undefined,
          source: 'sportradar',
        }));
        const summaries = Array.isArray(schedRes?.data?.summaries) ? schedRes.data.summaries : [];
        const matches = summaries
          .map((s: any) => parseSportradarSummaryToMatch(s))
          .filter((m: MatchItem | null): m is MatchItem => Boolean(m));

        res.json({
          team: {
            id: teamId,
            name: String(profile?.competitor?.name || 'Club'),
            country: profile?.competitor?.country ? String(profile.competitor.country) : undefined,
            venue: profile?.venue?.name ? String(profile.venue.name) : undefined,
          },
          players,
          matches,
        });
        return;
      } catch (err: any) {
        res.status(err?.status || 502).json({ error: err?.message || 'Fiche équipe indisponible.' });
        return;
      }
    }

    const compDef = COMPETITION_CATALOG.find((c) => c.id === competition) || COMPETITION_CATALOG[0];
    try {
      const [schedRes, rosterRes, fullRosterRes] = await Promise.allSettled([
        fetchJsonWithCache<any>(
          `team-sched-all-${teamId}`,
          `${ESPN_BASE}/all/teams/${encodeURIComponent(teamId)}/schedule`,
          5 * 60_000
        ),
        fetchJsonWithCache<any>(
          `team-roster-${competition}-${teamId}`,
          `${ESPN_BASE}/${encodeURIComponent(competition)}/teams/${encodeURIComponent(teamId)}?enable=roster`,
          30 * 60_000
        ),
        fetchJsonWithCache<any>(
          `team-full-roster-${competition}-${teamId}`,
          `${ESPN_BASE}/${encodeURIComponent(competition)}/teams/${encodeURIComponent(teamId)}/roster`,
          15 * 60_000
        ),
      ]);

      const events =
        schedRes.status === 'fulfilled' && Array.isArray(schedRes.value.data?.events)
          ? schedRes.value.data.events
          : [];
      const matches = events
        .map((ev: any) => {
          const slug = ev?.league?.slug;
          const evCompDef = COMPETITION_CATALOG.find((c) => c.id === slug) || compDef;
          return parseEspnEventToMatch(ev, evCompDef);
        })
        .filter((m: MatchItem | null): m is MatchItem => Boolean(m));

      const teamObj = rosterRes.status === 'fulfilled' ? rosterRes.value.data?.team : null;
      const fullRosterData = fullRosterRes.status === 'fulfilled' ? fullRosterRes.value.data : null;
      const fullAthletes = Array.isArray(fullRosterData?.athletes) ? fullRosterData.athletes : [];
      const fallbackAthletes = Array.isArray(teamObj?.athletes) ? teamObj.athletes : [];
      const athletes = fullAthletes.length > 0 ? fullAthletes : fallbackAthletes;

      const resolvedTeamId = String(fullRosterData?.team?.id || teamObj?.id || teamId);
      const resolvedTeamName = String(
        fullRosterData?.team?.displayName ||
          teamObj?.displayName ||
          matches[0]?.home?.name ||
          'Club'
      );
      const seasonLabel = fullRosterData?.season?.displayName
        ? String(fullRosterData.season.displayName)
        : undefined;

      const players: PlayerProfileInfo[] = athletes
        .map((a: any) =>
          parseEspnRosterAthlete(a, {
            teamId: resolvedTeamId,
            teamName: resolvedTeamName,
            competitionId: compDef.id,
            competitionName: compDef.name,
            seasonLabel,
          })
        )
        .filter((p: PlayerProfileInfo | null): p is PlayerProfileInfo => Boolean(p));

      res.json({
        team: {
          id: resolvedTeamId,
          name: resolvedTeamName,
          logo: String(fullRosterData?.team?.logo || teamObj?.logos?.[0]?.href || ''),
          venue: teamObj?.franchise?.venue?.fullName || undefined,
        },
        players,
        matches,
      });
    } catch {
      res.json({ team: { id: teamId, name: 'Club' }, players: [], matches: [] });
    }
  });

  app.get('/api/players/:playerId', async (req, res) => {
    const { playerId } = req.params;
    if (playerId.startsWith('sr:player:')) {
      if (!process.env.SPORTRADAR_API_KEY) {
        res.status(503).json({ error: 'SPORTRADAR_API_KEY requise.' });
        return;
      }
      try {
        const { data } = await fetchSportradarJson<any>(
          `players/${encodeURIComponent(playerId)}/profile.json`,
          30 * 60_000
        );
        const profile = parseSportradarPlayerProfile(data);
        if (!profile) {
          res.status(404).json({ error: 'Profil joueur introuvable.' });
          return;
        }
        res.json({ player: profile });
        return;
      } catch (err: any) {
        res.status(err?.status || 502).json({ error: err?.message || 'Profil joueur indisponible.' });
        return;
      }
    }

    const rawComp = typeof req.query.competition === 'string' ? req.query.competition.trim() : '';
    const leagueSlug = rawComp && !rawComp.startsWith('sr:') && !rawComp.startsWith('af-') ? rawComp : 'eng.1';
    try {
      const [athleteRes, overviewRes] = await Promise.allSettled([
        fetchJsonWithCache<any>(
          `espn-athlete-${leagueSlug}-${playerId}`,
          `https://site.web.api.espn.com/apis/common/v3/sports/soccer/${encodeURIComponent(leagueSlug)}/athletes/${encodeURIComponent(playerId)}`,
          15 * 60_000
        ),
        fetchJsonWithCache<any>(
          `espn-athlete-overview-${leagueSlug}-${playerId}`,
          `https://site.web.api.espn.com/apis/common/v3/sports/soccer/${encodeURIComponent(leagueSlug)}/athletes/${encodeURIComponent(playerId)}/overview`,
          10 * 60_000
        ),
      ]);

      const athleteData = athleteRes.status === 'fulfilled' ? athleteRes.value.data : null;
      const overviewData = overviewRes.status === 'fulfilled' ? overviewRes.value.data : null;
      const profile = parseEspnAthleteOverviewToProfile(athleteData, overviewData, { id: playerId });
      if (!profile) {
        res.status(404).json({ error: 'Statistiques saisonnières introuvables pour ce joueur.' });
        return;
      }
      res.json({ player: profile });
    } catch (err: any) {
      res.status(err?.status || 502).json({
        error: err?.message || 'Statistiques saisonnières du joueur temporairement indisponibles.',
      });
    }
  });

  app.get('/api/team/:competition/:teamId/matches', async (req, res) => {
    const { competition, teamId } = req.params;
    if (teamId.startsWith('sr:competitor:') && process.env.SPORTRADAR_API_KEY) {
      try {
        const { data } = await fetchSportradarJson<any>(
          `competitors/${encodeURIComponent(teamId)}/summaries.json`,
          5 * 60_000
        );
        const list = Array.isArray(data?.summaries) ? data.summaries : [];
        const matches = list
          .map((s: any) => parseSportradarSummaryToMatch(s))
          .filter((m: MatchItem | null): m is MatchItem => Boolean(m));
        res.json({ teamId, matches });
        return;
      } catch {
        res.json({ teamId, matches: [] });
        return;
      }
    }

    const compDef = COMPETITION_CATALOG.find((c) => c.id === competition) || COMPETITION_CATALOG[0];
    try {
      const { data } = await fetchJsonWithCache<any>(
        `team-sched-all-${teamId}`,
        `${ESPN_BASE}/all/teams/${encodeURIComponent(teamId)}/schedule`,
        5 * 60_000
      );
      const events = Array.isArray(data?.events) ? data.events : [];
      const matches = events
        .map((ev: any) => {
          const slug = ev?.league?.slug;
          const evCompDef = COMPETITION_CATALOG.find((c) => c.id === slug) || compDef;
          return parseEspnEventToMatch(ev, evCompDef);
        })
        .filter((m: MatchItem | null): m is MatchItem => Boolean(m));
      res.json({ teamId, matches });
    } catch {
      res.json({ teamId, matches: [] });
    }
  });

  app.get('/api/news', async (_req, res) => {
    try {
      const endpoints = [
        { code: 'fifa.world', label: 'International' },
        { code: 'uefa.champions', label: 'Ligue des champions' },
        { code: 'eng.1', label: 'Premier League' },
        { code: 'fra.1', label: 'Ligue 1' },
      ];

      const results = await Promise.all(
        endpoints.map(async (ep) => {
          try {
            const { data } = await fetchJsonWithCache<any>(
              `news-${ep.code}`,
              `${ESPN_BASE}/${ep.code}/news?limit=8`,
              5 * 60_000
            );
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

      res.json({ articles: all.slice(0, 24) });
    } catch (err: any) {
      res.status(err?.status || 502).json({
        error: err?.message || 'Impossible de charger les actualités football.',
      });
    }
  });

  app.get('/api/transfers', async (req, res) => {
    const homeId = String(req.query.homeId || '').trim();
    const awayId = String(req.query.awayId || '').trim();
    const homeName = String(req.query.homeName || '').trim();
    const awayName = String(req.query.awayName || '').trim();
    const homeShortName = String(req.query.homeShortName || homeName).trim();
    const awayShortName = String(req.query.awayShortName || awayName).trim();
    const competition = String(req.query.competition || 'eng.1').trim();

    if (!homeName && !awayName) {
      res.status(400).json({ error: 'Paramètres des clubs manquants.' });
      return;
    }

    const ctx = { homeId, homeName, homeShortName, awayId, awayName, awayShortName };
    const collected: TransferItem[] = [];
    const sourcesUsed: string[] = [];

    try {
      const espnNewsUrls: Array<{ key: string; url: string }> = [
        { key: 'transfers-global-news', url: `${ESPN_BASE}/all/news?limit=50` },
      ];
      if (homeId && !homeId.startsWith('af-') && !homeId.startsWith('sr:')) {
        espnNewsUrls.push({
          key: `transfers-team-news-${homeId}`,
          url: `${ESPN_BASE}/all/news?team=${encodeURIComponent(homeId)}&limit=15`,
        });
      }
      if (awayId && !awayId.startsWith('af-') && !awayId.startsWith('sr:')) {
        espnNewsUrls.push({
          key: `transfers-team-news-${awayId}`,
          url: `${ESPN_BASE}/all/news?team=${encodeURIComponent(awayId)}&limit=15`,
        });
      }

      const [newsSettled, txRes] = await Promise.all([
        Promise.allSettled(
          espnNewsUrls.map((u) => fetchJsonWithCache<any>(u.key, u.url, 5 * 60_000))
        ),
        !competition.startsWith('sr:')
          ? fetchJsonWithCache<any>(
              `tx-${competition}`,
              `${ESPN_BASE}/${encodeURIComponent(competition)}/transactions?limit=30`,
              5 * 60_000
            ).catch(() => null)
          : Promise.resolve(null),
      ]);

      const rawArticles: any[] = [];
      for (const r of newsSettled) {
        if (r.status === 'fulfilled' && Array.isArray(r.value.data?.articles)) {
          rawArticles.push(...r.value.data.articles);
        }
      }
      if (rawArticles.length > 0) {
        sourcesUsed.push('ESPN Transfer Talk');
        collected.push(...extractTransferItemsFromEspnArticles(rawArticles, ctx));
      }

      if (txRes && Array.isArray(txRes.data?.transactions) && txRes.data.transactions.length > 0) {
        sourcesUsed.push('ESPN Transactions');
        collected.push(...parseEspnTransactionsToTransfers(txRes.data.transactions, ctx));
      }

      const afKey = process.env.API_FOOTBALL_KEY;
      if (afKey) {
        const teamLookups = [
          { side: 'home' as const, name: homeShortName || homeName },
          { side: 'away' as const, name: awayShortName || awayName },
        ];
        await Promise.allSettled(
          teamLookups.map(async ({ side, name }) => {
            if (!name) return;
            const searchRes = await fetchJsonWithCache<any>(
              `af-team-search-${name.toLowerCase()}`,
              `https://v3.football.api-sports.io/teams?search=${encodeURIComponent(name)}`,
              24 * 60 * 60_000,
              { 'x-apisports-key': afKey }
            );
            const afTeamId = searchRes.data?.response?.[0]?.team?.id;
            if (!afTeamId) return;
            const trRes = await fetchJsonWithCache<any>(
              `af-transfers-${afTeamId}`,
              `https://v3.football.api-sports.io/transfers?team=${afTeamId}`,
              60 * 60_000,
              { 'x-apisports-key': afKey }
            );
            const rows = Array.isArray(trRes.data?.response) ? trRes.data.response : [];
            for (const row of rows.slice(0, 12)) {
              const player = String(row?.player?.name || '').trim();
              const latest = Array.isArray(row?.transfers) ? row.transfers[0] : null;
              if (!player || !latest) continue;
              const fromTeam = String(latest.teams?.out?.name || '');
              const toTeam = String(latest.teams?.in?.name || '');
              const typeLabel = String(latest.type || 'Transfert');
              collected.push({
                id: `af-tr-${afTeamId}-${player}-${latest.date || ''}`,
                title: `${player} (${typeLabel})`,
                summary: `${fromTeam || 'Club précédent'} → ${toTeam || name}`,
                status: 'official',
                clubSide: side,
                clubName: name,
                publishedAt: String(latest.date || new Date().toISOString()),
                source: 'API-Football Transfers',
              });
            }
            if (rows.length > 0 && !sourcesUsed.includes('API-Football Transfers')) {
              sourcesUsed.push('API-Football Transfers');
            }
          })
        );
      }

      res.json({
        items: mergeAndSortTransfers(collected),
        sourceName: sourcesUsed.length > 0 ? sourcesUsed.join(' · ') : 'ESPN Transfer Talk',
      });
    } catch (err: any) {
      res.status(err?.status || 502).json({
        error: err?.message || 'Impossible de charger les actualités transferts.',
      });
    }
  });

  // Always return JSON on unknown /api/* routes
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Route API introuvable.' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
        watch: null,
      },
      plugins: [
        {
          name: 'disable-vite-hmr-websocket',
          transform(code, id) {
            if (id.includes('vite/dist/client/client.mjs')) {
              return code.replace(
                /let wsTransport = createWebSocketModuleRunnerTransport\(\{[\s\S]*?\}\);/,
                'let wsTransport = { async connect() {}, async disconnect() {}, send() {} };'
              );
            }
          },
        },
      ],
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DJOUMA FOOT LIVE server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
