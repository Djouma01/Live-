import type { PlayerProfileInfo, PlayerSeasonSplit } from './football.ts';

function toFiniteNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function hasAnyDefinedStat(stats: Record<string, number | undefined>): boolean {
  return Object.values(stats).some((v) => typeof v === 'number' && Number.isFinite(v));
}

export function extractEspnRosterStats(athlete: any): PlayerProfileInfo['stats'] | undefined {
  const categories = Array.isArray(athlete?.statistics?.splits?.categories)
    ? athlete.statistics.splits.categories
    : [];
  if (categories.length === 0) return undefined;

  const byName = new Map<string, number>();
  for (const cat of categories) {
    const statList = Array.isArray(cat?.stats) ? cat.stats : [];
    for (const s of statList) {
      const name = String(s?.name || '').trim();
      const val = toFiniteNumber(s?.value ?? s?.displayValue);
      if (name && val !== undefined) {
        byName.set(name, val);
      }
    }
  }

  if (byName.size === 0) return undefined;

  const stats: NonNullable<PlayerProfileInfo['stats']> = {
    appearances: byName.get('appearances'),
    starts: byName.get('starts'),
    subIns: byName.get('subIns'),
    minutesPlayed: byName.get('minutes') ?? byName.get('minutesPlayed'),
    goals: byName.get('totalGoals') ?? byName.get('goals'),
    assists: byName.get('goalAssists') ?? byName.get('assists'),
    shots: byName.get('totalShots') ?? byName.get('shots'),
    shotsOnTarget: byName.get('shotsOnTarget'),
    foulsCommitted: byName.get('foulsCommitted'),
    foulsSuffered: byName.get('foulsSuffered'),
    offsides: byName.get('offsides'),
    ownGoals: byName.get('ownGoals'),
    yellowCards: byName.get('yellowCards'),
    redCards: byName.get('redCards'),
    saves: byName.get('saves'),
    cleanSheets: byName.get('cleanSheet') ?? byName.get('cleanSheets'),
    goalsConceded: byName.get('goalsConceded'),
  };

  return hasAnyDefinedStat(stats) ? stats : undefined;
}

export function parseEspnRosterAthlete(
  athlete: any,
  teamCtx: {
    teamId: string;
    teamName: string;
    competitionId?: string;
    competitionName?: string;
    seasonLabel?: string;
  }
): PlayerProfileInfo | null {
  const id = String(athlete?.id || '').trim();
  const name = String(athlete?.displayName || athlete?.fullName || '').trim();
  if (!id || !name) return null;

  return {
    id,
    name,
    teamId: teamCtx.teamId,
    teamName: teamCtx.teamName || 'Club',
    competitionId: teamCtx.competitionId,
    competitionName: teamCtx.competitionName,
    nationality: athlete?.citizenship ? String(athlete.citizenship) : undefined,
    position:
      athlete?.position?.displayName ||
      athlete?.position?.name ||
      athlete?.position?.abbreviation ||
      undefined,
    jersey: athlete?.jersey ? String(athlete.jersey) : undefined,
    age: toFiniteNumber(athlete?.age),
    height: athlete?.displayHeight ? String(athlete.displayHeight) : undefined,
    weight: athlete?.displayWeight ? String(athlete.displayWeight) : undefined,
    seasonLabel: teamCtx.seasonLabel,
    source: 'espn',
    stats: extractEspnRosterStats(athlete),
  };
}

export function parseEspnAthleteOverviewToProfile(
  athletePayload: any,
  overviewPayload: any,
  fallback?: Partial<PlayerProfileInfo>
): PlayerProfileInfo | null {
  const ath = athletePayload?.athlete || athletePayload;
  const id = String(ath?.id || fallback?.id || '').trim();
  const name = String(ath?.displayName || ath?.fullName || fallback?.name || '').trim();
  if (!id || !name) return null;

  const statsRoot = overviewPayload?.statistics;
  const names: string[] = Array.isArray(statsRoot?.names) ? statsRoot.names.map(String) : [];
  const rawSplits: any[] = Array.isArray(statsRoot?.splits) ? statsRoot.splits : [];

  // Map teamId -> display name from filters if available
  const teamNamesById = new Map<string, string>();
  const filters = Array.isArray(statsRoot?.filters) ? statsRoot.filters : [];
  for (const f of filters) {
    if (f?.name === 'team' && Array.isArray(f?.options)) {
      for (const opt of f.options) {
        if (opt?.value && opt?.displayValue) {
          teamNamesById.set(String(opt.value), String(opt.displayValue));
        }
      }
    }
  }

  const seasonSplits: PlayerSeasonSplit[] = [];
  for (let i = 0; i < rawSplits.length; i += 1) {
    const sp = rawSplits[i];
    const values: any[] = Array.isArray(sp?.stats) ? sp.stats : [];
    const lookup = new Map<string, number>();
    for (let j = 0; j < names.length && j < values.length; j += 1) {
      const val = toFiniteNumber(values[j]);
      if (val !== undefined) {
        lookup.set(names[j], val);
      }
    }
    if (lookup.size === 0) continue;

    const split: PlayerSeasonSplit = {
      id: `${sp?.leagueSlug || 'split'}-${sp?.teamId || i}-${i}`,
      seasonName: String(sp?.displayName || sp?.leagueSlug || `Compétition ${i + 1}`),
      teamName: sp?.teamId ? teamNamesById.get(String(sp.teamId)) : undefined,
      leagueSlug: sp?.leagueSlug ? String(sp.leagueSlug) : undefined,
      appearances: lookup.get('appearances'),
      starts: lookup.get('starts'),
      minutesPlayed: lookup.get('minutes') ?? lookup.get('minutesPlayed'),
      goals: lookup.get('totalGoals') ?? lookup.get('goals'),
      assists: lookup.get('goalAssists') ?? lookup.get('assists'),
      shots: lookup.get('totalShots') ?? lookup.get('shots'),
      shotsOnTarget: lookup.get('shotsOnTarget'),
      foulsCommitted: lookup.get('foulsCommitted'),
      foulsSuffered: lookup.get('foulsSuffered'),
      offsides: lookup.get('offsides'),
      yellowCards: lookup.get('yellowCards'),
      redCards: lookup.get('redCards'),
      saves: lookup.get('saves'),
      cleanSheets: lookup.get('cleanSheet') ?? lookup.get('cleanSheets'),
      goalsConceded: lookup.get('goalsConceded'),
    };
    seasonSplits.push(split);
  }

  // Aggregate numeric totals across club splits of the current primary season when available,
  // or keep primary league split stats as summary if roster stats aren't present
  let aggregatedStats: PlayerProfileInfo['stats'] | undefined = fallback?.stats;
  if (!aggregatedStats && seasonSplits.length > 0) {
    const sumField = (
      getter: (s: PlayerSeasonSplit) => number | undefined
    ): number | undefined => {
      let hasValue = false;
      let total = 0;
      for (const s of seasonSplits) {
        const v = getter(s);
        if (typeof v === 'number' && Number.isFinite(v)) {
          total += v;
          hasValue = true;
        }
      }
      return hasValue ? total : undefined;
    };

    const candidate: NonNullable<PlayerProfileInfo['stats']> = {
      appearances: sumField((s) => s.appearances),
      starts: sumField((s) => s.starts),
      minutesPlayed: sumField((s) => s.minutesPlayed),
      goals: sumField((s) => s.goals),
      assists: sumField((s) => s.assists),
      shots: sumField((s) => s.shots),
      shotsOnTarget: sumField((s) => s.shotsOnTarget),
      foulsCommitted: sumField((s) => s.foulsCommitted),
      foulsSuffered: sumField((s) => s.foulsSuffered),
      offsides: sumField((s) => s.offsides),
      yellowCards: sumField((s) => s.yellowCards),
      redCards: sumField((s) => s.redCards),
      saves: sumField((s) => s.saves),
      cleanSheets: sumField((s) => s.cleanSheets),
      goalsConceded: sumField((s) => s.goalsConceded),
    };
    if (hasAnyDefinedStat(candidate)) {
      aggregatedStats = candidate;
    }
  }

  return {
    id,
    name,
    teamId: String(ath?.team?.id || fallback?.teamId || ''),
    teamName: String(ath?.team?.displayName || fallback?.teamName || 'Club'),
    competitionId: String(athletePayload?.league?.slug || fallback?.competitionId || '') || undefined,
    competitionName: String(athletePayload?.league?.name || fallback?.competitionName || '') || undefined,
    nationality: ath?.citizenship ? String(ath.citizenship) : fallback?.nationality,
    position:
      ath?.position?.displayName ||
      ath?.position?.name ||
      ath?.position?.abbreviation ||
      fallback?.position,
    jersey: ath?.jersey ? String(ath.jersey) : fallback?.jersey,
    age: toFiniteNumber(ath?.age) ?? fallback?.age,
    height: ath?.displayHeight ? String(ath.displayHeight) : fallback?.height,
    weight: ath?.displayWeight ? String(ath.displayWeight) : fallback?.weight,
    seasonLabel:
      athletePayload?.season?.displayName ||
      seasonSplits[0]?.seasonName ||
      fallback?.seasonLabel,
    source: 'espn',
    stats: aggregatedStats,
    seasonSplits: seasonSplits.length > 0 ? seasonSplits : undefined,
  };
}

export function mergePlayerProfiles(
  base: PlayerProfileInfo,
  detail: PlayerProfileInfo | null
): PlayerProfileInfo {
  if (!detail) return base;

  const matchingClubSplit =
    base.stats && detail.seasonSplits
      ? detail.seasonSplits.find(
          (s) =>
            (!base.competitionId || s.leagueSlug === base.competitionId) &&
            (!s.teamName || !base.teamName || s.teamName.toLowerCase() === base.teamName.toLowerCase())
        )
      : undefined;

  const detailStatsFallback = base.stats
    ? matchingClubSplit
      ? {
          starts: matchingClubSplit.starts,
          appearances: matchingClubSplit.appearances,
          minutesPlayed: matchingClubSplit.minutesPlayed,
          goals: matchingClubSplit.goals,
          assists: matchingClubSplit.assists,
          shots: matchingClubSplit.shots,
          shotsOnTarget: matchingClubSplit.shotsOnTarget,
          foulsCommitted: matchingClubSplit.foulsCommitted,
          foulsSuffered: matchingClubSplit.foulsSuffered,
          offsides: matchingClubSplit.offsides,
          yellowCards: matchingClubSplit.yellowCards,
          redCards: matchingClubSplit.redCards,
          saves: matchingClubSplit.saves,
          cleanSheets: matchingClubSplit.cleanSheets,
          goalsConceded: matchingClubSplit.goalsConceded,
        }
      : undefined
    : detail.stats;

  const mergedStats =
    base.stats || detailStatsFallback
      ? {
          ...(detailStatsFallback || {}),
          ...(base.stats || {}),
          starts: base.stats?.starts ?? detailStatsFallback?.starts,
          appearances: base.stats?.appearances ?? detailStatsFallback?.appearances,
          subIns: base.stats?.subIns ?? (detailStatsFallback as PlayerProfileInfo['stats'] | undefined)?.subIns,
          minutesPlayed: base.stats?.minutesPlayed ?? detailStatsFallback?.minutesPlayed,
          goals: base.stats?.goals ?? detailStatsFallback?.goals,
          assists: base.stats?.assists ?? detailStatsFallback?.assists,
          shots: base.stats?.shots ?? detailStatsFallback?.shots,
          shotsOnTarget: base.stats?.shotsOnTarget ?? detailStatsFallback?.shotsOnTarget,
          foulsCommitted: base.stats?.foulsCommitted ?? detailStatsFallback?.foulsCommitted,
          foulsSuffered: base.stats?.foulsSuffered ?? detailStatsFallback?.foulsSuffered,
          offsides: base.stats?.offsides ?? detailStatsFallback?.offsides,
          ownGoals: base.stats?.ownGoals ?? (detailStatsFallback as PlayerProfileInfo['stats'] | undefined)?.ownGoals,
          yellowCards: base.stats?.yellowCards ?? detailStatsFallback?.yellowCards,
          redCards: base.stats?.redCards ?? detailStatsFallback?.redCards,
          saves: base.stats?.saves ?? detailStatsFallback?.saves,
          cleanSheets: base.stats?.cleanSheets ?? detailStatsFallback?.cleanSheets,
          goalsConceded: base.stats?.goalsConceded ?? detailStatsFallback?.goalsConceded,
        }
      : undefined;

  return {
    ...base,
    ...detail,
    teamId: detail.teamId || base.teamId,
    teamName: detail.teamName && detail.teamName !== 'Club' ? detail.teamName : base.teamName,
    competitionId: detail.competitionId || base.competitionId,
    competitionName: detail.competitionName || base.competitionName,
    nationality: detail.nationality || base.nationality,
    position: detail.position || base.position,
    jersey: detail.jersey || base.jersey,
    age: detail.age ?? base.age,
    height: detail.height || base.height,
    weight: detail.weight || base.weight,
    seasonLabel: detail.seasonLabel || base.seasonLabel,
    stats: mergedStats,
    seasonSplits:
      detail.seasonSplits && detail.seasonSplits.length > 0
        ? detail.seasonSplits
        : base.seasonSplits,
  };
}
