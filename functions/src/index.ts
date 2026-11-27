import * as admin from 'firebase-admin';
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';

admin.initializeApp();

const db = admin.firestore();
const SPORTRADAR_API_KEY = defineSecret('SPORTRADAR_API_KEY');
const SPORTRADAR_ACCESS_LEVEL = process.env.SPORTRADAR_ACCESS_LEVEL === 'production' ? 'production' : 'trial';

const rateBucket = new Map<string, { count: number; resetAt: number }>();

function checkAbuseLimit(ip: string, limitPerMin = 60): boolean {
  const now = Date.now();
  const entry = rateBucket.get(ip);
  if (!entry || now > entry.resetAt) {
    rateBucket.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= limitPerMin) return false;
  entry.count += 1;
  return true;
}

async function fetchSportradar(endpointPath: string, apiKey: string): Promise<any> {
  const url = `https://api.sportradar.com/soccer/${SPORTRADAR_ACCESS_LEVEL}/v4/fr/${endpointPath}`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'x-api-key': apiKey,
    },
  });
  if (!res.ok) {
    throw new Error(`Sportradar HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Synchronisation automatique du catalogue Sportradar (Europe, Arabie saoudite, USA, Brésil, Russie, etc.)
 * Toutes les 12 heures vers Firestore (/competitions_catalog)
 */
export const syncSportradarCompetitions = onSchedule(
  {
    schedule: 'every 12 hours',
    region: 'europe-west1',
    secrets: [SPORTRADAR_API_KEY],
  },
  async () => {
    const key = SPORTRADAR_API_KEY.value();
    if (!key) return;
    const data = await fetchSportradar('competitions.json', key);
    const list = Array.isArray(data?.competitions) ? data.competitions : [];

    const batch = db.batch();
    let count = 0;
    for (const c of list.slice(0, 450)) {
      const compId = String(c.id || '').replace(/[^a-zA-Z0-9_-]/g, '_');
      if (!compId) continue;
      batch.set(
        db.collection('competitions_catalog').doc(compId),
        {
          competitionId: String(c.id),
          name: String(c.name || ''),
          country: String(c.category?.name || 'International'),
          divisionLabel: String(c.type || 'league'),
          isPublic: true,
        },
        { merge: true }
      );
      count += 1;
    }
    if (count > 0) {
      await batch.commit();
    }
  }
);

/**
 * Synchronisation temps réel partagée (1 fois pour tous les utilisateurs) + notifications FCM de buts
 */
export const syncSportradarLiveScoreboard = onSchedule(
  {
    schedule: 'every 1 minutes',
    region: 'europe-west1',
    secrets: [SPORTRADAR_API_KEY],
  },
  async () => {
    const key = SPORTRADAR_API_KEY.value();
    if (!key) return;
    const liveData = await fetchSportradar('schedules/live/summaries.json', key);
    const summaries = Array.isArray(liveData?.summaries) ? liveData.summaries : [];
    const nowIso = new Date().toISOString();

    const scoreboardRef = db.collection('live_cache').doc('scoreboard');
    const prevSnap = await scoreboardRef.get();
    const prevScores: Record<string, string> = prevSnap.exists ? prevSnap.data()?.scoreIndex || {} : {};
    const nextScores: Record<string, string> = {};

    for (const s of summaries) {
      const ev = s.sport_event;
      const st = s.sport_event_status;
      if (!ev?.id) continue;
      const scoreSig = `${st?.home_score ?? 0}-${st?.away_score ?? 0}`;
      nextScores[ev.id] = scoreSig;

      // Envoi FCM aux abonnés du match si le score évolue
      if (prevScores[ev.id] && prevScores[ev.id] !== scoreSig) {
        const homeName = ev.competitors?.[0]?.name || 'Domicile';
        const awayName = ev.competitors?.[1]?.name || 'Extérieur';
        const topic = `match_${String(ev.id).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
        await admin.messaging().send({
          topic,
          notification: {
            title: `BUT ! ${homeName} ${st?.home_score ?? 0} - ${st?.away_score ?? 0} ${awayName}`,
            body: `${ev.sport_event_context?.competition?.name || 'Match en direct'} (${st?.clock?.played || 'Direct'})`,
          },
        }).catch(() => undefined);
      }
    }

    await scoreboardRef.set(
      {
        cacheId: 'scoreboard',
        provider: 'Sportradar Soccer v4',
        isPublic: true,
        lastRealUpdateIso: nowIso,
        matchCount: summaries.length,
        liveCount: summaries.length,
        scoreIndex: nextScores,
      },
      { merge: true }
    );
  }
);

/**
 * Proxy sécurisé protégé contre les abus pour récupérer les données Sportradar via Secret Manager
 */
export const sportradarProxy = onRequest(
  {
    region: 'europe-west1',
    cors: true,
    secrets: [SPORTRADAR_API_KEY],
  },
  async (req, res) => {
    const clientIp = String(req.headers['x-forwarded-for'] || req.ip || 'unknown');
    if (!checkAbuseLimit(clientIp, 45)) {
      res.status(429).json({ error: 'Trop de requêtes. Réessayez dans une minute.' });
      return;
    }

    const endpoint = String(req.query.endpoint || '').trim();
    const allowed = [
      'competitions.json',
      'schedules/live/summaries.json',
    ];
    const isDateSchedule = /^schedules\/\d{4}-\d{2}-\d{2}\/summaries\.json$/.test(endpoint);
    if (!allowed.includes(endpoint) && !isDateSchedule) {
      res.status(400).json({ error: 'Endpoint Sportradar non autorisé.' });
      return;
    }

    const key = SPORTRADAR_API_KEY.value();
    if (!key) {
      res.status(503).json({ error: 'SPORTRADAR_API_KEY non configurée dans Secret Manager.' });
      return;
    }

    try {
      const data = await fetchSportradar(endpoint, key);
      res.set('Cache-Control', 'public, max-age=15, s-maxage=15');
      res.json(data);
    } catch (err: any) {
      res.status(502).json({ error: err?.message || 'Erreur Sportradar.' });
    }
  }
);
