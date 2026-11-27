import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeH2HSummary,
  detectMatchChanges,
  detectScoreChangeSides,
  filterMatches,
  groupMatchesByStatus,
  sortStandings,
  DEFAULT_NOTIFICATION_PREFS,
  type MatchItem,
  type StandingRow,
} from './football';

const baseMatch = (overrides: Partial<MatchItem>): MatchItem => ({
  id: 'm1',
  competitionId: 'eng.1',
  competitionName: 'Premier League',
  country: 'Angleterre',
  dateIso: '2026-11-24T20:00:00Z',
  status: 'upcoming',
  statusText: 'À venir',
  minuteDisplay: '',
  isExtraTime: false,
  isPenalties: false,
  home: { id: 'h1', name: 'Arsenal', shortName: 'Arsenal', abbreviation: 'ARS', logo: '', score: null },
  away: { id: 'a1', name: 'Chelsea', shortName: 'Chelsea', abbreviation: 'CHE', logo: '', score: null },
  ...overrides,
});

test('groupMatchesByStatus separates live, upcoming, and finished accurately', () => {
  const matches: MatchItem[] = [
    baseMatch({ id: 'u1', status: 'upcoming', dateIso: '2026-11-24T21:00:00Z' }),
    baseMatch({ id: 'l1', status: 'live', minuteDisplay: "34'", home: { id: '1', name: 'PSG', shortName: 'PSG', abbreviation: 'PSG', logo: '', score: 1 }, away: { id: '2', name: 'OM', shortName: 'OM', abbreviation: 'OM', logo: '', score: 0 } }),
    baseMatch({ id: 'l2', status: 'live', minuteDisplay: "78'", home: { id: '3', name: 'Real', shortName: 'Real', abbreviation: 'RMA', logo: '', score: 2 }, away: { id: '4', name: 'Barca', shortName: 'Barca', abbreviation: 'BAR', logo: '', score: 2 } }),
    baseMatch({ id: 'f1', status: 'finished', dateIso: '2026-11-24T14:00:00Z', home: { id: '5', name: 'Milan', shortName: 'Milan', abbreviation: 'MIL', logo: '', score: 1 }, away: { id: '6', name: 'Inter', shortName: 'Inter', abbreviation: 'INT', logo: '', score: 3 } }),
  ];

  const grouped = groupMatchesByStatus(matches);
  assert.equal(grouped.live.length, 2);
  assert.equal(grouped.live[0].id, 'l2'); // 78' before 34'
  assert.equal(grouped.upcoming.length, 1);
  assert.equal(grouped.finished.length, 1);
});

test('filterMatches filters by competition, country, and search term', () => {
  const matches: MatchItem[] = [
    baseMatch({ id: '1', competitionId: 'eng.1', country: 'Angleterre', home: { id: '1', name: 'Liverpool', shortName: 'Liverpool', abbreviation: 'LIV', logo: '', score: null } }),
    baseMatch({ id: '2', competitionId: 'fra.1', competitionName: 'Ligue 1', country: 'France', home: { id: '2', name: 'Olympique Lyonnais', shortName: 'Lyon', abbreviation: 'OL', logo: '', score: null } }),
  ];

  assert.equal(filterMatches(matches, { competitionId: 'fra.1' }).length, 1);
  assert.equal(filterMatches(matches, { country: 'Angleterre' }).length, 1);
  assert.equal(filterMatches(matches, { search: 'lyon' }).length, 1);
  assert.equal(filterMatches(matches, { search: 'madrid' }).length, 0);
});

test('detectMatchChanges emits goal, kickoff, and fulltime notifications', () => {
  const prev: MatchItem[] = [
    baseMatch({ id: 'm1', status: 'upcoming', home: { id: '10', name: 'PSG', shortName: 'PSG', abbreviation: 'PSG', logo: '', score: 0 }, away: { id: '20', name: 'Lens', shortName: 'Lens', abbreviation: 'LEN', logo: '', score: 0 } }),
    baseMatch({ id: 'm2', status: 'live', minuteDisplay: "65'", home: { id: '30', name: 'Arsenal', shortName: 'Arsenal', abbreviation: 'ARS', logo: '', score: 1 }, away: { id: '40', name: 'City', shortName: 'City', abbreviation: 'MCI', logo: '', score: 1 } }),
  ];

  const next: MatchItem[] = [
    baseMatch({ id: 'm1', status: 'live', minuteDisplay: "1'", home: { id: '10', name: 'PSG', shortName: 'PSG', abbreviation: 'PSG', logo: '', score: 0 }, away: { id: '20', name: 'Lens', shortName: 'Lens', abbreviation: 'LEN', logo: '', score: 0 } }),
    baseMatch({ id: 'm2', status: 'finished', statusText: 'Terminé', minuteDisplay: "90'", home: { id: '30', name: 'Arsenal', shortName: 'Arsenal', abbreviation: 'ARS', logo: '', score: 2 }, away: { id: '40', name: 'City', shortName: 'City', abbreviation: 'MCI', logo: '', score: 1 } }),
  ];

  const alerts = detectMatchChanges(prev, next, DEFAULT_NOTIFICATION_PREFS);
  assert.equal(alerts.some((a) => a.kind === 'kickoff' && a.matchId === 'm1'), true);
  assert.equal(alerts.some((a) => a.kind === 'goal' && a.matchId === 'm2'), true);
  assert.equal(alerts.some((a) => a.kind === 'fulltime' && a.matchId === 'm2'), true);
});

test('sortStandings orders by rank or points and goal difference', () => {
  const rows: StandingRow[] = [
    { rank: 0, teamId: '2', teamName: 'B', teamLogo: '', played: 10, wins: 6, draws: 2, losses: 2, goalsFor: 18, goalsAgainst: 10, goalDifference: 8, points: 20 },
    { rank: 0, teamId: '1', teamName: 'A', teamLogo: '', played: 10, wins: 7, draws: 1, losses: 2, goalsFor: 20, goalsAgainst: 8, goalDifference: 12, points: 22 },
  ];
  const sorted = sortStandings(rows);
  assert.equal(sorted[0].teamName, 'A');
});

test('computeH2HSummary aggregates wins, draws, losses, and goals properly', () => {
  const summary = computeH2HSummary(
    [
      { id: '1', dateIso: '2026-03-01T15:00:00Z', competitionName: 'Premier League', homeTeamId: '359', awayTeamId: '363', homeName: 'Arsenal', awayName: 'Chelsea', homeScore: 2, awayScore: 1, winnerSide: 'home' },
      { id: '2', dateIso: '2025-10-12T15:00:00Z', competitionName: 'Premier League', homeTeamId: '363', awayTeamId: '359', homeName: 'Chelsea FC', awayName: 'Arsenal FC', homeScore: 1, awayScore: 1, winnerSide: 'draw' },
      { id: '3', dateIso: '2025-02-02T15:00:00Z', competitionName: 'FA Cup', homeTeamId: '363', awayTeamId: '359', homeName: 'Chelsea', awayName: 'Arsenal', homeScore: 3, awayScore: 0, winnerSide: 'home' },
    ],
    'Arsenal',
    'Chelsea',
    '359',
    '363'
  );
  assert.equal(summary.homeWins, 1);
  assert.equal(summary.draws, 1);
  assert.equal(summary.awayWins, 1);
  assert.equal(summary.homeGoals, 3);
  assert.equal(summary.awayGoals, 5);
});

test('detectMatchChanges respects per-favorite-club custom notification overrides', () => {
  const prev: MatchItem[] = [
    baseMatch({
      id: 'c1',
      status: 'live',
      minuteDisplay: "60'",
      summaryCounters: { redCards: 0, yellowCards: 1, substitutions: 1 },
      home: { id: 'club-a', name: 'Club A', shortName: 'A', abbreviation: 'A', logo: '', score: 1 },
      away: { id: 'club-b', name: 'Club B', shortName: 'B', abbreviation: 'B', logo: '', score: 0 },
    }),
  ];
  const next: MatchItem[] = [
    baseMatch({
      id: 'c1',
      status: 'finished',
      statusText: 'Terminé',
      minuteDisplay: "90'",
      summaryCounters: { redCards: 1, yellowCards: 2, substitutions: 2 },
      home: { id: 'club-a', name: 'Club A', shortName: 'A', abbreviation: 'A', logo: '', score: 2 },
      away: { id: 'club-b', name: 'Club B', shortName: 'B', abbreviation: 'B', logo: '', score: 0 },
    }),
  ];

  // Club A wants ONLY substitutions & cards (suppresses goals and finalResult)
  const alertsA = detectMatchChanges(
    prev,
    next,
    DEFAULT_NOTIFICATION_PREFS,
    new Set(['club-a']),
    new Set(),
    {
      'club-a': {
        customized: true,
        goals: false,
        cards: true,
        substitutions: true,
        finalResult: false,
      },
    }
  );

  assert.equal(alertsA.some((a) => a.kind === 'goal'), false);
  assert.equal(alertsA.some((a) => a.kind === 'fulltime'), false);
  assert.equal(alertsA.some((a) => a.kind === 'red-card'), true);
  assert.equal(alertsA.some((a) => a.kind === 'yellow-card'), true);
  assert.equal(alertsA.some((a) => a.kind === 'substitution'), true);
});

test('detectScoreChangeSides highlights only sides whose numeric score changed', () => {
  assert.deepEqual(detectScoreChangeSides(null, null, 0, 0), {
    homeChanged: false,
    awayChanged: false,
  });
  assert.deepEqual(detectScoreChangeSides(1, 0, 1, 0), {
    homeChanged: false,
    awayChanged: false,
  });
  assert.deepEqual(detectScoreChangeSides(1, 0, 2, 0), {
    homeChanged: true,
    awayChanged: false,
  });
  assert.deepEqual(detectScoreChangeSides(0, 1, 0, 2), {
    homeChanged: false,
    awayChanged: true,
  });
  assert.deepEqual(detectScoreChangeSides(1, 1, 2, 2), {
    homeChanged: true,
    awayChanged: true,
  });
});
