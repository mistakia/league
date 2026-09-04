#!/usr/bin/env node

// Derive the benchmark's correctness assertions from production, and write
// test/data-view-benchmark/instructions.json.
//
// WHY THIS IS A SCRIPT AND NOT A HAND-WRITTEN FIXTURE. The benchmark grades a
// generated table_state by executing it and comparing the rows it returns
// against the rows the question actually has. Those expected rows have to come
// from somewhere that is not a generation run -- grading an agent against its
// own earlier output measures reproducibility and calls it correctness. So each
// instruction carries a SQL statement over `nfl_plays` that answers the same
// question by a completely different route than the data-view registry does,
// and this script runs it.
//
// The method was validated against a known answer before anything was built on
// it: the 2023 regular-season passing-yards SQL below returns Tua 4,624, Goff
// 4,575 and Prescott 4,516, which are the real leaders. The control matters as
// much as the result -- dropping `is_completion` from that same statement
// returns receivers with null yardage, so the query discriminates rather than
// producing the expected answer by construction.
//
//   NODE_ENV=production node scripts/data-view-benchmark-ground-truth.mjs
//   NODE_ENV=production node scripts/data-view-benchmark-ground-truth.mjs --check
//   NODE_ENV=production node scripts/data-view-benchmark-ground-truth.mjs --probe
//
// The two verification modes answer different questions and neither substitutes
// for the other. `--check` asks whether the expected values still match the SQL.
// `--probe` asks whether the data-view REGISTRY can express an answer that
// satisfies the assertion at all -- run it after adding or regenerating any
// instruction, because an unsatisfiable assertion fails a run in the exact shape
// of a wrong agent answer and gets read as one.
//
// `--check` recomputes and diffs against the committed file without writing,
// so a scheduled run can report drift rather than silently re-baselining. The
// expected values move when the underlying plays data is corrected; a diff is
// the signal that an assertion changed under you, and it must be read rather
// than accepted.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import db from '#db'
import { is_main } from '#libs-server'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUTPUT_PATH = path.join(
  __dirname,
  '..',
  'test',
  'data-view-benchmark',
  'instructions.json'
)

// How many leading rows each assertion pins. Deliberately short: the top of a
// ranking is where a wrong stat, a wrong season type or a wrong sort direction
// shows up immediately, and pinning a long tail only adds ties that break the
// assertion for reasons that have nothing to do with the agent.
const LEADER_DEPTH = 5

// Fraction by which a returned measure may differ from the expected one and
// still count. Not zero, because the registry and this SQL round and aggregate
// independently; small enough that a different statistic cannot slip through.
const MEASURE_TOLERANCE = 0.02

/**
 * The benchmark set.
 *
 * Each entry pairs a natural-language instruction with the SQL that answers it.
 * `expected_leaders` is filled in by this script; nothing below states an
 * answer by hand.
 *
 * The set spans the capability classes the production corpus shows rather than
 * repeating one shape at different sizes: three stat families (passing,
 * rushing, receiving), two row grains (player, team), two seasons, a counting
 * stat, a filtered population, and a derived rate. `capability` records which,
 * so a failure can be read as "rates are broken" rather than as one bad row.
 */
/**
 * Build a player-grain reference table_state -- the shape a competent agent
 * produces for "top N <position> by <stat> in <year>".
 *
 * @param {object} params
 * @returns {object}
 */
const player_reference = ({
  measure_column,
  position,
  year,
  extra_columns = [],
  minimum = null
}) => ({
  row_grain: ['player'],
  prefix_columns: ['player_name', 'player_position', 'player_nfl_teams'],
  columns: [
    { column_id: measure_column, params: { year: [year] } },
    ...extra_columns.map((column_id) => ({
      column_id,
      params: { year: [year] }
    }))
  ],
  where: [
    {
      column_id: 'player_position',
      operator: 'IN',
      value: [position],
      params: {}
    },
    ...(minimum
      ? [
          {
            column_id: minimum.column_id,
            operator: '>=',
            value: minimum.value,
            params: { year: [minimum.year] }
          }
        ]
      : [])
  ],
  sort: [{ column_id: measure_column, desc: true }],
  row_axes: []
})

const INSTRUCTIONS = [
  {
    instruction_id: 'qb-passing-yards-2023',
    instruction:
      'top 10 quarterbacks by passing yards in the 2023 regular season',
    capability: 'single stat, single season, player grain',
    min_rows: 10,
    sql: `
      select p.passer_pid as pid, pl.first_name, pl.last_name,
             sum(p.yards_gained)::int as measure
      from nfl_plays p
      join player pl on pl.pid = p.passer_pid
      where p.season_year = 2023 and p.season_type = 'REG'
        and p.play_type = 'PASS' and p.is_completion = true
        and pl.primary_position = 'QB'
      group by 1, 2, 3
      order by measure desc, pid asc
      limit ${LEADER_DEPTH}
    `
  },
  {
    instruction_id: 'wr-receiving-yards-2023',
    instruction:
      'top 25 wide receivers by receiving yards in the 2023 regular season, with their targets and receptions',
    capability: 'multi-column composition, player grain',
    min_rows: 25,
    sql: `
      select p.target_pid as pid, pl.first_name, pl.last_name,
             sum(p.yards_gained)::int as measure
      from nfl_plays p
      join player pl on pl.pid = p.target_pid
      where p.season_year = 2023 and p.season_type = 'REG'
        and p.play_type = 'PASS' and p.is_completion = true
        and pl.primary_position = 'WR'
      group by 1, 2, 3
      order by measure desc, pid asc
      limit ${LEADER_DEPTH}
    `
  },
  {
    instruction_id: 'rb-rushing-yards-2024',
    instruction:
      'top 15 running backs by rushing yards in the 2024 regular season, with rushing touchdowns',
    capability: 'different stat family and season than the canonical pair',
    min_rows: 15,
    sql: `
      select p.ball_carrier_pid as pid, pl.first_name, pl.last_name,
             sum(p.yards_gained)::int as measure
      from nfl_plays p
      join player pl on pl.pid = p.ball_carrier_pid
      where p.season_year = 2024 and p.season_type = 'REG'
        and p.play_type = 'RUSH'
        and pl.primary_position = 'RB'
      group by 1, 2, 3
      order by measure desc, pid asc
      limit ${LEADER_DEPTH}
    `
  },
  {
    instruction_id: 'qb-passing-touchdowns-2024',
    instruction:
      'top 10 quarterbacks by passing touchdowns in the 2024 regular season',
    capability: 'counting stat rather than a summed yardage stat',
    min_rows: 10,
    sql: `
      select p.passer_pid as pid, pl.first_name, pl.last_name,
             count(*) filter (where p.is_passing_touchdown)::int as measure
      from nfl_plays p
      join player pl on pl.pid = p.passer_pid
      where p.season_year = 2024 and p.season_type = 'REG'
        and p.play_type = 'PASS'
        and pl.primary_position = 'QB'
      group by 1, 2, 3
      order by measure desc, pid asc
      limit ${LEADER_DEPTH}
    `
  },
  {
    instruction_id: 'te-receiving-yards-2023',
    instruction:
      'top 10 tight ends by receiving yards in the 2023 regular season',
    capability: 'position filter the agent must apply rather than assume',
    min_rows: 10,
    sql: `
      select p.target_pid as pid, pl.first_name, pl.last_name,
             sum(p.yards_gained)::int as measure
      from nfl_plays p
      join player pl on pl.pid = p.target_pid
      where p.season_year = 2023 and p.season_type = 'REG'
        and p.play_type = 'PASS' and p.is_completion = true
        and pl.primary_position = 'TE'
      group by 1, 2, 3
      order by measure desc, pid asc
      limit ${LEADER_DEPTH}
    `
  },
  {
    instruction_id: 'wr-receptions-min-targets-2023',
    instruction:
      'wide receivers with at least 100 targets in the 2023 regular season, ranked by receptions',
    capability: 'a filter on one stat while ranking by another',
    min_rows: 10,
    sql: `
      select pid, first_name, last_name, measure from (
        select p.target_pid as pid, pl.first_name, pl.last_name,
               count(*) filter (where p.is_completion)::int as measure,
               count(*)::int as targets
        from nfl_plays p
        join player pl on pl.pid = p.target_pid
        where p.season_year = 2023 and p.season_type = 'REG'
          and p.play_type = 'PASS'
          and pl.primary_position = 'WR'
        group by 1, 2, 3
      ) t
      where targets >= 100
      order by measure desc, pid asc
      limit ${LEADER_DEPTH}
    `
  },
  {
    instruction_id: 'wr-yards-per-reception-2023',
    instruction:
      'top 10 wide receivers by yards per reception in the 2023 regular season, minimum 50 receptions',
    capability: 'a derived rate rather than a stored total',
    min_rows: 10,
    sql: `
      select pid, first_name, last_name, measure from (
        select p.target_pid as pid, pl.first_name, pl.last_name,
               round(
                 sum(p.yards_gained) filter (where p.is_completion)::numeric
                 / nullif(count(*) filter (where p.is_completion), 0),
                 2
               )::float8 as measure,
               count(*) filter (where p.is_completion)::int as receptions
        from nfl_plays p
        join player pl on pl.pid = p.target_pid
        where p.season_year = 2023 and p.season_type = 'REG'
          and p.play_type = 'PASS'
          and pl.primary_position = 'WR'
        group by 1, 2, 3
      ) t
      where receptions >= 50
      order by measure desc, pid asc
      limit ${LEADER_DEPTH}
    `
  },
  {
    // THE ONLY EDIT CASE, and the only entry whose assertion an agent cannot
    // satisfy by echoing what it was given. Every other instruction builds from
    // nothing; production's slow path is a user amending the view already on
    // screen, which is a longer prompt carrying a whole table_state and a
    // different question -- keep the columns, add one, re-rank on it.
    //
    // The re-rank is what makes it gradeable. An edit that only ADDS a column
    // leaves the leaders where they were, so returning the input unchanged
    // scores correct and the case measures nothing; ranking on the new column
    // means the expected leaders are the touchdown leaders and the input's
    // yardage order fails.
    instruction_id: 'qb-edit-add-touchdowns-2023',
    instruction:
      'add passing touchdowns for the same season, and rank by touchdowns instead of yards',
    capability: 'edit of an existing view: added column plus a re-rank',
    min_rows: 10,
    input_table_state: player_reference({
      measure_column: 'player_pass_yards_from_plays',
      position: 'QB',
      year: 2023
    }),
    sql: `
      select p.passer_pid as pid, pl.first_name, pl.last_name,
             count(*) filter (where p.is_passing_touchdown)::int as measure
      from nfl_plays p
      join player pl on pl.pid = p.passer_pid
      where p.season_year = 2023 and p.season_type = 'REG'
        and p.play_type = 'PASS'
        and pl.primary_position = 'QB'
      group by 1, 2, 3
      order by measure desc, pid asc
      limit ${LEADER_DEPTH}
    `
  },
  {
    instruction_id: 'team-passing-yards-2024',
    instruction:
      'total passing yards by team in the 2024 regular season, ranked highest first',
    capability: 'team row grain rather than player',
    min_rows: 30,
    identity_key: 'team',
    sql: `
      select p.offense_nfl_team as team,
             sum(p.yards_gained)::int as measure
      from nfl_plays p
      where p.season_year = 2024 and p.season_type = 'REG'
        and p.play_type = 'PASS' and p.is_completion = true
        and p.offense_nfl_team is not null
      group by 1
      order by measure desc, team asc
      limit ${LEADER_DEPTH}
    `
  }
]

/**
 * Run one instruction's ground-truth SQL.
 *
 * @param {object} entry
 * @returns {Promise<object>}
 */
const derive_entry = async (entry) => {
  const { rows } = await db.raw(entry.sql)

  if (!rows.length) {
    throw new Error(
      `${entry.instruction_id}: ground-truth SQL returned no rows, so there is no assertion to write`
    )
  }

  const identity_key = entry.identity_key || 'pid'
  const expected_leaders = rows.map((row) => {
    const identity = row[identity_key]
    if (identity === null || identity === undefined) {
      throw new Error(
        `${entry.instruction_id}: ground-truth row has no ${identity_key}`
      )
    }
    if (row.measure === null || row.measure === undefined) {
      throw new Error(
        `${entry.instruction_id}: ground-truth row for ${identity} has a null measure`
      )
    }
    return {
      identity: String(identity),
      measure: Number(row.measure),
      ...(row.first_name
        ? { label: `${row.first_name} ${row.last_name}` }
        : { label: String(identity) })
    }
  })

  return {
    instruction_id: entry.instruction_id,
    instruction: entry.instruction,
    capability: entry.capability,
    identity_key,
    min_rows: entry.min_rows,
    measure_tolerance: MEASURE_TOLERANCE,
    // Present on the edit case only. Absent means "build from nothing", which
    // is what every other entry does, so the runner branches on presence rather
    // than on a second flag naming the same thing.
    ...(entry.input_table_state
      ? { input_table_state: entry.input_table_state }
      : {}),
    expected_leaders,
    ground_truth_sql: entry.sql.trim()
  }
}

/**
 * A registry answer to each instruction, for `--probe` only.
 *
 * WHAT THIS CATCHES THAT `--check` CANNOT. `--check` proves the expected values
 * still match the SQL. It says nothing about whether the data-view REGISTRY can
 * express an answer that satisfies the assertion -- and twice now it could not,
 * each time in the shape of a wrong agent answer:
 *
 *   - the team assertion guessed its identity key from a player row, so every
 *     team run would have failed with "no team in row" (league c2cd9f013)
 *   - the passing-touchdown assertion could not be satisfied by any table_state,
 *     because the registry column counted `is_touchdown` and credited a
 *     quarterback with the pick-six thrown against him
 *
 * Both were found by hand-building a state and grading it. That is what this
 * automates. These are NOT written to instructions.json and the agent never sees
 * them -- `derive_entry` picks its output fields explicitly.
 *
 * A probe failure means the benchmark is broken, not that a run was wrong.
 */
const REFERENCE_TABLE_STATES = {
  'qb-passing-yards-2023': player_reference({
    measure_column: 'player_pass_yards_from_plays',
    position: 'QB',
    year: 2023
  }),
  'wr-receiving-yards-2023': player_reference({
    measure_column: 'player_receiving_yards_from_plays',
    position: 'WR',
    year: 2023,
    extra_columns: ['player_targets_from_plays', 'player_receptions_from_plays']
  }),
  'rb-rushing-yards-2024': player_reference({
    measure_column: 'player_rush_yards_from_plays',
    position: 'RB',
    year: 2024,
    extra_columns: ['player_rush_touchdowns_from_plays']
  }),
  'qb-passing-touchdowns-2024': player_reference({
    measure_column: 'player_pass_touchdowns_from_plays',
    position: 'QB',
    year: 2024
  }),
  'te-receiving-yards-2023': player_reference({
    measure_column: 'player_receiving_yards_from_plays',
    position: 'TE',
    year: 2023
  }),
  'wr-receptions-min-targets-2023': player_reference({
    measure_column: 'player_receptions_from_plays',
    position: 'WR',
    year: 2023,
    extra_columns: ['player_targets_from_plays'],
    minimum: { column_id: 'player_targets_from_plays', value: 100, year: 2023 }
  }),
  'wr-yards-per-reception-2023': player_reference({
    measure_column: 'player_receiving_yards_per_reception_from_plays',
    position: 'WR',
    year: 2023,
    extra_columns: ['player_receptions_from_plays'],
    minimum: {
      column_id: 'player_receptions_from_plays',
      value: 50,
      year: 2023
    }
  }),
  // The edit case's reference is the state AFTER the edit -- the input state
  // with the touchdown column added and the sort moved onto it. Probing the
  // input state instead would prove only that the view the user already has
  // renders, which is not the assertion.
  'qb-edit-add-touchdowns-2023': {
    ...player_reference({
      measure_column: 'player_pass_yards_from_plays',
      position: 'QB',
      year: 2023,
      extra_columns: ['player_pass_touchdowns_from_plays']
    }),
    sort: [{ column_id: 'player_pass_touchdowns_from_plays', desc: true }]
  },
  'team-passing-yards-2024': {
    row_grain: ['team'],
    prefix_columns: ['team_code', 'team_name'],
    columns: [
      { column_id: 'team_pass_yards_from_plays', params: { year: [2024] } }
    ],
    where: [],
    sort: [{ column_id: 'team_pass_yards_from_plays', desc: true }],
    row_axes: []
  }
}

/**
 * Grade every reference table_state against its own assertion.
 *
 * @param {object} instruction_set
 * @returns {Promise<boolean>} whether every assertion is satisfiable
 */
const probe_instruction_set = async (instruction_set) => {
  const { check_correctness } = await import('./data-view-benchmark-run.mjs')
  let all_satisfiable = true

  for (const entry of instruction_set.entries) {
    const table_state = REFERENCE_TABLE_STATES[entry.instruction_id]
    if (!table_state) {
      console.error(
        `  ${entry.instruction_id}: NO REFERENCE table_state -- assertion is unprobed`
      )
      all_satisfiable = false
      continue
    }
    const result = await check_correctness({ table_state, entry })
    if (result.correct) {
      console.log(
        `  ${entry.instruction_id}: satisfiable (${result.returned_rows} rows)`
      )
      continue
    }
    all_satisfiable = false
    console.error(
      `  ${entry.instruction_id}: UNSATISFIABLE -- ${result.reason}`
    )
  }

  return all_satisfiable
}

/**
 * @returns {Promise<object>}
 */
export const derive_instruction_set = async () => {
  const entries = []
  for (const entry of INSTRUCTIONS) {
    entries.push(await derive_entry(entry))
  }
  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    leader_depth: LEADER_DEPTH,
    entry_count: entries.length,
    entries
  }
}

const main = async () => {
  const check_only = process.argv.includes('--check')
  const probe_only = process.argv.includes('--probe')
  const derived = await derive_instruction_set()

  if (probe_only) {
    console.log(
      `probing ${derived.entry_count} assertions against the registry`
    )
    const all_satisfiable = await probe_instruction_set(derived)
    if (!all_satisfiable) {
      console.error(
        'at least one assertion cannot be satisfied by any table_state. Fix the assertion or the column before spending a run: a run against it fails in the shape of a wrong answer.'
      )
      process.exit(1)
    }
    console.log('every assertion is reachable through the registry')
    return
  }

  // `generated_at` is excluded from the comparison deliberately -- it differs on
  // every run and would report drift on a file that is identical in substance.
  const comparable = (doc) => ({ ...doc, generated_at: null })

  if (check_only) {
    if (!fs.existsSync(OUTPUT_PATH)) {
      console.error(`no committed instruction set at ${OUTPUT_PATH}`)
      process.exit(1)
    }
    const committed = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'))
    const same =
      JSON.stringify(comparable(committed)) ===
      JSON.stringify(comparable(derived))
    if (same) {
      console.log(
        `instruction set matches production (${derived.entry_count} entries)`
      )
      return
    }
    console.error('instruction set has DRIFTED from production. Differences:')
    for (const entry of derived.entries) {
      const before = committed.entries.find(
        (candidate) => candidate.instruction_id === entry.instruction_id
      )
      if (!before) {
        console.error(`  ${entry.instruction_id}: new`)
        continue
      }
      if (
        JSON.stringify(before.expected_leaders) !==
        JSON.stringify(entry.expected_leaders)
      ) {
        console.error(`  ${entry.instruction_id}: expected leaders changed`)
        console.error(
          `    committed: ${JSON.stringify(before.expected_leaders)}`
        )
        console.error(
          `    now:       ${JSON.stringify(entry.expected_leaders)}`
        )
      }
    }
    process.exit(1)
  }

  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(derived, null, 2)}\n`)
  console.log(`wrote ${derived.entry_count} instructions to ${OUTPUT_PATH}`)
  for (const entry of derived.entries) {
    const leaders = entry.expected_leaders
      .slice(0, 3)
      .map((leader) => `${leader.label} ${leader.measure}`)
      .join(', ')
    console.log(`  ${entry.instruction_id}: ${leaders}`)
  }
}

if (is_main(import.meta.url)) {
  main()
    .then(() => db.destroy())
    .catch(async (error) => {
      console.error(error.message)
      await db.destroy()
      process.exit(1)
    })
}

export default { derive_instruction_set, INSTRUCTIONS, LEADER_DEPTH }
