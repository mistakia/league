// @ts-check
/*
  Rows for the `dfs-salary-source-week-coverage` and
  `betting-market-source-week-coverage` data checks.

  The hole these fill. Every importer here reports its outcome through
  `report_job`, and NONE of the oracles those runs carry can fire when the run
  wrote nothing:

  - `import-fanduel-salaries.mjs` filters upstream fixture lists to `sport ===
    'NFL'`, and when none match it logs a line and returns. Four runs on
    2026-09-01 recorded `is_successful: true` while `player_salaries` held zero
    FANDUEL rows for 2026 -- 88,637 rows all-time, none newer than the 2025
    season.
  - `import-caesars-odds-v4.mjs` carries two oracles and neither measures
    VOLUME. The empty-schedule check needs `schedule.length === 0` against a
    257-event schedule, and the match-rate check is gated on
    `game_shaped_event_count > 0`, which was 0. Caesars wrote nothing to
    `prop_markets_history` for 27 hours across 31 consecutive successful runs.

  Both are the same shape: an oracle that measures a RATIO or a SHAPE cannot
  fire on zero output, because zero output has no ratio and no shape. And the
  half a per-run oracle structurally cannot cover is a run that returns early --
  it never reaches its own check -- which is why this judgment is made from
  OUTSIDE the run, against what the tables hold.

  ## Why the grain is a completed NFL week and not a rolling window

  A rolling-window liveness measure is the obvious instrument and it does not
  survive calibration. Measured 2026-09-02 over the 2025 season, per-source
  write gaps in `prop_markets_history` reach 40 hours for Caesars, 95 for
  FanDuel and 76 for Pinnacle with nothing wrong -- so any window short enough
  to catch the 27-hour Caesars outage promptly fires constantly on healthy data.
  Sweeping window widths from 24h to 168h, a 24-hour window would have produced
  a zero reading while siblings were busy in 51 of 513 sampled windows for
  Caesars and 101 of 513 for FanDuel.

  `player_salaries.created_at` fails the same test for a different reason: the
  table is upserted, so a re-import of an existing slate bumps nothing, and a
  2026-09-01 backfill rewrote the historical distribution outright. Measured
  over the 2025 season, the median DRAFTKINGS reading in a trailing 96-hour
  window is 0. An upserted table cannot answer a liveness question.

  A completed NFL week is the smallest unit that is unambiguous on both tables:
  every source that was ever going to write for a week has written by the time
  the week is over. The cost is detection latency of up to a week, which is the
  right trade for an instrument whose defect class ran thirteen months
  undetected on Caesars and a full season on FanDuel.
*/

import db from '#db'

import { recent_completed_fantasy_weeks } from './projection-source-week-coverage.mjs'

/**
 * The DFS books we run a salary importer for, DECLARED rather than derived from
 * what `player_salaries` happens to hold. Deriving it would define the healthy
 * state as whatever landed and could never report an absence, which is the
 * entire failure this check exists to catch.
 *
 * Both correspond to a live scheduler as of 2026-09-02:
 * `user:scheduled-command/league/import-draftkings-dfs-salaries.md` and the
 * pair `import-fanduel-dfs-salaries-thu-fri.md` / `-sat.md`. Neither appears in
 * any crontab -- they migrated out of `private/crontab/crontab-local.cron` on
 * 2026-08-03 -- so a crontab sweep reads as "nothing schedules this".
 */
export const EXPECTED_DFS_SALARY_SOURCES = ['DRAFTKINGS', 'FANDUEL']

/**
 * A DFS book covered a week when it wrote at least this many salary rows
 * against that week's games.
 *
 * Calibrated on the GAP, not on the worst normal reading. Measured 2026-09-02
 * over 2024 and 2025 REG weeks: healthy per-source weeks run 1,793 to 3,117 for
 * DraftKings and 1,959 to 4,099 for FanDuel, while the defective reading is
 * exactly 0 -- FanDuel at 2025 weeks 1, 2 and 7, and again at 2026 week 1. 500
 * sits below a third of the smallest healthy reading and infinitely above the
 * defective one, so a book trimming its slate cannot trip it and a book going
 * quiet cannot clear it.
 *
 * One partial sits between the two: FanDuel wrote 379 rows for 2025 week 12,
 * roughly a seventh of its normal week. That is a real finding rather than a
 * calibration problem, and it is outside this check's window in any case.
 */
export const MINIMUM_WEEKLY_DFS_SALARY_ROWS = 500

/**
 * The sportsbooks we run an odds importer for, with a per-source weekly floor.
 *
 * The floors are per-source rather than shared because the volumes span two
 * orders of magnitude: a shared floor low enough for Pinnacle would let
 * DraftKings collapse by 99 percent and still pass, which is the saturating
 * measure `user:guideline/software/design-data-checks.md` warns about.
 *
 * Calibrated 2026-09-02 over all 36 REG weeks of 2024 and 2025. Each floor sits
 * near a third of that source's smallest HEALTHY week, against a defective
 * reading of exactly 0:
 *
 *   source      smallest healthy week   median   floor
 *   CAESARS                     2,633   16,365     800
 *   DRAFTKINGS                 10,417  135,378   3,000
 *   FANDUEL                     1,671    3,633     500
 *   PINNACLE                       46    1,791      15
 *   PRIZEPICKS                  2,098    4,875     700
 *
 * The two-season window is not incidental. A first pass calibrated DraftKings
 * on 2025 weeks 4-18 alone, where its smallest week is 149,151, and a floor of
 * 40,000 taken from that sample reported 2025 weeks 1 and 2 as findings -- the
 * season opener runs an order of magnitude below midseason for every book, and
 * a sample that skips the ramp produces a floor that fires every September.
 *
 * Two zero readings were deliberately excluded from the healthy sample rather
 * than allowed to widen a floor: Caesars at 2025 weeks 1-2 (the esbid match-gap
 * outage, repaired 2025-09-19) and PrizePicks at 2025 week 18. Both are exactly
 * what this check exists to report, and calibrating around them would have
 * laundered them into acceptable drift.
 *
 * PINNACLE is the honest exception. Its healthy weeks span 46 to 82,725 rows --
 * three orders of magnitude -- so no floor can be both free of false positives
 * and a real volume measure for it. 15 makes its row a ZERO-DETECTOR and
 * nothing more, which still covers the defect class this check exists for; it
 * does not cover a Pinnacle collapse that stops short of silence.
 *
 * BetMGM and BetRivers are deliberately absent -- neither has a live scheduler,
 * so their silence is expected rather than a finding.
 */
export const EXPECTED_BETTING_MARKET_SOURCES = [
  { source_id: 'CAESARS', rows_required: 800 },
  { source_id: 'DRAFTKINGS', rows_required: 3000 },
  { source_id: 'FANDUEL', rows_required: 500 },
  { source_id: 'PINNACLE', rows_required: 15 },
  { source_id: 'PRIZEPICKS', rows_required: 700 }
]

/**
 * A week's betting window: from five days before its first kickoff to two days
 * after its last, which is the span over which books post, move and settle that
 * week's markets.
 *
 * `nfl_games.date` is a `YYYY/MM/DD` VARCHAR, not a date -- building a
 * comparison against it with '-' separators made a Caesars predicate
 * unsatisfiable for thirteen months. Parsed with an explicit format here for
 * that reason.
 *
 * @param {{ season_year: number, week: number }[]} weeks
 * @returns {Promise<Map<string, { start: Date, end: Date }>>}
 */
const betting_windows_for_weeks = async (weeks) => {
  const rows = await db('nfl_games')
    .select('season_year', 'week')
    .min({ first_day: db.raw("to_date(date, 'YYYY/MM/DD')") })
    .max({ last_day: db.raw("to_date(date, 'YYYY/MM/DD')") })
    .where('season_type', 'REG')
    .whereNotNull('date')
    .whereIn(
      ['season_year', 'week'],
      weeks.map((entry) => [entry.season_year, entry.week])
    )
    .groupBy('season_year', 'week')

  /** @type {Map<string, { start: Date, end: Date }>} */
  const windows = new Map()

  for (const row of /** @type {Record<string, any>[]} */ (rows)) {
    if (!row.first_day || !row.last_day) continue

    windows.set(`${row.season_year}:${row.week}`, {
      start: new Date(row.first_day.getTime() - 5 * 24 * 60 * 60 * 1000),
      end: new Date(row.last_day.getTime() + 2 * 24 * 60 * 60 * 1000)
    })
  }

  return windows
}

/**
 * One row per (season_year, week, source_label) over the recent completed
 * fantasy weeks, grading DFS salary coverage.
 *
 * @param {{ count?: number, weeks?: { season_year: number, week: number }[] }} [options]
 */
export const dfs_salary_source_week_coverage_rows = async ({
  count = 4,
  weeks
} = {}) => {
  const graded_weeks = weeks ?? recent_completed_fantasy_weeks({ count })

  const observed = await db('player_salaries')
    .select(
      'nfl_games.season_year',
      'nfl_games.week',
      'player_salaries.source_id'
    )
    .count('* as row_count')
    .join('nfl_games', 'nfl_games.esbid', 'player_salaries.esbid')
    .where('nfl_games.season_type', 'REG')
    .whereIn('player_salaries.source_id', EXPECTED_DFS_SALARY_SOURCES)
    .whereIn(
      ['nfl_games.season_year', 'nfl_games.week'],
      graded_weeks.map((entry) => [entry.season_year, entry.week])
    )
    .groupBy(
      'nfl_games.season_year',
      'nfl_games.week',
      'player_salaries.source_id'
    )

  /** @type {Map<string, number>} */
  const rows_by_source = new Map()
  /** @type {Map<string, number>} */
  const rows_by_week = new Map()

  for (const row of /** @type {Record<string, any>[]} */ (observed)) {
    const week_key = `${row.season_year}:${row.week}`
    const row_count = Number(row.row_count)
    rows_by_source.set(`${week_key}:${row.source_id}`, row_count)
    rows_by_week.set(week_key, (rows_by_week.get(week_key) || 0) + row_count)
  }

  const rows = []
  for (const { season_year, week } of graded_weeks) {
    const week_key = `${season_year}:${week}`
    // The denominator is the week's WHOLE salary population across every
    // expected book, never this book's own count -- which is zero in precisely
    // the case this check exists to catch, and a zero denominator reads as
    // un-gradeable rather than clean. A week where NO book wrote is a different
    // and larger failure, and correctly reads un-gradeable here.
    const week_total = rows_by_week.get(week_key) || 0

    for (const source_id of EXPECTED_DFS_SALARY_SOURCES) {
      const rows_found = rows_by_source.get(`${week_key}:${source_id}`) || 0

      rows.push({
        season_year,
        week,
        source_label: source_id,
        numerator: rows_found < MINIMUM_WEEKLY_DFS_SALARY_ROWS ? 1 : 0,
        denominator: week_total,
        rows_found,
        rows_required: MINIMUM_WEEKLY_DFS_SALARY_ROWS
      })
    }
  }

  return rows
}

/**
 * One row per (season_year, week, source_label) over the recent completed
 * fantasy weeks, grading betting-market write activity.
 *
 * Graded against `prop_markets_history` and never `prop_markets_index`. The
 * index is upserted, so `observed_at` moves only when a row's contents change
 * and a book that has stopped writing entirely is indistinguishable from one
 * whose markets are simply stable. `prop_markets_history` is append-only and is
 * the only oracle for run activity; reading the index instead produced four
 * consecutive wrong answers about Caesars on 2026-09-02.
 *
 * @param {{ count?: number, weeks?: { season_year: number, week: number }[] }} [options]
 */
export const betting_market_source_week_coverage_rows = async ({
  count = 4,
  weeks
} = {}) => {
  const graded_weeks = weeks ?? recent_completed_fantasy_weeks({ count })
  const windows = await betting_windows_for_weeks(graded_weeks)

  const rows = []

  for (const { season_year, week } of graded_weeks) {
    const week_key = `${season_year}:${week}`
    const window = windows.get(week_key)

    // A week whose games carry no date has no betting window, so nothing was
    // scanned for it. Emitted with a zero denominator so the classifier reports
    // it un-gradeable rather than passing it silently.
    if (!window) {
      for (const {
        source_id,
        rows_required
      } of EXPECTED_BETTING_MARKET_SOURCES) {
        rows.push({
          season_year,
          week,
          source_label: source_id,
          numerator: 0,
          denominator: 0,
          rows_found: 0,
          rows_required
        })
      }
      continue
    }

    const observed = await db('prop_markets_history')
      .select('source_id')
      .count('* as row_count')
      .whereIn(
        'source_id',
        EXPECTED_BETTING_MARKET_SOURCES.map((entry) => entry.source_id)
      )
      .where('observed_at', '>=', window.start)
      .where('observed_at', '<', window.end)
      .groupBy('source_id')

    /** @type {Map<string, number>} */
    const rows_by_source = new Map()
    let week_total = 0

    for (const row of /** @type {Record<string, any>[]} */ (observed)) {
      const row_count = Number(row.row_count)
      rows_by_source.set(row.source_id, row_count)
      week_total += row_count
    }

    for (const {
      source_id,
      rows_required
    } of EXPECTED_BETTING_MARKET_SOURCES) {
      const rows_found = rows_by_source.get(source_id) || 0

      rows.push({
        season_year,
        week,
        source_label: source_id,
        numerator: rows_found < rows_required ? 1 : 0,
        denominator: week_total,
        rows_found,
        rows_required
      })
    }
  }

  return rows
}
