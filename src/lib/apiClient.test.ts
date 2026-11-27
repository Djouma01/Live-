import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isJsonResponse } from './apiClient.ts';
import {
  COMPETITION_CATALOG,
  getPriorEspnSeasons,
  parseEspnEventToMatch,
  parseEspnNewsArticles,
  parseEspnStandings,
  parseEspnSummaryToDetail,
} from './espn.ts';

describe('isJsonResponse', () => {
  it('accepts application/json responses with or without charset', () => {
    const r1 = new Response('{}', { headers: { 'content-type': 'application/json' } });
    const r2 = new Response('{}', { headers: { 'content-type': 'application/json; charset=utf-8' } });
    assert.equal(isJsonResponse(r1), true);
    assert.equal(isJsonResponse(r2), true);
  });

  it('rejects HTML SPA fallback or plain text responses', () => {
    const htmlRes = new Response('<!doctype html><html></html>', {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
    const noHeaderRes = new Response('not found');
    assert.equal(isJsonResponse(htmlRes), false);
    assert.equal(isJsonResponse(noHeaderRes), false);
  });
});

describe('ESPN parsers for shared backend & static web fallback', () => {
  const pl = COMPETITION_CATALOG[0];

  it('parses a live match with scores and clock', () => {
    const match = parseEspnEventToMatch(
      {
        id: '704200',
        date: '2026-04-12T15:00:00Z',
        competitions: [
          {
            date: '2026-04-12T15:00:00Z',
            status: {
              displayClock: "67'",
              type: { state: 'in', name: 'STATUS_IN_PROGRESS', shortDetail: "67'" },
            },
            competitors: [
              { homeAway: 'home', score: '2', team: { id: '359', displayName: 'Arsenal', abbreviation: 'ARS' } },
              { homeAway: 'away', score: '1', team: { id: '363', displayName: 'Chelsea', abbreviation: 'CHE' } },
            ],
          },
        ],
      },
      pl
    );
    assert.ok(match);
    assert.equal(match.status, 'live');
    assert.equal(match.minuteDisplay, "67'");
    assert.equal(match.home.score, 2);
    assert.equal(match.away.score, 1);
  });

  it('keeps upcoming match scores as null (never invents 0-0)', () => {
    const match = parseEspnEventToMatch(
      {
        id: '704201',
        date: '2026-04-15T19:00:00Z',
        competitions: [
          {
            status: { type: { state: 'pre', name: 'STATUS_SCHEDULED' } },
            competitors: [
              { homeAway: 'home', score: '0', team: { id: '1', displayName: 'PSG' } },
              { homeAway: 'away', score: '0', team: { id: '2', displayName: 'Lyon' } },
            ],
          },
        ],
      },
      pl
    );
    assert.ok(match);
    assert.equal(match.status, 'upcoming');
    assert.equal(match.home.score, null);
    assert.equal(match.away.score, null);
  });

  it('parses standings tables and news articles cleanly', () => {
    const st = parseEspnStandings(
      {
        season: { displayName: '2025-26' },
        standings: {
          entries: [
            {
              team: { id: '359', displayName: 'Arsenal' },
              stats: [
                { name: 'rank', value: 1 },
                { name: 'gamesPlayed', value: 30 },
                { name: 'wins', value: 21 },
                { name: 'ties', value: 5 },
                { name: 'losses', value: 4 },
                { name: 'pointsFor', value: 64 },
                { name: 'pointsAgainst', value: 25 },
                { name: 'pointDifferential', value: 39 },
                { name: 'points', value: 68 },
              ],
            },
          ],
        },
      },
      pl
    );
    assert.equal(st.season, '2025-26');
    assert.equal(st.tables[0].rows[0].points, 68);
    assert.equal(st.tables[0].rows[0].teamName, 'Arsenal');

    const articles = parseEspnNewsArticles(
      [{ id: 'n1', headline: 'Victoire décisive', description: 'Résumé', links: { web: { href: 'https://espn.com/1' } } }],
      'Premier League'
    );
    assert.equal(articles.length, 1);
    assert.equal(articles[0].url, 'https://espn.com/1');
  });

  it('computes prior ESPN seasons and deduplicates multi-season H2H confrontations', () => {
    assert.deepEqual(getPriorEspnSeasons(new Date('2026-11-27T08:00:00Z')), [2025, 2024]);
    assert.deepEqual(getPriorEspnSeasons(new Date('2026-03-10T08:00:00Z')), [2024, 2023]);

    const summary = {
      header: {
        id: '900',
        competitions: [
          {
            date: '2026-11-27T20:00:00Z',
            status: { type: { state: 'pre', name: 'STATUS_SCHEDULED' } },
            competitors: [
              { homeAway: 'home', team: { id: '359', displayName: 'Arsenal', shortDisplayName: 'Arsenal' } },
              { homeAway: 'away', team: { id: '363', displayName: 'Chelsea', shortDisplayName: 'Chelsea' } },
            ],
          },
        ],
      },
    };

    const schedSeasonCurrent = {
      events: [
        {
          id: '900', // current match: should be excluded from past H2H
          date: '2026-11-27T20:00:00Z',
          competitions: [
            {
              status: { type: { completed: true } },
              competitors: [
                { homeAway: 'home', score: { value: 0 }, team: { id: '359', displayName: 'Arsenal' } },
                { homeAway: 'away', score: { value: 0 }, team: { id: '363', displayName: 'Chelsea' } },
              ],
            },
          ],
        },
        {
          id: '801',
          date: '2026-09-06T15:30:00Z',
          league: { shortName: 'Premier League' },
          competitions: [
            {
              status: { type: { completed: true } },
              competitors: [
                { homeAway: 'home', score: { value: 2 }, team: { id: '359', displayName: 'Arsenal' } },
                { homeAway: 'away', score: { value: 1 }, team: { id: '363', displayName: 'Chelsea' } },
              ],
            },
          ],
        },
      ],
    };

    const schedSeasonPrev = {
      events: [
        {
          id: '801', // duplicate across payloads: should be deduplicated
          date: '2026-09-06T15:30:00Z',
          league: { shortName: 'Premier League' },
          competitions: [
            {
              status: { type: { completed: true } },
              competitors: [
                { homeAway: 'home', score: { value: 2 }, team: { id: '359', displayName: 'Arsenal' } },
                { homeAway: 'away', score: { value: 1 }, team: { id: '363', displayName: 'Chelsea' } },
              ],
            },
          ],
        },
        {
          id: '705',
          date: '2025-11-02T16:30:00Z',
          league: { shortName: 'FA Cup' },
          competitions: [
            {
              status: { type: { completed: true } },
              competitors: [
                { homeAway: 'home', score: { value: 1 }, team: { id: '363', displayName: 'Chelsea' } },
                { homeAway: 'away', score: { value: 1 }, team: { id: '359', displayName: 'Arsenal' } },
              ],
            },
          ],
        },
      ],
    };

    const detail = parseEspnSummaryToDetail(summary, pl, '900', [schedSeasonCurrent, schedSeasonPrev]);
    assert.ok(detail);
    assert.equal(detail.h2h.matches.length, 2);
    assert.equal(detail.h2h.homeWins, 1);
    assert.equal(detail.h2h.draws, 1);
    assert.equal(detail.h2h.awayWins, 0);
    assert.equal(detail.h2h.homeGoals, 3);
    assert.equal(detail.h2h.awayGoals, 2);
    assert.equal(detail.h2h.matches[1].competitionName, 'FA Cup');
  });
});
