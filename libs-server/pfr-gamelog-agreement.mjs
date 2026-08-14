/*
  The reference probe behind the `pfr-gamelog-agreement` registered data check:
  our per-week stat totals against Pro Football Reference's, at (season_year,
  week, stat) grain.

  ## It reads the cache and never fetches

  `get_player_gamelogs_for_season` in private/libs-server crawls one page per
  game with an 8-second wait -- roughly 36 minutes per season through a stealth
  browser against a site that blocks scrapers. A check that fetches acquires the
  upstream's failure modes, its latency and its blocking behaviour on a schedule
  nobody is watching, so this grades what the cache holds and reports what it
  cannot grade. Refreshing the cache stays the importer's job.

  ## The precondition is load-bearing, not a detail

  `min_rate` is ONE-SIDED, and an agreement comparison is two-sided: ours 816
  against PFR 817 fails correctly, but 817 against 816 PASSES, as does every one
  of the ratios up to 5.5 that grading a partially-crawled 2025 produced. A
  stale reference makes our data look EXCESS rather than deficient, which a
  floor cannot see.

  So reference completeness gates gradeability: a week is graded only when PFR's
  distinct game count equals ours. Bye weeks make per-week counts genuinely vary
  from 13 to 16, so a fixed expected count would be wrong; equality against our
  own count is the comparison that holds. This is the only thing catching a
  reference that is BEHIND ours, and the check's calibration says so.
*/

import db from '#db'
import { get } from './cache.mjs'

// The 13 stat fields both corpora carry, PFR's key against ours. PFR's
// per-season file and its per-game files agree on every one of them, so the two
// are interchangeable as a reference.
export const SHARED_STAT_FIELDS = {
  pa: 'passing_attempts',
  pc: 'passing_completions',
  py: 'passing_yards',
  ints: 'passing_interceptions',
  tdp: 'passing_touchdowns',
  ra: 'rushing_attempts',
  ry: 'rushing_yards',
  tdr: 'rushing_touchdowns',
  fuml: 'fumbles_lost',
  trg: 'targets',
  rec: 'receptions',
  recy: 'receiving_yards',
  tdrec: 'receiving_touchdowns'
}

const GRADED_SEASON_TYPE = 'REG'

const read_reference_season = async ({ season_year }) => {
  const rows = await get({
    key: `/pro-football-reference/player-gamelogs/${season_year}.json`
  })

  if (!Array.isArray(rows)) {
    throw new Error(
      `pfr-gamelog-agreement: cache returned no usable array for ${season_year}`
    )
  }

  const by_week = new Map()

  for (const row of rows) {
    if (row.seas_type !== GRADED_SEASON_TYPE) continue

    const week = Number(row.week)
    if (!Number.isFinite(week)) continue

    if (!by_week.has(week)) {
      by_week.set(week, { games: new Set(), totals: {} })
    }

    const bucket = by_week.get(week)
    bucket.games.add(row.pfr_game_id)

    for (const field of Object.keys(SHARED_STAT_FIELDS)) {
      const value = Number(row[field])
      if (!Number.isFinite(value)) continue
      bucket.totals[field] = (bucket.totals[field] || 0) + value
    }
  }

  return by_week
}

const read_our_season = async ({ season_year }) => {
  const sum_columns = Object.values(SHARED_STAT_FIELDS).map((column) =>
    db.raw(`sum(coalesce(g.??, 0)) as ??`, [column, column])
  )

  const rows = await db('player_gamelogs as g')
    .join('nfl_games as ng', 'ng.esbid', 'g.esbid')
    .select('ng.week')
    .select(db.raw('count(distinct g.esbid) as games'))
    .select(sum_columns)
    .where('ng.season_year', season_year)
    .where('ng.season_type', GRADED_SEASON_TYPE)
    .groupBy('ng.week')

  return new Map(rows.map((row) => [Number(row.week), row]))
}

/**
 * One row per (season_year, week, stat).
 *
 * `numerator` is OUR total and `denominator` is the reference's, so the ratio
 * is ours/theirs and exact agreement is 1.0. `reference_games` and `our_games`
 * ride along for the precondition, which is declared on the registry entry
 * rather than here so the gate is visible beside the threshold it protects.
 */
export const pfr_gamelog_agreement_rows = async ({ season_years }) => {
  const rows = []

  for (const season_year of season_years) {
    const reference = await read_reference_season({ season_year })
    const ours = await read_our_season({ season_year })

    for (const [week, bucket] of reference) {
      const our_week = ours.get(week)

      for (const [field, column] of Object.entries(SHARED_STAT_FIELDS)) {
        rows.push({
          season_year,
          week,
          stat: column,
          reference_games: bucket.games.size,
          our_games: our_week ? Number(our_week.games) : 0,
          numerator: our_week ? Number(our_week[column]) : 0,
          denominator: bucket.totals[field] || 0
        })
      }
    }
  }

  return rows
}
