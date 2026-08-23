import debug from 'debug'

import db from '#db'
import { is_main } from '#libs-server'
import {
  short_name_key,
  missing_gsis_ids_sql,
  collision_preflight_sql,
  table_wide_collision_sql,
  external_id_attach_sql
} from '#libs-server/player-identity-collision-oracle.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const log = debug('calibrate-player-identity-collision-oracle')
enable_debug_namespaces('calibrate-player-identity-collision-oracle')

/*
  Calibrates and falsifies the collision oracle, and reports its baselines.

  This is the gate the identity-repair sweep sits on: the oracle is the only
  check that can see rows carrying a gsis id, so if IT is wrong, every "no
  collision, safe to mint" answer downstream is unfalsifiable. Exits non-zero
  when the negative control fails.

  The negative control INJECTS its candidates through a VALUES list rather than
  writing them, so falsifying the oracle touches no production row.
*/

// Each case is a name the ledger actually carries, paired with the canonical
// form it has to collapse to. These are the classes measured in the known-good
// set, not invented examples.
const NORMALIZATION_CASES = [
  ['E.Sims', 'esims'], // already canonical
  ['C. Kriewaldt', 'ckriewaldt'], // space after the initial
  ['Brandon Facyson', 'bfacyson'], // full first name
  ['R.Carter Jr.', 'rcarter'], // suffix, ledger side
  ['W.Thomas III', 'wthomas'], // suffix, player side
  ['Ty.Campbell', 'tcampbell'], // multi-character initial
  ['Ald.Smith', 'asmith'], // three-character initial
  ['Aa.Rodgers', 'arodgers'], // multi-character initial, live namesake
  ['M.Sims-Walker', 'msimswalker'], // hyphenated surname
  ['K.Van Noy', 'kvannoy'], // surname carrying a space
  ["Adoree' Jackson", 'ajackson'], // apostrophe in a full first name
  ["Ja'Marr Chase", 'jchase'], // apostrophe, mid-token
  ['Al-Quadin Muhammad', 'amuhammad'], // hyphen in a full first name
  ["D'A. Smith", 'dsmith'], // apostrophe plus a spaced initial
  ["D'.Williams", 'dwilliams'], // apostrophe abutting the separator
  ['C.Weinke(3rd QB)', 'cweinke'], // ledger annotation, no space
  ['R.Fasani (3rd QB)', 'rfasani'] // ledger annotation, spaced
]

/*
  Three seeds, chosen so the control can go RED. GB 2021 is not an arbitrary
  team-season: it carried BOTH Aaron Rodgers and Amari Rodgers, so it is a live
  namesake pair rather than a constructed one.

  - multichar: the normalized form must find it and the raw form must MISS it.
  - plain: BOTH forms must find it. Without this the raw form's miss above is
    indistinguishable from a raw form that is simply broken.
  - absent: NEITHER form may find it, or the join is matching on nothing.
*/
const NEGATIVE_CONTROL_SEEDS = [
  ['multichar', 'Aa.Rodgers', 'GB', 2021],
  ['plain', 'A.Rodgers', 'GB', 2021],
  ['absent', 'Zz.Notarealsurname', 'GB', 2021]
]

const seeded_preflight_sql = ({ normalized }) => {
  const values = NEGATIVE_CONTROL_SEEDS.map(
    ([seed, name, team, season_year]) =>
      `('${seed}','${name.replace(/'/g, "''")}','${team}',${season_year})`
  ).join(', ')
  const ledger_key = normalized
    ? short_name_key('m.player_name')
    : 'lower(m.player_name)'
  const player_key = normalized
    ? short_name_key('p.short_name')
    : 'lower(p.short_name)'
  return `WITH missing (seed, player_name, nfl_team, season_year) AS (
  VALUES ${values}
), incumbent_team_seasons AS (
  SELECT DISTINCT pid, nfl_team, season_year FROM player_gamelogs
  WHERE nfl_team IS NOT NULL AND season_year IS NOT NULL
)
SELECT m.seed, m.player_name AS ledger_name, p.pid AS incumbent_pid,
       p.short_name AS incumbent_name
FROM missing m
JOIN player p ON p.primary_position <> 'DST' AND p.short_name IS NOT NULL
  AND ${player_key} = ${ledger_key}
JOIN incumbent_team_seasons its
  ON its.pid = p.pid AND its.nfl_team = m.nfl_team AND its.season_year = m.season_year`
}

const check_normalization_cases = async () => {
  const values = NORMALIZATION_CASES.map(
    ([input]) => `('${input.replace(/'/g, "''")}')`
  ).join(', ')
  const { rows } = await db.raw(
    `WITH v (raw) AS (VALUES ${values}) SELECT raw, ${short_name_key('raw')} AS key FROM v`
  )
  const by_input = new Map(rows.map((row) => [row.raw, row.key]))
  const failures = NORMALIZATION_CASES.filter(
    ([input, expected]) => by_input.get(input) !== expected
  )
  log(
    `normalization cases: ${NORMALIZATION_CASES.length - failures.length}/${NORMALIZATION_CASES.length} pass`
  )
  for (const [input, expected] of failures) {
    log(`  FAIL ${input} -> ${by_input.get(input)}, expected ${expected}`)
  }
  return failures.length === 0
}

/*
  The false-negative rate, measured at the grain the oracle actually operates
  on: the gsis ID, not the distinct name pair.

  The distinction is the whole measurement. A single id carries several ledger
  spellings, and 0.45% of stat rows name a DIFFERENT person entirely -- a ledger
  data-quality class no name normalization can reach. Scored per distinct name
  pair that tail dominates and the normalized join reads as 9.15% blind; scored
  per id, asking whether ANY of that id's ledger names resolves, it is 0.64%.
  The second is what the pre-flight does, so it is the number that governs.
*/
const measure_false_negative_rate = async () => {
  const { rows } = await db.raw(`WITH known_good AS (
  SELECT s.gsis_player_id, s.player_name, p.short_name, count(*) AS stat_rows
  FROM nfl_play_stats s JOIN player p ON p.gsis_player_id = s.gsis_player_id
  WHERE s.player_name IS NOT NULL AND p.short_name IS NOT NULL
  GROUP BY 1,2,3
), keyed AS (
  SELECT *, ${short_name_key('player_name')} AS ledger_key,
            ${short_name_key('short_name')} AS player_key
  FROM known_good
), per_id AS (
  SELECT gsis_player_id,
    bool_or(lower(player_name) = lower(short_name)) AS raw_match,
    bool_or(ledger_key = player_key) AS normalized_match,
    bool_or(player_name ~ '^[A-Za-z]{2,}[.]') AS has_multichar_initial
  FROM keyed GROUP BY 1
)
SELECT count(*) AS ids,
 count(*) FILTER (WHERE NOT raw_match) AS raw_false_negatives,
 round(100.0 * count(*) FILTER (WHERE NOT raw_match) / count(*), 2) AS raw_pct,
 count(*) FILTER (WHERE NOT normalized_match) AS normalized_false_negatives,
 round(100.0 * count(*) FILTER (WHERE NOT normalized_match) / count(*), 2) AS normalized_pct,
 count(*) FILTER (WHERE has_multichar_initial) AS multichar_ids,
 count(*) FILTER (WHERE has_multichar_initial AND NOT raw_match) AS multichar_raw_misses,
 count(*) FILTER (WHERE has_multichar_initial AND NOT normalized_match) AS multichar_normalized_misses
FROM per_id`)
  return rows[0]
}

const run_negative_control = async () => {
  const results = {}
  for (const normalized of [true, false]) {
    const { rows } = await db.raw(seeded_preflight_sql({ normalized }))
    const form = normalized ? 'normalized' : 'raw'
    results[form] = new Set(rows.map((row) => row.seed))
    log(`negative control (${form}): ${rows.length} rows`)
    for (const row of rows) {
      log(
        `  ${row.seed}: ${row.ledger_name} -> ${row.incumbent_pid} (${row.incumbent_name})`
      )
    }
  }

  const assertions = [
    [
      'normalized form finds the multi-character-initial seed',
      results.normalized.has('multichar')
    ],
    [
      'raw form MISSES the multi-character-initial seed',
      !results.raw.has('multichar')
    ],
    ['normalized form finds the plain seed', results.normalized.has('plain')],
    ['raw form finds the plain seed', results.raw.has('plain')],
    ['normalized form finds no absent seed', !results.normalized.has('absent')],
    ['raw form finds no absent seed', !results.raw.has('absent')]
  ]
  for (const [description, passed] of assertions) {
    log(`  ${passed ? 'PASS' : 'FAIL'} ${description}`)
  }
  return assertions.every(([, passed]) => passed)
}

/*
  Negative control for the external-id form.

  Its seeds are drawn from the table itself: a player row that already holds BOTH
  a gsis id and an esb id is a pair we know is the same person, so the form must
  return that row's own pid for that row's own esb id. A fabricated esb id must
  return nothing.

  This control cannot be built the way the name form's is. There the seeds are
  injected and the incumbents are real; here the whole point is that the feed
  identifier and the player column agree, so the only honest seed is a real
  agreeing pair.
*/
const run_external_id_negative_control = async () => {
  const { rows: known } = await db.raw(
    `SELECT gsis_player_id, esb_player_id, pfr_player_id, pid FROM player
     WHERE gsis_player_id IS NOT NULL AND esb_player_id IS NOT NULL
       AND primary_position <> 'DST' ORDER BY pid LIMIT 5`
  )
  const seeds = known.map((row) => ({
    gsis_player_id: row.gsis_player_id,
    esb_id: row.esb_player_id,
    pfr_id: row.pfr_player_id
  }))
  seeds.push({
    gsis_player_id: '00-0000000',
    esb_id: 'ZZZ999999',
    pfr_id: 'ZzzzZz99'
  })

  const { rows } = await db.raw(external_id_attach_sql(seeds))
  const found = new Map()
  for (const row of rows) {
    if (!found.has(row.gsis_player_id)) found.set(row.gsis_player_id, new Set())
    found.get(row.gsis_player_id).add(row.incumbent_pid)
  }
  log(`external-id control: ${rows.length} rows over ${seeds.length} seeds`)

  const assertions = [
    [
      'every known-good seed resolves to its own pid',
      known.every((row) => found.get(row.gsis_player_id)?.has(row.pid))
    ],
    ['the fabricated seed resolves to nothing', !found.has('00-0000000')]
  ]
  for (const [description, passed] of assertions) {
    log(`  ${passed ? 'PASS' : 'FAIL'} ${description}`)
  }
  return assertions.every(([, passed]) => passed)
}

const report_baselines = async () => {
  const { rows: population } = await db.raw(`WITH missing AS (
  ${missing_gsis_ids_sql}
), per_id AS (
  SELECT gsis_player_id, bool_or(season_type <> 'PRE') AS is_graded,
         sum(stat_rows) FILTER (WHERE season_type <> 'PRE') AS graded_rows
  FROM missing GROUP BY 1
)
SELECT count(*) AS missing_ids,
 count(*) FILTER (WHERE is_graded) AS graded_ids,
 count(*) FILTER (WHERE NOT is_graded) AS preseason_only_ids,
 sum(graded_rows) AS graded_stat_rows
FROM per_id`)
  log('population: %o', population[0])

  const { rows: collisions } = await db.raw(
    `SELECT count(*) AS candidate_pairs,
      count(DISTINCT gsis_player_id) AS colliding_ids,
      count(DISTINCT gsis_player_id) FILTER (WHERE is_graded) AS graded_colliding_ids,
      count(DISTINCT incumbent_pid) FILTER (WHERE incumbent_gsis IS NULL) AS incumbents_holding_no_gsis
     FROM (${collision_preflight_sql()}) preflight`
  )
  log('collision pre-flight: %o', collisions[0])

  for (const normalized of [false, true]) {
    const { rows } = await db.raw(
      `SELECT count(*) AS pair_team_seasons, count(DISTINCT name_key) AS names,
              count(DISTINCT (pid_a, pid_b)) AS distinct_pid_pairs
       FROM (${table_wide_collision_sql({ normalized })}) backlog`
    )
    log(
      `table-wide backlog (${normalized ? 'normalized' : 'raw'}): %o`,
      rows[0]
    )
  }

  return { population: population[0], collisions: collisions[0] }
}

const calibrate_player_identity_collision_oracle = async () => {
  const cases_pass = await check_normalization_cases()
  const false_negatives = await measure_false_negative_rate()
  log('false-negative rate at the gsis-id grain: %o', false_negatives)
  const control_pass = await run_negative_control()
  const external_id_control_pass = await run_external_id_negative_control()
  await report_baselines()

  if (!cases_pass || !control_pass || !external_id_control_pass) {
    throw new Error(
      'collision oracle calibration FAILED — do not trust any downstream "no collision" result'
    )
  }
  log('collision oracle calibration passed')
}

const main = async () => {
  let error
  try {
    await calibrate_player_identity_collision_oracle()
  } catch (err) {
    error = err
    log(error)
  }

  await db.destroy()
  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default calibrate_player_identity_collision_oracle
