// @ts-check
/*
  Rows for the `projection-source-week-coverage` data check.

  The hole this fills. Every weekly projection importer now has a post-run floor
  (`check-projections-index-floor.mjs`), and that floor only speaks for a run
  that REACHED it. An importer that finds upstream has published nothing returns
  `{ skipped: true }` and its caller never gets there -- deliberately, because
  "upstream has not published" is not a failure and no date can be put on when a
  vendor opens a board. The cost of that decision is that a source which goes
  permanently quiet produces a graceful skip on every run, forever, and nothing
  escalates. The runs ledger reads green, the log reads "nothing to import", and
  the only symptom is a column going blank somewhere downstream months later.

  So the judgment has to be made from OUTSIDE the run, against what the table
  holds rather than against what a run did. That is this check.
*/

import db from '#db'

import { current_season, external_data_sources } from '#constants'

/**
 * The sources we run a weekly projection importer for, DECLARED rather than
 * derived from what `projections_index` happens to hold. Deriving it would
 * define the healthy state as whatever landed and could never report an
 * absence, which is the entire failure this check exists to catch.
 *
 * FBG publishes under six analyst source ids from one importer, so it is graded
 * as one logical source; a week where only some analysts landed still reads as
 * covered, which is correct -- the importer either ran or it did not.
 *
 * Every entry here corresponds to a live scheduler as of 2026-09-02: five
 * uncommented lines in `server/crontab-main/league-imports.cron`, plus PFF,
 * which migrated to `user:scheduled-command/league/import-pff-projections.md`
 * and therefore appears in no crontab at all. CBS and FFN are deliberately
 * absent -- both crontab lines are commented out, so an absence is expected
 * rather than a finding.
 */
export const EXPECTED_WEEKLY_PROJECTION_SOURCES = [
  { label: 'FFTODAY', source_ids: [external_data_sources.FFTODAY] },
  { label: 'ESPN', source_ids: [external_data_sources.ESPN] },
  {
    label: 'FANTASY_SHARKS',
    source_ids: [external_data_sources.FANTASY_SHARKS]
  },
  { label: '4FOR4', source_ids: [external_data_sources['4FOR4']] },
  { label: 'PFF', source_ids: [external_data_sources.PFF] },
  {
    label: 'FBG',
    source_ids: [
      external_data_sources.FBG_DAVID_DODDS,
      external_data_sources.FBG_BOB_HENRY,
      external_data_sources.FBG_JASON_WOOD,
      external_data_sources.FBG_MAURILE_TREMBLAY,
      external_data_sources.FBG_SIGMUND_BLOOM,
      external_data_sources.FBG_CONSENSUS
    ]
  }
]

/**
 * A source covered a week when it wrote at least this many rows for it.
 *
 * Calibrated on the GAP, not on the worst normal reading. Measured 2026-09-02
 * over 2025 weeks 11-18: the smallest healthy per-source week is FFTODAY at 209
 * and the largest is FBG at 1,469, while the defective reading is exactly 0
 * (FFTODAY, 4FOR4 and FBG at 2026 week 1). 100 sits at half the smallest
 * healthy reading and two orders of magnitude above the defective one, so a
 * vendor trimming its board cannot trip it and a vendor going quiet cannot
 * clear it.
 */
export const MINIMUM_WEEKLY_ROWS_PER_SOURCE = 100

/**
 * The most recent completed fantasy weeks, walking backwards across the season
 * boundary.
 *
 * Grading only COMPLETED weeks is what keeps this check free of false
 * positives. A source that has not yet published the upcoming week is the
 * ordinary state for most of any given week -- vendors publish in the run-up to
 * kickoff, and fftoday had not published 2026 week 1 a week before the opener
 * while three other sources had. Once a week is behind us, every source that
 * was ever going to publish it has, so an empty slice is unambiguous.
 *
 * Walking backwards rather than reading the current season alone is what keeps
 * the gradeable set NON-EMPTY year round. A window scoped to the live season
 * grades nothing from February to September, and a check that grades nothing
 * either throws on its detector-health floor every offseason or reports clean
 * while looking at no rows at all.
 *
 * `nfl_final_week` is read from the live season for the boundary crossing. It
 * has been 18 since 2021 and the walk only ever crosses one boundary, so a
 * historical 17-week season would shift the oldest week of the window by one
 * rather than break it.
 *
 * @param {{ count?: number }} [options]
 * @returns {{ season_year: number, week: number }[]}
 */
export const recent_completed_fantasy_weeks = ({ count = 4 } = {}) => {
  const final_week = current_season.nfl_final_week
  let season_year = current_season.year
  // Every week strictly before the one fantasy operations target is complete.
  // In the offseason `active_fantasy_week` is 1, so this starts at 0 and the
  // walk drops into the previous season on its first step.
  let week = current_season.active_fantasy_week - 1

  const weeks = []
  while (weeks.length < count) {
    if (week < 1) {
      season_year -= 1
      week = final_week
    }
    weeks.push({ season_year, week })
    week -= 1
  }

  return weeks
}

/**
 * One row per (season_year, week, source_label) over the recent completed
 * weeks.
 *
 * @param {{ count?: number }} [options]
 */
export const projection_source_week_coverage_rows = async ({
  count = 4
} = {}) => {
  const weeks = recent_completed_fantasy_weeks({ count })

  const observed = await db('projections_index')
    .select('season_year', 'week', 'source_id')
    .count('* as row_count')
    .where('season_type', 'REG')
    .whereIn(
      ['season_year', 'week'],
      weeks.map((entry) => [entry.season_year, entry.week])
    )
    .groupBy('season_year', 'week', 'source_id')

  /** @type {Map<string, number>} */
  const rows_by_source = new Map()
  /** @type {Map<string, number>} */
  const rows_by_week = new Map()

  for (const row of /** @type {Record<string, any>[]} */ (observed)) {
    const week_key = `${row.season_year}:${row.week}`
    const count_for_source = Number(row.row_count)
    rows_by_source.set(
      `${week_key}:${row.source_id}`,
      (rows_by_source.get(`${week_key}:${row.source_id}`) || 0) +
        count_for_source
    )
    rows_by_week.set(
      week_key,
      (rows_by_week.get(week_key) || 0) + count_for_source
    )
  }

  const rows = []
  for (const { season_year, week } of weeks) {
    const week_key = `${season_year}:${week}`
    // The denominator is the week's WHOLE projection population across every
    // source, never this source's own count -- which is zero in precisely the
    // case this check exists to catch, and a zero denominator reads as
    // un-gradeable rather than clean. A week with no projections from anyone is
    // a different and larger failure, and correctly reads un-gradeable here.
    const week_total = rows_by_week.get(week_key) || 0

    for (const source of EXPECTED_WEEKLY_PROJECTION_SOURCES) {
      const rows_found = source.source_ids.reduce(
        (total, source_id) =>
          total + (rows_by_source.get(`${week_key}:${source_id}`) || 0),
        0
      )

      rows.push({
        season_year,
        week,
        source_label: source.label,
        numerator: rows_found < MINIMUM_WEEKLY_ROWS_PER_SOURCE ? 1 : 0,
        denominator: week_total,
        rows_found,
        rows_required: MINIMUM_WEEKLY_ROWS_PER_SOURCE
      })
    }
  }

  return rows
}
