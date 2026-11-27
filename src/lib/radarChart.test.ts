import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildRadarMetrics } from './radarChart.ts';
import type { StatPair } from './football.ts';

describe('buildRadarMetrics', () => {
  it('normalizes possession, shots on target, corners, total shots, and saves cleanly', () => {
    const stats: StatPair[] = [
      { key: 'possessionPct', label: 'Possession du ballon (%)', homeValue: '60%', awayValue: '40%', homeNumeric: 60, awayNumeric: 40 },
      { key: 'totalShots', label: 'Tirs totaux', homeValue: '18', awayValue: '9', homeNumeric: 18, awayNumeric: 9 },
      { key: 'shotsOnTarget', label: 'Tirs cadrés', homeValue: '8', awayValue: '3', homeNumeric: 8, awayNumeric: 3 },
      { key: 'wonCorners', label: 'Corners', homeValue: '7', awayValue: '4', homeNumeric: 7, awayNumeric: 4 },
      { key: 'saves', label: 'Arrêts des gardiens', homeValue: '2', awayValue: '6', homeNumeric: 2, awayNumeric: 6 },
    ];

    const metrics = buildRadarMetrics(stats);
    assert.equal(metrics.length, 5);
    assert.deepEqual(
      metrics.map((m) => m.label),
      ['Possession', 'Tirs cadrés', 'Corners', 'Tirs totaux', 'Arrêts']
    );

    const poss = metrics[0];
    assert.equal(poss.maxScale, 100);
    assert.equal(poss.homeNormalized, 0.6);
    assert.equal(poss.awayNormalized, 0.4);

    const shotsOnTarget = metrics[1];
    assert.equal(shotsOnTarget.maxScale, 10); // ceil(8 * 1.15) = 10
    assert.equal(shotsOnTarget.homeNormalized, 0.8);
    assert.equal(shotsOnTarget.awayNormalized, 0.3);
  });

  it('clamps values safely and handles minimal 3-axis datasets', () => {
    const stats: StatPair[] = [
      { key: 'possessionPct', label: 'Possession', homeValue: '50%', awayValue: '50%', homeNumeric: 50, awayNumeric: 50 },
      { key: 'shotsOnTarget', label: 'Tirs cadrés', homeValue: '0', awayValue: '0', homeNumeric: 0, awayNumeric: 0 },
      { key: 'wonCorners', label: 'Corners', homeValue: '3', awayValue: '1', homeNumeric: 3, awayNumeric: 1 },
    ];

    const metrics = buildRadarMetrics(stats);
    assert.equal(metrics.length, 3);
    assert.equal(metrics[1].homeNormalized, 0);
    assert.equal(metrics[2].maxScale, 6);
    assert.equal(metrics[2].homeNormalized, 0.5);
  });
});
