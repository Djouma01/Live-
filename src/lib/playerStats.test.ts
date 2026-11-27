import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mergePlayerProfiles,
  parseEspnAthleteOverviewToProfile,
  parseEspnRosterAthlete,
} from './playerStats.ts';

test('parseEspnRosterAthlete extracts bio and seasonal stats categories without inventing missing stats', () => {
  const athlete = {
    id: '134190',
    displayName: 'Chris Wood',
    citizenship: 'New Zealand',
    jersey: '11',
    age: 34,
    displayHeight: '6\' 3"',
    displayWeight: '203 lbs',
    position: { displayName: 'Forward' },
    statistics: {
      splits: {
        categories: [
          {
            name: 'general',
            stats: [
              { name: 'appearances', value: 9 },
              { name: 'subIns', value: 9 },
              { name: 'yellowCards', value: 0 },
              { name: 'redCards', value: 0 },
              { name: 'foulsCommitted', value: 2 },
              { name: 'foulsSuffered', value: 2 },
            ],
          },
          {
            name: 'offensive',
            stats: [
              { name: 'totalGoals', value: 3 },
              { name: 'goalAssists', value: 1 },
              { name: 'totalShots', value: 14 },
              { name: 'shotsOnTarget', value: 6 },
              { name: 'offsides', value: 2 },
            ],
          },
        ],
      },
    },
  };

  const parsed = parseEspnRosterAthlete(athlete, {
    teamId: '393',
    teamName: 'Nottingham Forest',
    competitionId: 'eng.1',
    competitionName: 'Premier League',
    seasonLabel: '2026-27 English Premier League',
  });

  assert.ok(parsed);
  assert.equal(parsed.id, '134190');
  assert.equal(parsed.name, 'Chris Wood');
  assert.equal(parsed.height, '6\' 3"');
  assert.equal(parsed.weight, '203 lbs');
  assert.equal(parsed.stats?.appearances, 9);
  assert.equal(parsed.stats?.subIns, 9);
  assert.equal(parsed.stats?.goals, 3);
  assert.equal(parsed.stats?.assists, 1);
  assert.equal(parsed.stats?.shots, 14);
  assert.equal(parsed.stats?.shotsOnTarget, 6);
  assert.equal(parsed.stats?.foulsCommitted, 2);
  assert.equal(parsed.stats?.saves, undefined);
});

test('parseEspnAthleteOverviewToProfile parses multi-competition splits cleanly', () => {
  const athletePayload = {
    athlete: {
      id: '179497',
      displayName: 'Matz Sels',
      citizenship: 'Belgium',
      jersey: '26',
      age: 34,
      position: { displayName: 'Goalkeeper' },
    },
    league: { slug: 'eng.1', name: 'English Premier League' },
    season: { displayName: '2026-27 English Premier League' },
  };

  const overviewPayload = {
    statistics: {
      names: [
        'starts',
        'foulsCommitted',
        'foulsSuffered',
        'yellowCards',
        'redCards',
        'totalGoals',
        'goalAssists',
        'totalShots',
        'shotsOnTarget',
        'offsides',
        'cleanSheet',
        'saves',
        'goalsConceded',
      ],
      filters: [
        {
          name: 'team',
          options: [{ value: '393', displayValue: 'Nottingham Forest' }],
        },
      ],
      splits: [
        {
          displayName: '2026-27 English Premier League',
          teamId: '393',
          leagueSlug: 'eng.1',
          stats: ['11', '0', '1', '0', '0', '0', '0', '0', '0', '0', '1', '24', '15'],
        },
        {
          displayName: '2026-27 Carabao Cup',
          teamId: '393',
          leagueSlug: 'eng.league_cup',
          stats: ['1', '0', '1', '0', '0', '0', '0', '0', '0', '0', '0', '3', '2'],
        },
      ],
    },
  };

  const profile = parseEspnAthleteOverviewToProfile(athletePayload, overviewPayload);
  assert.ok(profile);
  assert.equal(profile.seasonSplits?.length, 2);
  assert.equal(profile.seasonSplits?.[0].seasonName, '2026-27 English Premier League');
  assert.equal(profile.seasonSplits?.[0].teamName, 'Nottingham Forest');
  assert.equal(profile.seasonSplits?.[0].starts, 11);
  assert.equal(profile.seasonSplits?.[0].saves, 24);
  assert.equal(profile.seasonSplits?.[0].cleanSheets, 1);
  assert.equal(profile.seasonSplits?.[0].goalsConceded, 15);

  assert.equal(profile.stats?.starts, 12);
  assert.equal(profile.stats?.saves, 27);
  assert.equal(profile.stats?.cleanSheets, 1);
});

test('mergePlayerProfiles preserves roster stats while attaching matching club starts and overview splits', () => {
  const base = parseEspnRosterAthlete(
    {
      id: '10',
      displayName: 'Test Player',
      statistics: {
        splits: {
          categories: [
            { name: 'general', stats: [{ name: 'appearances', value: 9 }] },
            { name: 'offensive', stats: [{ name: 'totalGoals', value: 5 }] },
          ],
        },
      },
    },
    { teamId: '1', teamName: 'Club A', competitionId: 'ksa.1' }
  )!;

  const detail = parseEspnAthleteOverviewToProfile(
    { athlete: { id: '10', displayName: 'Test Player', displayHeight: '1.82 m' } },
    {
      statistics: {
        names: ['starts', 'totalGoals'],
        filters: [
          {
            name: 'team',
            options: [
              { value: '1', displayValue: 'Club A' },
              { value: '2', displayValue: 'National Team' },
            ],
          },
        ],
        splits: [
          { displayName: '2026-27 Nations League', teamId: '2', leagueSlug: 'uefa.nations', stats: ['7', '0'] },
          { displayName: '2026-27 Saudi Pro League', teamId: '1', leagueSlug: 'ksa.1', stats: ['9', '5'] },
        ],
      },
    }
  );

  const merged = mergePlayerProfiles(base, detail);
  assert.equal(merged.stats?.appearances, 9);
  assert.equal(merged.stats?.starts, 9);
  assert.equal(merged.stats?.goals, 5);
  assert.equal(merged.height, '1.82 m');
  assert.equal(merged.seasonSplits?.length, 2);
});
