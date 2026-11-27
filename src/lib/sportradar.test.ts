import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getSportradarBaseUrl,
  parseSportradarCompetitions,
  parseSportradarPlayerProfile,
  parseSportradarStandings,
  parseSportradarSummaryToMatch,
  parseSportradarTimelineToDetail,
} from './sportradar.ts';

describe('Sportradar Soccer API v4 module', () => {
  it('builds valid trial and production v4 base URLs', () => {
    assert.equal(getSportradarBaseUrl('trial', 'fr'), 'https://api.sportradar.com/soccer/trial/v4/fr');
    assert.equal(getSportradarBaseUrl('production', 'fr'), 'https://api.sportradar.com/soccer/production/v4/fr');
  });

  it('parses and prioritizes all competitions across Europe, Saudi, USA, Brazil, Russia without dropping any', () => {
    const raw = {
      competitions: [
        { id: 'sr:competition:1', name: 'Série C', category: { name: 'Brazil', country_code: 'BRA' }, type: 'league' },
        { id: 'sr:competition:2', name: 'Saudi First Division', category: { name: 'Saudi Arabia', country_code: 'SAU' }, type: 'league' },
        { id: 'sr:competition:3', name: 'Premier League', category: { name: 'England', country_code: 'ENG' }, type: 'league' },
        { id: 'sr:competition:4', name: 'USL Championship', category: { name: 'USA', country_code: 'USA' }, type: 'league' },
        { id: 'sr:competition:5', name: 'First League', category: { name: 'Russia', country_code: 'RUS' }, type: 'league' },
      ],
    };

    const comps = parseSportradarCompetitions(raw);
    assert.equal(comps.length, 5);
    assert.equal(comps[0].country, 'Angleterre');
    assert.equal(comps[0].divisionLevel, 1);

    const saudi = comps.find((c) => c.id === 'sr:competition:2');
    assert.equal(saudi?.country, 'Arabie saoudite');
    assert.equal(saudi?.divisionLevel, 2);

    const usa = comps.find((c) => c.id === 'sr:competition:4');
    assert.equal(usa?.country, 'États-Unis');
    assert.equal(usa?.divisionLevel, 2);

    const brazil = comps.find((c) => c.id === 'sr:competition:1');
    assert.equal(brazil?.country, 'Brésil');
    assert.equal(brazil?.divisionLevel, 3);
  });

  it('parses Sportradar live summary, timeline, lineups, player stats, and H2H without inventing missing stats', () => {
    const summary = {
      sport_event: {
        id: 'sr:sport_event:1001',
        start_time: '2026-11-27T18:00:00Z',
        sport_event_context: {
          category: { name: 'England' },
          competition: { id: 'sr:competition:17', name: 'Premier League', type: 'league' },
        },
        competitors: [
          { id: 'sr:competitor:1', name: 'Arsenal', short_name: 'Arsenal', abbreviation: 'ARS', qualifier: 'home' },
          { id: 'sr:competitor:2', name: 'Liverpool', short_name: 'Liverpool', abbreviation: 'LIV', qualifier: 'away' },
        ],
      },
      sport_event_status: {
        status: 'live',
        match_status: '2nd_half',
        home_score: 2,
        away_score: 1,
        clock: { played: '68:15' },
      },
      statistics: {
        totals: {
          competitors: [
            {
              id: 'sr:competitor:1',
              qualifier: 'home',
              statistics: { ball_possession: 58, shots_total: 14, shots_on_target: 6, corner_kicks: 7 },
              players: [
                { id: 'sr:player:10', name: 'Bukayo Saka', statistics: { goals_scored: 1, assists: 1, shots_total: 4 } },
              ],
            },
            {
              id: 'sr:competitor:2',
              qualifier: 'away',
              statistics: { ball_possession: 42, shots_total: 9, shots_on_target: 3, corner_kicks: 4 },
              players: [],
            },
          ],
        },
      },
      timeline: [
        { id: 1, type: 'score_change', match_clock: "65'", period: 2, competitor: 'home', players: [{ name: 'Bukayo Saka' }] },
      ],
    };

    const m = parseSportradarSummaryToMatch(summary);
    assert.ok(m);
    assert.equal(m.status, 'live');
    assert.equal(m.home.score, 2);
    assert.equal(m.away.score, 1);

    const detail = parseSportradarTimelineToDetail({ timeline: summary });
    assert.ok(detail);
    assert.equal(detail.events.length, 1);
    assert.equal(detail.statistics.length, 4);
    assert.equal(detail.playerStats?.length, 1);
    assert.equal(detail.playerStats?.[0].goals, 1);
  });

  it('parses Sportradar standings and player profile cleanly', () => {
    const standings = parseSportradarStandings({
      season: { name: '2026/27' },
      standings: [
        {
          type: 'total',
          groups: [
            {
              group: { name: 'Ligue 1' },
              standings: [
                { rank: 1, played: 12, win: 10, draw: 1, loss: 1, goals_for: 30, goals_against: 8, points: 31, competitor: { id: 'c1', name: 'PSG' } },
              ],
            },
          ],
        },
      ],
    });
    assert.equal(standings.tables[0].rows[0].teamName, 'PSG');
    assert.equal(standings.tables[0].rows[0].points, 31);

    const player = parseSportradarPlayerProfile({
      player: { id: 'sr:player:55', name: 'Kylian Mbappé', nationality: 'France', type: 'forward' },
      roles: [{ active: true, jersey_number: 9, competitor: { id: 'sr:competitor:2829', name: 'Real Madrid' } }],
    });
    assert.equal(player?.name, 'Kylian Mbappé');
    assert.equal(player?.teamName, 'Real Madrid');
    assert.equal(player?.jersey, '9');
  });
});
