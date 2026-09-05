// Sweep the ungoverned Sportradar-written nfl_plays columns for CONTAINMENT
// violations: a subset column holding a value on a row whose superset says the
// event did not happen. A kick result on a non-attempt, `is_fumble_lost` on a play
// with no fumble, a penalty yardage on a play with no penalty.
//
// Every 2025 defect found so far was found by accident, by someone measuring one
// column for an unrelated reason. This shape is one query per pair and nothing runs
// it, which is the whole reason four of them survived.
//
// Two design rules it holds to, both of which the counts are worthless without.
//
// PER SEASON, never pooled. A column that changed regime in one season reads as a
// small rate against 27 seasons of clean rows, and the whole finding disappears into
// the denominator. Every count here is grouped by season_year.
//
// FALSE and NULL are DIFFERENT findings. A subset value against a superset that is
// explicitly FALSE is a contradiction -- the writer asserted both that the event
// happened and that it did not. A subset value against a NULL superset is a fill
// gap: the superset was never written, so nothing is contradicted and the row may be
// perfectly fine. Collapsing them with `IS NOT TRUE` reports the second as the first,
// which is how a benign vendor convention gets escalated into a defect.
//
// The subject set is taken from `resolve_field_authority()` rather than copied, and
// EVERY ungoverned column must appear in PAIRS below -- with a superset, or with an
// explicit `no_superset` reason. An unclassified column fails the run, so a mapper
// that starts writing a new column cannot be swept over in silence.

import db from '#db'
import { is_main } from '#libs-server'
import { resolve_field_authority } from './audit-sportradar-field-authority.mjs'

const FIRST_SEASON = 2022

// A subset column, the predicate that says it holds a value, and the boolean column
// that must be true for that value to be meaningful. `no_superset` is the other
// honest answer and is not a weaker one: most of these columns are play-grain facts
// that are true of every play, and inventing a superset for them would manufacture
// findings rather than measure any.
const PAIRS = [
  // --- field goals -------------------------------------------------------------
  { column: 'is_field_goal_attempt', no_superset: 'the event flag itself' },
  { column: 'field_goal_result', superset: 'is_field_goal_attempt' },
  { column: 'is_field_goal_blocked', superset: 'is_field_goal_attempt' },
  {
    column: 'kick_distance',
    superset: 'is_field_goal_attempt OR is_kickoff_attempt OR is_punt_attempt'
  },
  {
    column: 'kicker_pid',
    superset: 'is_field_goal_attempt OR is_kickoff_attempt'
  },
  {
    column: 'kicker_gsis',
    superset: 'is_field_goal_attempt OR is_kickoff_attempt'
  },

  // --- kickoffs and punts ------------------------------------------------------
  { column: 'is_kickoff_attempt', no_superset: 'the event flag itself' },
  { column: 'kickoff_yards', superset: 'is_kickoff_attempt' },
  { column: 'is_punt_attempt', no_superset: 'the event flag itself' },
  { column: 'punt_yards', superset: 'is_punt_attempt' },
  { column: 'is_punt_blocked', superset: 'is_punt_attempt' },
  { column: 'is_punt_fair_catch', superset: 'is_punt_attempt' },
  { column: 'punter_pid', superset: 'is_punt_attempt' },
  { column: 'punter_gsis', superset: 'is_punt_attempt' },

  // --- returns -----------------------------------------------------------------
  // nfl_plays carries no is_return flag, so a return detail has no event column to
  // be contained by. The touchdown flag is the one exception.
  { column: 'is_return_touchdown', superset: 'is_touchdown' },
  { column: 'return_yards', no_superset: 'no is_return event flag exists' },
  { column: 'returner_pid', no_superset: 'no is_return event flag exists' },
  { column: 'returner_gsis', no_superset: 'no is_return event flag exists' },
  {
    column: 'is_touchback',
    no_superset: 'a play outcome, not a detail of one'
  },
  {
    column: 'is_out_of_bounds',
    no_superset: 'a play outcome, not a detail of one'
  },

  // --- turnovers ---------------------------------------------------------------
  { column: 'is_fumble_lost', superset: 'is_fumble' },
  { column: 'fumble_forced_1_pid', superset: 'is_fumble' },
  { column: 'fumble_forced_1_gsis', superset: 'is_fumble' },
  { column: 'fumble_recovered_1_pid', superset: 'is_fumble' },
  { column: 'fumble_recovered_1_gsis', superset: 'is_fumble' },
  { column: 'interceptor_pid', superset: 'is_interception' },
  { column: 'interceptor_gsis_player_id', superset: 'is_interception' },

  // --- defensive credit --------------------------------------------------------
  { column: 'is_tackle_for_loss', no_superset: 'the event flag itself' },
  { column: 'tackle_for_loss_1_pid', superset: 'is_tackle_for_loss' },
  { column: 'tackle_for_loss_1_gsis', superset: 'is_tackle_for_loss' },
  { column: 'tackle_for_loss_2_pid', superset: 'is_tackle_for_loss' },
  { column: 'tackle_for_loss_2_gsis', superset: 'is_tackle_for_loss' },
  { column: 'sack_player_1_pid', superset: 'is_sack' },
  { column: 'sack_player_1_gsis', superset: 'is_sack' },
  { column: 'sack_player_2_pid', superset: 'is_sack' },
  { column: 'sack_player_2_gsis', superset: 'is_sack' },
  { column: 'is_safety', no_superset: 'a play outcome, not a detail of one' },

  // --- penalties ---------------------------------------------------------------
  { column: 'is_penalty', no_superset: 'the event flag itself' },
  { column: 'penalty_yards', superset: 'is_penalty' },
  { column: 'penalty_type', superset: 'is_penalty' },
  { column: 'penalty_team', superset: 'is_penalty' },
  { column: 'penalty_player_pid', superset: 'is_penalty' },
  { column: 'penalty_player_gsis', superset: 'is_penalty' },

  // --- passing and receiving ---------------------------------------------------
  // A sack is a PASS play with no completion, so the passer columns take play_type
  // and the receiving ones take is_completion.
  { column: 'passer_pid', superset: "play_type = 'PASS'" },
  { column: 'passer_gsis_player_id', superset: "play_type = 'PASS'" },
  { column: 'pass_yards', superset: "play_type = 'PASS'" },
  { column: 'target_pid', superset: "play_type = 'PASS'" },
  { column: 'target_gsis_player_id', superset: "play_type = 'PASS'" },
  { column: 'receiving_yards', superset: 'is_completion' },
  { column: 'yards_after_catch', superset: 'is_completion' },

  // --- rushing -----------------------------------------------------------------
  { column: 'ball_carrier_pid', superset: "play_type = 'RUSH'" },
  { column: 'ball_carrier_gsis_player_id', superset: "play_type = 'RUSH'" },
  { column: 'rush_yards', superset: "play_type = 'RUSH'" },
  { column: 'run_gap', superset: "play_type = 'RUSH'" },

  // --- drive grain -------------------------------------------------------------
  // Drive attributes are properties of the drive every play belongs to, so every
  // play legitimately carries them. Their failure shape is meaning drift, which is
  // the other sweep.
  { column: 'drive_sequence', no_superset: 'drive-grain attribute' },
  { column: 'drive_play_count', no_superset: 'drive-grain attribute' },
  { column: 'drive_yards', no_superset: 'drive-grain attribute' },
  { column: 'drive_yards_penalized', no_superset: 'drive-grain attribute' },
  { column: 'drive_first_downs', no_superset: 'drive-grain attribute' },
  { column: 'drive_top', no_superset: 'drive-grain attribute' },
  { column: 'drive_start_transition', no_superset: 'drive-grain attribute' },
  { column: 'drive_end_transition', no_superset: 'drive-grain attribute' },

  // --- play-grain facts every play carries -------------------------------------
  { column: 'play_type', no_superset: 'true of every play' },
  { column: 'yards_gained', no_superset: 'true of every play' },
  { column: 'yards_to_go', no_superset: 'true of every play' },
  { column: 'is_goal_to_go', no_superset: 'true of every play' },
  { column: 'is_qb_spike', no_superset: 'true of every play' },
  { column: 'game_clock_start', no_superset: 'true of every play' },
  { column: 'seconds_remaining_quarter', no_superset: 'true of every play' },
  { column: 'seconds_remaining_half', no_superset: 'true of every play' },
  { column: 'seconds_remaining_game', no_superset: 'true of every play' },
  { column: 'home_score', no_superset: 'true of every play' },
  { column: 'away_score', no_superset: 'true of every play' },
  { column: 'offense_nfl_team', no_superset: 'true of every play' },
  { column: 'defense_nfl_team', no_superset: 'true of every play' },
  { column: 'possession_nfl_team', no_superset: 'true of every play' },
  { column: 'yard_line_side', no_superset: 'true of every play' },
  { column: 'yard_line_number', no_superset: 'true of every play' },
  { column: 'yard_line_100', no_superset: 'true of every play' },
  { column: 'yard_line_start', no_superset: 'true of every play' },
  { column: 'yard_line_end', no_superset: 'true of every play' }
]

const held_predicate = (column, is_boolean) =>
  is_boolean ? `${column} IS TRUE` : `${column} IS NOT NULL`

const measure = async ({ pairs, boolean_columns }) => {
  const selects = pairs.flatMap(({ column, superset }, index) => {
    const held = held_predicate(column, boolean_columns.has(column))
    return [
      `count(*) FILTER (WHERE ${held} AND NOT (${superset})) AS c${index}_contradicted`,
      `count(*) FILTER (WHERE ${held} AND (${superset}) IS NULL) AS c${index}_unwritten`,
      `count(*) FILTER (WHERE ${held}) AS c${index}_held`
    ]
  })

  const rows = await db.raw(
    `SELECT season_year, ${selects.join(', ')}
     FROM nfl_plays
     WHERE season_year >= ?
     GROUP BY season_year
     ORDER BY season_year`,
    [FIRST_SEASON]
  )

  return rows.rows
}

const run_negative_control = async ({ boolean_columns }) => {
  // A pair whose superset is its own held predicate can never be violated, so it is
  // the decoy: a sweep reporting on it is matching something other than containment.
  // A pair whose superset is the NEGATION of a real one must report on every row
  // that holds a value, so it is the must-report half. Singly, either is consistent
  // with a sweep broken in one direction.
  const decoy = { column: 'is_penalty', superset: 'is_penalty' }
  const must_report = { column: 'is_penalty', superset: 'NOT is_penalty' }

  const rows = await measure({
    pairs: [decoy, must_report],
    boolean_columns
  })

  const decoy_total = rows.reduce(
    (sum, row) => sum + Number(row.c0_contradicted),
    0
  )
  const must_report_total = rows.reduce(
    (sum, row) => sum + Number(row.c1_contradicted),
    0
  )

  console.error('NEGATIVE CONTROL')
  console.error(
    `  [${decoy_total === 0 ? 'STAYED GREEN' : 'WENT RED'}] decoy: a superset identical to its subset reports ${decoy_total} (must be 0)`
  )
  console.error(
    `  [${must_report_total > 0 ? 'WENT RED' : 'STAYED GREEN'}] must-report: a negated superset reports ${must_report_total} (must be > 0)`
  )
  console.error('')

  return decoy_total === 0 && must_report_total > 0
}

const main = async () => {
  const { ungoverned, nfl_plays_columns } = await resolve_field_authority()

  const classified = new Set(PAIRS.map((pair) => pair.column))
  const unclassified = ungoverned.filter((column) => !classified.has(column))
  const stale = PAIRS.map((pair) => pair.column).filter(
    (column) => !ungoverned.includes(column)
  )

  const boolean_rows = await db('information_schema.columns')
    .select('column_name')
    .where({ table_name: 'nfl_plays', data_type: 'boolean' })
  const boolean_columns = new Set(boolean_rows.map((row) => row.column_name))

  const measured_pairs = PAIRS.filter((pair) => pair.superset)
  const rows = await measure({ pairs: measured_pairs, boolean_columns })

  console.log('=== Sportradar ungoverned containment sweep ===\n')
  console.log(`ungoverned columns:            ${ungoverned.length}`)
  console.log(`  with a declared superset:    ${measured_pairs.length}`)
  console.log(
    `  declared to have none:       ${PAIRS.length - measured_pairs.length}`
  )
  console.log(`seasons measured:              ${FIRST_SEASON}+\n`)

  const findings = []
  for (const [index, pair] of measured_pairs.entries()) {
    for (const row of rows) {
      const contradicted = Number(row[`c${index}_contradicted`])
      const unwritten = Number(row[`c${index}_unwritten`])
      const held = Number(row[`c${index}_held`])
      if (contradicted > 0 || unwritten > 0) {
        findings.push({
          season_year: row.season_year,
          column: pair.column,
          superset: pair.superset,
          contradicted,
          unwritten,
          held
        })
      }
    }
  }

  // A raw contradiction COUNT cannot tell a defect from a convention. Several of
  // these supersets are approximations -- a scramble is charted RUSH while carrying
  // a passer, a broken play is NOPL while carrying yardage -- so those pairs fire at
  // a steady low rate in EVERY season, and that rate is the vendor's charting rather
  // than anything wrong. Ranking by count puts the biggest convention above the
  // smallest real defect.
  //
  // What a convention cannot produce is a STEP. So the ordering is each season's
  // contradiction RATE against the highest rate the same pair reaches in any other
  // measured season, and the two numbers are printed side by side. Deliberately no
  // threshold and no two-bucket split: any cut here decides in advance which real
  // defects are too small to mention, and the 2025 penalty_yards regime change sits
  // at 4.5x while the yards_after_catch one sits at 900x. The ratio is the finding;
  // where to stop reading is the reader's call.
  const by_column = new Map()
  for (const finding of findings.filter((item) => item.contradicted > 0)) {
    if (!by_column.has(finding.column)) by_column.set(finding.column, [])
    by_column.get(finding.column).push(finding)
  }

  const ranked = []
  for (const [, column_findings] of by_column) {
    for (const finding of column_findings) {
      const rate = finding.held ? finding.contradicted / finding.held : 0
      // A season this pair did not fire in contributes a rate of 0, so the leading
      // 0 covers every measured season absent from `column_findings`.
      const baseline = Math.max(
        0,
        ...column_findings
          .filter((other) => other.season_year !== finding.season_year)
          .map((other) => (other.held ? other.contradicted / other.held : 0))
      )
      ranked.push({
        ...finding,
        rate,
        baseline,
        ratio: baseline === 0 ? Infinity : rate / baseline
      })
    }
  }

  const percent = (value) => `${(value * 100).toFixed(2)}%`
  const format_ratio = (value) =>
    value === Infinity ? 'no other season' : `${value.toFixed(1)}x`

  console.log(
    '--- CONTRADICTIONS: value held while the superset says FALSE, ranked by season step ---'
  )
  if (ranked.length) {
    // `Infinity - Infinity` is NaN, which makes the comparator inconsistent and the
    // order arbitrary among the strongest findings. Compare the ratios explicitly.
    const by_step = (a, b) => {
      if (a.ratio !== b.ratio) return a.ratio > b.ratio ? -1 : 1
      return b.contradicted - a.contradicted
    }
    for (const finding of ranked.sort(by_step)) {
      console.log(
        `  ${finding.season_year}  ${finding.column} (superset ${finding.superset}): ` +
          `${finding.contradicted} of ${finding.held} rows holding a value, ` +
          `${percent(finding.rate)} against ${percent(finding.baseline)} elsewhere (${format_ratio(finding.ratio)})`
      )
    }
  } else {
    console.log('  (none)')
  }
  console.log('')

  const fill_gaps = findings.filter(
    (finding) => finding.contradicted === 0 && finding.unwritten > 0
  )

  console.log('--- FILL GAPS: value held while the superset is NULL ---')
  if (fill_gaps.length) {
    for (const finding of fill_gaps.sort((a, b) => b.unwritten - a.unwritten)) {
      console.log(
        `  ${finding.season_year}  ${finding.column} (superset ${finding.superset}): ${finding.unwritten} of ${finding.held} rows holding a value`
      )
    }
  } else {
    console.log('  (none)')
  }
  console.log('')

  const controls_fired = await run_negative_control({ boolean_columns })

  let exit_code = 0

  if (unclassified.length) {
    console.log(
      'COVERAGE GAP: ungoverned columns with no entry in PAIRS -- they were not swept.'
    )
    for (const column of unclassified) console.log(`  ${column}`)
    exit_code = 1
  }
  if (stale.length) {
    console.log(
      'STALE PAIRS: entries naming a column that is no longer ungoverned.'
    )
    for (const column of stale) console.log(`  ${column}`)
    exit_code = 1
  }
  const unknown = PAIRS.map((pair) => pair.column).filter(
    (column) => !nfl_plays_columns.has(column)
  )
  if (unknown.length) {
    console.log(`PAIRS naming no nfl_plays column: ${unknown.join(', ')}`)
    exit_code = 1
  }
  if (!controls_fired) {
    console.log(
      'CONTROL STAYED GREEN: this sweep cannot report and its counts mean nothing.'
    )
    exit_code = 1
  }

  await db.destroy()
  process.exit(exit_code)
}

if (is_main(import.meta.url)) {
  main()
}
