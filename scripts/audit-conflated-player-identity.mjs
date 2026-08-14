import fs from 'fs/promises'

import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main } from '#libs-server'

const log = debug('audit-conflated-player-identity')
debug.enable('audit-conflated-player-identity')

// A conflated player row merges two different people — most often a father and
// a son sharing a name. Each field is individually plausible; the defect is only
// visible when independent fields are asked which ERA the person belongs to and
// they disagree.
//
// Three identifier spaces are independently monotone in entry cohort, so each
// one votes for an entry year:
//
//   gsis_player_id      00-00NNNNN, usable from the 2000 cohort onward
//   gsis_it_player_id   integer, usable from the 2003 cohort onward
//   nfl_draft_year      the recorded value itself
//
// gsis_it_player_id is a LOWER BOUND on entry rather than a point estimate. GSIS
// issues it at first contact — a workout, a camp invite, a practice squad — which
// for a late entrant precedes the entry season by years. Measured across the 8532
// three-vote rows, it dissents low against agreeing draft-year and gsis votes on
// exactly 4 rows and dissents HIGH on none, and all 4 are undrafted CFL or rugby
// converts and kickers (adam bighill, jordan mudge, lirim hajrullahu, taylor
// russolino). So an early gsis_it read is assignment timing, not a contradiction.
//
// It is discounted only when the row's own date_of_birth makes the early first
// contact the player's own — birth + 20 <= the year the id implies. That keeps the
// hijack this task found visible: a row holding an OLDER person's gsis_it (the
// father/son shape, the 2022 devin taylor holding 40080) fails the birth test and
// still flags, as does any row with no birth date. A LATE read is never discounted,
// because an id cannot be issued after the player has already played.
// date_of_birth is deliberately NOT a hard vote. Its implied entry year (birth +
// 22) is legitimately off by several years for late entrants — AFL punters,
// rugby and CFL converts, two-sport players — and treating it as exact floods
// the result with those false positives. It is reported alongside for context.
//
// nfl_player_id is NOT a hard vote either, for a different reason: its dissent is
// unactionable rather than untrustworthy. Every row it has ever flagged alone is
// a retired player, and NFL.com serves player cards only for its current fantasy
// player universe — so no external oracle can adjudicate them, and six audit
// passes closed none. Demoting it suppresses exactly those rows and flags nothing
// new: at threshold 5 the flagged set goes from 25 to 4, removing the 21 known
// lone-dissenter rows and adding zero. It is reported alongside for context.
//
// Note the column is also NOT range-bounded the way the calibration below
// implies. The 25xxxxx block is the monotone part, but NFL.com's id space
// genuinely includes small legacy values — 744 is Calais Campbell, 264 is Josh
// Johnson and 79860 is Matthew Stafford, all confirmed live against
// fantasy.nfl.com. Calibration restricts to the monotone block because that is
// where a nearest-median vote means anything, not because values outside it are
// corrupt.

const CALIBRATION = `
  cohort AS (
    SELECT
      nfl_draft_year AS draft_year,
      CAST(substring(gsis_player_id from 4) AS int) AS gsis_number,
      gsis_it_player_id,
      CASE
        WHEN nfl_player_id BETWEEN 2499000 AND 2580000 THEN nfl_player_id
      END AS nfl_number
    FROM player
    WHERE nfl_draft_year BETWEEN 1990 AND 2026
      AND gsis_player_id ~ '^00-00[0-9]{5}$'
  ),
  cohort_median AS (
    SELECT
      draft_year,
      percentile_disc(0.5) WITHIN GROUP (ORDER BY gsis_number) AS gsis_median,
      percentile_disc(0.5) WITHIN GROUP (ORDER BY gsis_it_player_id)
        FILTER (WHERE gsis_it_player_id IS NOT NULL) AS gsis_it_median,
      percentile_disc(0.5) WITHIN GROUP (ORDER BY nfl_number)
        FILTER (WHERE nfl_number IS NOT NULL) AS nfl_median
    FROM cohort
    GROUP BY draft_year
  ),
  calibration_gsis AS (
    SELECT draft_year, gsis_median FROM cohort_median WHERE draft_year >= 2000
  ),
  calibration_gsis_it AS (
    SELECT draft_year, gsis_it_median FROM cohort_median
    WHERE draft_year >= 2003 AND gsis_it_median IS NOT NULL
  ),
  calibration_nfl AS (
    SELECT draft_year, nfl_median FROM cohort_median
    WHERE draft_year >= 2000 AND nfl_median >= 2503900
  )
`

const VOTES = `
  candidate AS (
    SELECT
      pid,
      formatted_name,
      date_of_birth,
      nfl_draft_year,
      draft_round,
      draft_overall_pick,
      college,
      gsis_player_id,
      gsis_it_player_id,
      nfl_player_id,
      pfr_player_id,
      esb_player_id,
      CASE
        WHEN gsis_player_id ~ '^00-00[0-9]{5}$'
        THEN CAST(substring(gsis_player_id from 4) AS int)
      END AS gsis_number,
      CASE
        WHEN date_of_birth ~ '^(19|20)[0-9]{2}-[0-9]{2}'
        THEN CAST(substring(date_of_birth from 1 for 4) AS int)
      END AS birth_year
    FROM player
  ),
  voted AS (
    SELECT
      candidate.*,
      CASE WHEN birth_year IS NOT NULL THEN birth_year + 22 END AS era_from_birth,
      CASE
        WHEN nfl_draft_year BETWEEN 1990 AND 2026 THEN nfl_draft_year
      END AS era_from_draft_year,
      CASE WHEN gsis_number >= 19000 THEN (
        SELECT draft_year FROM calibration_gsis
        ORDER BY abs(gsis_median - candidate.gsis_number) LIMIT 1
      ) END AS era_from_gsis,
      CASE WHEN gsis_it_player_id >= 28000 THEN (
        SELECT draft_year FROM calibration_gsis_it
        ORDER BY abs(gsis_it_median - candidate.gsis_it_player_id) LIMIT 1
      ) END AS era_from_gsis_it,
      CASE WHEN nfl_player_id BETWEEN 2503900 AND 2580000 THEN (
        SELECT draft_year FROM calibration_nfl
        ORDER BY abs(nfl_median - candidate.nfl_player_id) LIMIT 1
      ) END AS era_from_nfl_player_id
    FROM candidate
  ),
  bounded AS (
    SELECT
      voted.*,
      CASE
        WHEN era_from_gsis_it IS NOT NULL
          AND birth_year IS NOT NULL
          AND birth_year + 20 <= era_from_gsis_it
        THEN greatest(
          era_from_gsis_it,
          least(
            coalesce(era_from_draft_year, era_from_gsis_it),
            coalesce(era_from_gsis, era_from_gsis_it)
          )
        )
        ELSE era_from_gsis_it
      END AS era_from_gsis_it_bounded
    FROM voted
  ),
  scored AS (
    SELECT
      bounded.*,
      (SELECT max(vote) FROM unnest(ARRAY[
        era_from_draft_year, era_from_gsis, era_from_gsis_it_bounded
      ]) vote) -
      (SELECT min(vote) FROM unnest(ARRAY[
        era_from_draft_year, era_from_gsis, era_from_gsis_it_bounded
      ]) vote) AS hard_spread,
      (SELECT count(vote) FROM unnest(ARRAY[
        era_from_draft_year, era_from_gsis, era_from_gsis_it_bounded
      ]) vote) AS hard_vote_count
    FROM bounded
  )
`

const build_query = ({ threshold }) => `
  WITH ${CALIBRATION}, ${VOTES}
  SELECT
    pid, formatted_name, date_of_birth, nfl_draft_year, draft_round,
    draft_overall_pick, college, gsis_player_id, gsis_it_player_id,
    nfl_player_id, pfr_player_id, esb_player_id,
    era_from_birth, era_from_draft_year, era_from_gsis, era_from_gsis_it,
    era_from_gsis_it_bounded, era_from_nfl_player_id, hard_spread,
    hard_vote_count
  FROM scored
  WHERE hard_vote_count >= 2 AND hard_spread >= ${threshold}
  ORDER BY hard_spread DESC, formatted_name
`

const build_coverage_query = () => `
  WITH ${CALIBRATION}, ${VOTES}
  SELECT
    count(*) AS player_rows,
    count(*) FILTER (WHERE hard_vote_count >= 2) AS testable_rows,
    count(*) FILTER (WHERE hard_vote_count >= 3) AS testable_rows_three_votes,
    count(*) FILTER (WHERE hard_vote_count >= 2 AND hard_spread >= 2) AS spread_2,
    count(*) FILTER (WHERE hard_vote_count >= 2 AND hard_spread >= 3) AS spread_3,
    count(*) FILTER (WHERE hard_vote_count >= 2 AND hard_spread >= 5) AS spread_5,
    count(*) FILTER (WHERE hard_vote_count >= 2 AND hard_spread >= 8) AS spread_8
  FROM scored
`

// The sharpest signal needs no calibration at all: the same person's id on two
// rows, which is exactly what a conflation leaves behind when the second person
// already has a row of their own. nfl_player_id took the UNIQUE index every other
// identifier column carries in league 8405aa3e8, so this now reports zero and is
// kept as a standing check that the index has not been dropped.
const DUPLICATE_NFL_PLAYER_ID_QUERY = `
  WITH duplicated AS (
    SELECT nfl_player_id FROM player
    WHERE nfl_player_id IS NOT NULL
    GROUP BY nfl_player_id HAVING count(*) > 1
  )
  SELECT
    player.nfl_player_id, player.pid, player.formatted_name, player.date_of_birth,
    player.nfl_draft_year, player.draft_round, player.college,
    player.gsis_player_id, player.gsis_it_player_id, player.pfr_player_id
  FROM player
  JOIN duplicated ON duplicated.nfl_player_id = player.nfl_player_id
  ORDER BY player.nfl_player_id, player.date_of_birth
`

const audit_conflated_player_identity = async ({
  threshold = 3,
  output_path = null
} = {}) => {
  const coverage = (await db.raw(build_coverage_query())).rows[0]
  log('coverage and disagreement distribution:')
  log(coverage)

  const duplicate_nfl_player_id_rows = (
    await db.raw(DUPLICATE_NFL_PLAYER_ID_QUERY)
  ).rows
  const duplicated_values = new Set(
    duplicate_nfl_player_id_rows.map((row) => row.nfl_player_id)
  )
  log(
    `${duplicated_values.size} duplicated nfl_player_id values across ${duplicate_nfl_player_id_rows.length} rows`
  )

  const rows = (await db.raw(build_query({ threshold }))).rows
  log(`${rows.length} rows with hard_spread >= ${threshold}`)

  if (output_path) {
    await fs.writeFile(
      output_path,
      JSON.stringify(
        { coverage, threshold, rows, duplicate_nfl_player_id_rows },
        null,
        2
      )
    )
    log(`wrote ${output_path}`)
  }

  return { coverage, rows, duplicate_nfl_player_id_rows }
}

export default audit_conflated_player_identity

const main = async () => {
  let error
  try {
    const argv = yargs(hideBin(process.argv))
      .option('threshold', {
        type: 'number',
        default: 3,
        describe: 'minimum disagreement in years between identifier era votes'
      })
      .option('output_path', {
        type: 'string',
        describe: 'write the full candidate set as JSON to this path'
      }).argv

    await audit_conflated_player_identity({
      threshold: argv.threshold,
      output_path: argv.output_path
    })
  } catch (err) {
    error = err
    log(error)
  }

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}
