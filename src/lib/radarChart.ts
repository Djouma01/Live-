import type { StatPair } from './football';

export interface RadarMetricPoint {
  key: string;
  label: string;
  homeRaw: string;
  awayRaw: string;
  homeNumeric: number;
  awayNumeric: number;
  maxScale: number;
  homeNormalized: number;
  awayNormalized: number;
}

const RADAR_AXIS_CONFIG: Array<{
  key: string;
  label: string;
  fixedMax?: number;
  minAdaptiveMax: number;
}> = [
  { key: 'possessionPct', label: 'Possession', fixedMax: 100, minAdaptiveMax: 100 },
  { key: 'shotsOnTarget', label: 'Tirs cadrés', minAdaptiveMax: 6 },
  { key: 'wonCorners', label: 'Corners', minAdaptiveMax: 6 },
  { key: 'totalShots', label: 'Tirs totaux', minAdaptiveMax: 12 },
  { key: 'saves', label: 'Arrêts', minAdaptiveMax: 6 },
];

export function buildRadarMetrics(statistics: StatPair[]): RadarMetricPoint[] {
  const byKey = new Map(statistics.map((s) => [s.key, s]));
  const points: RadarMetricPoint[] = [];

  for (const cfg of RADAR_AXIS_CONFIG) {
    const stat = byKey.get(cfg.key);
    if (!stat) continue;

    const hNum = Math.max(0, Number.isFinite(stat.homeNumeric) ? stat.homeNumeric : 0);
    const aNum = Math.max(0, Number.isFinite(stat.awayNumeric) ? stat.awayNumeric : 0);
    const peak = Math.max(hNum, aNum);

    const maxScale = cfg.fixedMax
      ? cfg.fixedMax
      : Math.max(cfg.minAdaptiveMax, Math.ceil(peak * 1.15));

    const homeNormalized = maxScale > 0 ? Math.min(1, hNum / maxScale) : 0;
    const awayNormalized = maxScale > 0 ? Math.min(1, aNum / maxScale) : 0;

    points.push({
      key: cfg.key,
      label: cfg.label,
      homeRaw: stat.homeValue,
      awayRaw: stat.awayValue,
      homeNumeric: hNum,
      awayNumeric: aNum,
      maxScale,
      homeNormalized,
      awayNormalized,
    });
  }

  return points;
}
