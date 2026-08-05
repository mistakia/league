import db from '#db'
import { DEFAULT_SCORING_FORMAT_ID } from '#libs-shared'
import {
  fumble_return_touchdown_attribution,
  fumble_lost_attribution,
  punt_return_touchdown_attribution,
  kickoff_return_touchdown_attribution,
  two_point_conversion_attribution,
  field_goal_attribution,
  extra_point_attribution,
  PUNT_RETURN_TOUCHDOWN_STAT_IDS,
  KICKOFF_RETURN_TOUCHDOWN_STAT_IDS,
  TWO_POINT_CONVERSION_STAT_IDS,
  FIELD_GOAL_STAT_IDS,
  EXTRA_POINT_STAT_IDS,
  FIELD_GOAL_STATS_ALIAS
} from '#libs-server/data-views/nfl-play-stats-attribution.mjs'

// Every scoring expression the from-plays fantasy-points path emits, for both
// of its builders -- the legacy `with` path and the role-union path. The two
// consume different members of the same scoring object: the `with` path
// aggregates inside its UNION arm and so takes the ROUND(SUM(...)) form, while
// the role-union path lets the aggregator wrap the per-row inner expression.
//
// Kept out of player-fantasy-points-from-plays-column-definitions.mjs, which is
// the query BUILDER -- it decides which subqueries to emit and how to join
// them, and does not need to know how a field goal is scored.
//
// test/libs-server.fantasy-points-path-parity.spec.mjs imports
// `from_plays_scored_columns` below as its coverage map. That export is derived
// from the two role tables in this file, so adding a term or a role updates the
// map by construction -- there is no list to keep in step and no file path for
// the spec to go stale against.

// Get scoring format from database if scoring_format_id is provided
export const get_scoring_format = async (scoring_format_id) => {
  if (!scoring_format_id) {
    return null
  }

  // Handle array format (take first element)
  const format_id = Array.isArray(scoring_format_id)
    ? scoring_format_id[0]
    : scoring_format_id

  if (!format_id) {
    return null
  }

  const format = await db('league_scoring_formats')
    .where('id', format_id)
    .first()

  if (!format) {
    // In test environment, fallback to default scoring instead of throwing error
    if (process.env.NODE_ENV === 'test') {
      console.warn(
        `Scoring format not found for id: ${format_id}. Falling back to default scoring.`
      )
      return null
    }
    throw new Error(
      `Scoring format not found for id: ${format_id}. Please ensure the scoring format exists in the database.`
    )
  }

  return format
}

// The three roles nfl_plays names with a pid column of its own, as declarative
// terms rather than three hand-written string builders.
//
// WHY THIS IS A TABLE. STAT_SOURCED_ROLES below has been one since the roles it
// covers were written, and every column in it is checkable by reading it. These
// three were the residue: passing, rushing and receiving each built their SQL by
// `let sql = ...` plus a chain of `if`s, and that is where every divergence this
// path has suffered actually lived -- passing_completions unscored for years
// while two production formats paid 0.50 and 0.20 for it, and a dead Sleeper
// hash branch that could never be true. Neither was visible without reading the
// function line by line.
//
// With the terms declared, test/libs-server.fantasy-points-path-parity.spec.mjs
// READS the coverage map instead of grepping this file for column names. A
// scoring column is covered exactly when some term names it.
//
// BYTE-IDENTICAL EMISSION IS THE CONSTRAINT. The three `kind`s and the `always`
// flag exist to reproduce the previous output character for character, not to be
// a general expression language:
//
//   rate         `<expr> * <value>`   -- a per-play quantity times a rate
//   flat         `<value>`            -- the role's join already restricts the
//                                       rows, so one row IS one event (a rush
//                                       attempt, a target); there is nothing to
//                                       multiply
//   conditional  `(CASE WHEN <predicate> THEN <value> ELSE 0 END)`
//
// `always: true` emits the term even when the format scores it at 0, which the
// previous code did for the leading terms of each role and did NOT for the
// trailing ones. Preserving that split is what keeps 248 goldens from moving.
//
// Values are read as `scoring_format[column] || 0`, deliberately NOT through the
// registry's default_value fallback: a format row missing a column must keep
// emitting 0 here, or existing SQL changes.
const PLAYS_SOURCED_ROLES = [
  {
    name: 'passing',
    pid_column: 'passer_pid',
    // Used only when no scoring format resolves at all, which happens in the
    // test environment. Not derived from the terms -- it predates them and
    // carries its own values.
    fallback:
      'COALESCE(pass_yds, 0) * 0.04 + COALESCE(is_passing_touchdown::int, 0) * 4 + COALESCE("is_interception"::int, 0) * -1',
    terms: [
      {
        column: 'passing_yards',
        kind: 'rate',
        expr: 'COALESCE(pass_yds, 0)',
        always: true
      },
      {
        column: 'passing_touchdowns',
        kind: 'rate',
        expr: 'COALESCE(is_passing_touchdown::int, 0)',
        always: true
      },
      {
        column: 'passing_interceptions',
        kind: 'rate',
        expr: 'COALESCE("is_interception"::int, 0)',
        always: true
      },
      {
        // A completion credited to the PASSER, off the same nfl_plays column the
        // receiving role reads for a reception. Emitted only when scored, so the
        // 63 production formats carrying 0 keep byte-identical SQL.
        column: 'passing_completions',
        kind: 'rate',
        expr: 'COALESCE(is_completion::int, 0)'
      }
    ]
  },
  {
    name: 'rushing',
    pid_column: 'ball_carrier_pid',
    fallback:
      'COALESCE(rush_yds, 0) * 0.1 + COALESCE(is_rushing_touchdown::int, 0) * 6',
    terms: [
      {
        column: 'rushing_yards',
        kind: 'rate',
        expr: 'COALESCE(rush_yds, 0)',
        always: true
      },
      {
        column: 'rushing_touchdowns',
        kind: 'rate',
        expr: 'COALESCE(is_rushing_touchdown::int, 0)',
        always: true
      },
      { column: 'rushing_attempts', kind: 'flat' },
      {
        column: 'rushing_first_downs',
        kind: 'conditional',
        predicate: "is_first_down = true AND play_type = 'RUSH'"
      }
    ]
  },
  {
    name: 'receiving',
    pid_column: 'target_pid',
    fallback:
      'COALESCE(is_completion::int, 0) * 1 + COALESCE(recv_yds, 0) * 0.1 + COALESCE(is_passing_touchdown::int, 0) * 6',
    terms: [
      {
        column: 'receiving_yards',
        kind: 'rate',
        expr: 'COALESCE(recv_yds, 0)',
        always: true
      },
      {
        column: 'receiving_touchdowns',
        kind: 'rate',
        expr: 'COALESCE(is_passing_touchdown::int, 0)',
        always: true
      },
      {
        column: 'receptions',
        kind: 'rate',
        expr: 'COALESCE(is_completion::int, 0)',
        always: true,
        // Applied only when the caller supplies position data AND some position
        // value differs from the base -- otherwise the plain rate form is
        // emitted, which is what every uniform-reception format gets.
        position_override: {
          predicate: 'is_completion = true',
          position_column: 'trg_pos',
          columns: [
            ['RB', 'running_back_reception'],
            ['WR', 'wide_receiver_reception'],
            ['TE', 'tight_end_reception']
          ]
        }
      },
      { column: 'targets', kind: 'flat' },
      {
        column: 'receiving_first_downs',
        kind: 'conditional',
        predicate: "is_first_down = true AND play_type = 'PASS'"
      }
    ]
  }
]

const scoring_value = (scoring_format, column) => scoring_format[column] || 0

const render_position_override = (term, scoring_format, base_value) => {
  const { predicate, position_column, columns } = term.position_override
  const cases = columns
    .map(
      ([position, column]) =>
        `WHEN '${position}' THEN ${scoring_value(scoring_format, column)}`
    )
    .join(' ')
  return `CASE WHEN ${predicate} THEN CASE ${position_column} ${cases} ELSE ${base_value} END ELSE 0 END`
}

const uses_position_override = (term, scoring_format, has_position_data) => {
  if (!has_position_data || !term.position_override) {
    return false
  }
  const base_value = scoring_value(scoring_format, term.column)
  return term.position_override.columns.some(
    ([, column]) => scoring_value(scoring_format, column) !== base_value
  )
}

const render_term = (term, scoring_format, has_position_data) => {
  const value = scoring_value(scoring_format, term.column)

  if (uses_position_override(term, scoring_format, has_position_data)) {
    return render_position_override(term, scoring_format, value)
  }

  switch (term.kind) {
    case 'rate':
      return `${term.expr} * ${value}`
    case 'flat':
      return `${value}`
    case 'conditional':
      return `(CASE WHEN ${term.predicate} THEN ${value} ELSE 0 END)`
    default:
      throw new Error(`unknown scoring term kind: ${term.kind}`)
  }
}

// A term is emitted when it is declared `always` or when the format scores it
// nonzero. A position override counts as scoring even if the base value is 0.
const term_is_emitted = (term, scoring_format, has_position_data) =>
  Boolean(term.always) ||
  scoring_value(scoring_format, term.column) !== 0 ||
  uses_position_override(term, scoring_format, has_position_data)

const generate_role_scoring_inner = async (
  role,
  scoring_format,
  has_position_data = false
) => {
  if (!scoring_format) {
    scoring_format = await get_scoring_format(DEFAULT_SCORING_FORMAT_ID)
    if (!scoring_format) {
      return role.fallback
    }
  }

  return role.terms
    .filter((term) => term_is_emitted(term, scoring_format, has_position_data))
    .map((term) => render_term(term, scoring_format, has_position_data))
    .join(' + ')
}

const role_by_name = Object.fromEntries(
  PLAYS_SOURCED_ROLES.map((role) => [role.name, role])
)

// Per-row inner expressions (no SUM / ROUND wrapper) and their aggregated forms.
// The role-union builder consumes the inner shape and lets its aggregator wrap
// it; the legacy `with` builder aggregates inside its UNION arm.
export const generate_passing_scoring_inner = async (scoring_format) =>
  generate_role_scoring_inner(role_by_name.passing, scoring_format)

export const generate_passing_scoring_sql = async (scoring_format) =>
  `ROUND(SUM(${await generate_passing_scoring_inner(scoring_format)}), 2)`

export const generate_rushing_scoring_inner = async (scoring_format) =>
  generate_role_scoring_inner(role_by_name.rushing, scoring_format)

export const generate_rushing_scoring_sql = async (scoring_format) =>
  `ROUND(SUM(${await generate_rushing_scoring_inner(scoring_format)}), 2)`

export const generate_receiving_scoring_inner = async (
  scoring_format,
  has_position_data = false
) =>
  generate_role_scoring_inner(
    role_by_name.receiving,
    scoring_format,
    has_position_data
  )

export const generate_receiving_scoring_sql = async (
  scoring_format,
  has_position_data = false
) =>
  `ROUND(SUM(${await generate_receiving_scoring_inner(scoring_format, has_position_data)}), 2)`

// Per-row fumble-lost penalty. Like the fumble return touchdown below, this
// role is sourced from nfl_play_stats (stat_id 106) rather than from
// nfl_plays.player_fuml_pid, because that column is set on every play carrying
// any fumble and so over-charged the penalty by more than 2x against the
// gamelogs path -- see nfl-play-stats-attribution.mjs. The join restricts the
// role to the charged plays, so the expression is the flat per-fumble value
// rather than a conditional.
// Per-row value for a FLAT stat-sourced role -- one stat row, one scoring
// value. The role's join already restricts to plays carrying the relevant stat
// row, so the expression is the flat per-event value rather than a conditional.
//
// One factory rather than four near-identical generators. Each of these roles
// exists only because the player identity is read from nfl_play_stats:
// nfl_plays names no returner and does not name the converting player on a two
// point conversion, so reading pid columns credited these events to nobody --
// the source of the recurring -6, -12 and -2.00 per-player deltas against
// gamelog fantasy points.
//
// `fallback` is the value used when no scoring format resolves at all, matching
// the per-role default the catalog carries.
const create_flat_role_scoring = ({ column, fallback }) => {
  const inner = async (scoring_format) => {
    if (!scoring_format) {
      scoring_format = await get_scoring_format(DEFAULT_SCORING_FORMAT_ID)
      if (!scoring_format) {
        return fallback
      }
    }

    return String(scoring_format[column] || 0)
  }

  return {
    columns: [column],
    inner,
    sql: async (scoring_format) =>
      `ROUND(SUM(${await inner(scoring_format)}), 2)`,
    // Uniform shape both from-plays paths iterate. `scores` is what drives the
    // zero-scoring skip; for a flat role it is just the constant being nonzero.
    resolve: async (scoring_format) => {
      const expression = await inner(scoring_format)
      return { expression, scores: Number(expression) !== 0 }
    }
  }
}

// Field goals are the one stat-sourced role whose value is not a constant, so
// it cannot use the flat factory: the value depends on the kick distance, which
// lives on the joined stat row rather than on the format.
//
// Two things here are load-bearing and neither is visible in calculate-points.mjs,
// which after the Phase 3 registry rewrite is a plain dot product of band COUNTS
// against band values (it contains no field-goal literal at all). Both come from
// calculate-stats-from-play-stats.mjs case 70, which is what builds those counts.
//
// The band cuts are < 20 / < 30 / < 40 / < 50 / else, one band per made kick.
//
// The per-yard term is GREATEST(yards, 30), NOT the raw distance -- case 70
// accumulates `Math.max(playStat.yards, 30)` into field_goal_yards, so a 19-yard
// kick contributes 30. Using the raw distance under-scores every field goal
// shorter than 30 yards, and the two paths then disagree silently.
const FIELD_GOAL_BANDS = [
  { column: 'field_goals_made_0_19_yards', below: 20 },
  { column: 'field_goals_made_20_29_yards', below: 30 },
  { column: 'field_goals_made_30_39_yards', below: 40 },
  { column: 'field_goals_made_40_49_yards', below: 50 }
]
const FIELD_GOAL_50_PLUS_COLUMN = 'field_goals_made_50_plus_yards'
const FIELD_GOAL_YARDS_FLOOR = 30

const create_field_goal_role_scoring = () => {
  const resolve = async (scoring_format) => {
    if (!scoring_format) {
      scoring_format = await get_scoring_format(DEFAULT_SCORING_FORMAT_ID)
    }

    const read = (column) => Number(scoring_format?.[column] || 0)
    const bands = FIELD_GOAL_BANDS.map(({ column, below }) => ({
      below,
      value: read(column)
    }))
    const fifty_plus = read(FIELD_GOAL_50_PLUS_COLUMN)
    const per_yard = read('field_goal_yards')

    const scores =
      per_yard !== 0 ||
      fifty_plus !== 0 ||
      bands.some(({ value }) => value !== 0)
    if (!scores) {
      return { expression: '0', scores: false }
    }

    const yards = `"${FIELD_GOAL_STATS_ALIAS}"."stat_yards"`
    const band_expression =
      `CASE ` +
      bands
        .map(({ below, value }) => `WHEN ${yards} < ${below} THEN ${value}`)
        .join(' ') +
      ` ELSE ${fifty_plus} END`

    // Production scores every band at 0 and the rate at 0.1, so the band CASE
    // collapses to a constant 0 there and the per-yard term carries the score.
    // A banded league is the inverse. Both terms are always emitted when the
    // role scores at all, which keeps the expression one shape.
    const per_yard_expression = `${per_yard} * GREATEST(${yards}, ${FIELD_GOAL_YARDS_FLOOR})`

    return {
      expression: `(${band_expression}) + (${per_yard_expression})`,
      scores: true
    }
  }

  return {
    columns: [
      ...FIELD_GOAL_BANDS.map(({ column }) => column),
      FIELD_GOAL_50_PLUS_COLUMN,
      'field_goal_yards'
    ],
    resolve,
    sql: async (scoring_format) => {
      const { expression } = await resolve(scoring_format)
      return `ROUND(SUM(${expression}), 2)`
    }
  }
}

const fumble_lost_role_scoring = create_flat_role_scoring({
  column: 'fumbles_lost',
  fallback: '-1'
})
const fumble_return_touchdown_role_scoring = create_flat_role_scoring({
  column: 'fumble_return_touchdowns',
  fallback: '6'
})
const punt_return_touchdown_role_scoring = create_flat_role_scoring({
  column: 'punt_return_touchdowns',
  fallback: '6'
})
const kickoff_return_touchdown_role_scoring = create_flat_role_scoring({
  column: 'kickoff_return_touchdowns',
  fallback: '6'
})
const two_point_conversion_role_scoring = create_flat_role_scoring({
  column: 'two_point_conversions',
  fallback: '2'
})
// An extra point IS flat on the scoring path, even though case 72 increments two
// fields on the gamelogs path: only `extra_points_made` is a scoring column, and
// `xpa` is an attempt count nothing scores (it is also shared with the missed
// kick, case 73). That asymmetry is why the stat-role registry excludes 72 while
// this factory accepts it.
const extra_point_role_scoring = create_flat_role_scoring({
  column: 'extra_points_made',
  fallback: '1'
})
const field_goal_role_scoring = create_field_goal_role_scoring()

// Every stat-sourced role in one table. Both from-plays paths iterate this
// rather than repeating a near-identical block per role -- the legacy `with`
// path to build its subqueries and its EXISTS gate, the role-union path to build
// its roles. `gate_stat_ids` is null for the two fumble roles, whose plays are
// already reachable through nfl_plays.player_fuml_pid and so need no widening.
// `subquery_alias` is the legacy `with` path's UNION-arm alias and is emitted
// verbatim, so the five pre-existing values are pinned rather than derived --
// deriving them would rename fuml_stats and change SQL for every format.
//
// The two kicking roles take a `_role_stats` suffix deliberately. Deriving
// theirs would produce `field_goal_stats`, which is already the alias of the
// nfl_play_stats JOIN inside that same subquery (the field-goal scoring
// expression reads its `stat_yards`). Postgres resolves the two by nesting, but an
// alias collision in this exact path is what 67278d518 had to repair, so they
// are kept distinct.
const STAT_SOURCED_ROLES = [
  {
    name: 'fumble_lost',
    attribution: fumble_lost_attribution,
    scoring: fumble_lost_role_scoring,
    gate_stat_ids: null,
    subquery_alias: 'fuml_stats'
  },
  {
    name: 'fumble_return_touchdown',
    attribution: fumble_return_touchdown_attribution,
    scoring: fumble_return_touchdown_role_scoring,
    gate_stat_ids: null,
    subquery_alias: 'fumble_return_touchdown_stats'
  },
  {
    name: 'punt_return_touchdown',
    attribution: punt_return_touchdown_attribution,
    scoring: punt_return_touchdown_role_scoring,
    gate_stat_ids: PUNT_RETURN_TOUCHDOWN_STAT_IDS,
    subquery_alias: 'punt_return_touchdown_stats'
  },
  {
    name: 'kickoff_return_touchdown',
    attribution: kickoff_return_touchdown_attribution,
    scoring: kickoff_return_touchdown_role_scoring,
    gate_stat_ids: KICKOFF_RETURN_TOUCHDOWN_STAT_IDS,
    subquery_alias: 'kickoff_return_touchdown_stats'
  },
  {
    name: 'two_point_conversion',
    attribution: two_point_conversion_attribution,
    scoring: two_point_conversion_role_scoring,
    gate_stat_ids: TWO_POINT_CONVERSION_STAT_IDS,
    subquery_alias: 'two_point_conversion_stats'
  },
  {
    name: 'field_goal',
    attribution: field_goal_attribution,
    scoring: field_goal_role_scoring,
    gate_stat_ids: FIELD_GOAL_STAT_IDS,
    subquery_alias: 'field_goal_role_stats'
  },
  {
    name: 'extra_point',
    attribution: extra_point_attribution,
    scoring: extra_point_role_scoring,
    gate_stat_ids: EXTRA_POINT_STAT_IDS,
    subquery_alias: 'extra_point_role_stats'
  }
]

// Every league_scoring_formats column this path can score, derived from the two
// role tables rather than asserted anywhere.
//
// This is the from-plays half of the coverage map that
// test/libs-server.fantasy-points-path-parity.spec.mjs checks against the
// scoring registry. It used to be recovered by grepping this file's TEXT with
// three regexes -- one per shape a column name could reach a generator in --
// plus a positive control, because a matcher that quietly stopped matching would
// have reported perfect parity over a path scoring nothing. None of that is
// needed now: a column is scored here exactly when a term or a role names it,
// and both are data.
//
// A column added to a role but never emitted would still be reported covered.
// That is a real limit of any coverage map and is why it is a map rather than a
// residual -- the spec's header carries the full argument.
export const from_plays_scored_columns = [
  ...new Set([
    ...PLAYS_SOURCED_ROLES.flatMap((role) =>
      role.terms.flatMap((term) => [
        term.column,
        ...(term.position_override
          ? term.position_override.columns.map(([, column]) => column)
          : [])
      ])
    ),
    ...STAT_SOURCED_ROLES.flatMap((role) => role.scoring.columns)
  ])
]

// Resolve every stat-sourced role against a format, keeping only the ones it
// actually scores. Omitting a zero-scored role is not just an optimization: its
// joins are pure cost for a term that is always zero, and leaving it out keeps
// the emitted SQL byte-identical for the formats that carry 0.
export const resolve_stat_sourced_roles = async (scoring_format) => {
  const resolved = await Promise.all(
    STAT_SOURCED_ROLES.map(async (role) => ({
      ...role,
      ...(await role.scoring.resolve(scoring_format))
    }))
  )
  return resolved.filter(({ scores }) => scores)
}
