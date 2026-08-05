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
// test/libs-server.fantasy-points-path-parity.spec.mjs reads this file as text
// to build its coverage map, so a scoring column referenced only here is still
// seen. It reads the column-definitions file too; neither path may be dropped.

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

// Per-row passing scoring inner expression (no SUM / ROUND wrapper).
export const generate_passing_scoring_inner = async (scoring_format) => {
  if (!scoring_format) {
    scoring_format = await get_scoring_format(DEFAULT_SCORING_FORMAT_ID)
    if (!scoring_format) {
      return 'COALESCE(pass_yds, 0) * 0.04 + COALESCE(is_passing_touchdown::int, 0) * 4 + COALESCE("is_interception"::int, 0) * -1'
    }
  }

  const py = scoring_format.passing_yards || 0
  const ptd = scoring_format.passing_touchdowns || 0
  const ints = scoring_format.passing_interceptions || 0
  const pc = scoring_format.passing_completions || 0

  let sql = `COALESCE(pass_yds, 0) * ${py} + COALESCE(is_passing_touchdown::int, 0) * ${ptd} + COALESCE("is_interception"::int, 0) * ${ints}`

  // A completion credited to the PASSER, off the same nfl_plays column the
  // receiving generator reads for a reception. Appended only when scored, so a
  // format carrying 0 emits byte-identical SQL -- which is every named format
  // and 63 of the 65 production formats.
  //
  // This was missing entirely until 2026-08-05 while two production formats
  // scored it at 0.50 and 0.20, so their from-plays points under-reported a
  // 350-completion quarterback by up to 175 a season with nothing failing.
  if (pc) {
    sql += ` + COALESCE(is_completion::int, 0) * ${pc}`
  }

  return sql
}

export const generate_passing_scoring_sql = async (scoring_format) =>
  `ROUND(SUM(${await generate_passing_scoring_inner(scoring_format)}), 2)`

export const generate_rushing_scoring_inner = async (scoring_format) => {
  if (!scoring_format) {
    scoring_format = await get_scoring_format(DEFAULT_SCORING_FORMAT_ID)
    if (!scoring_format) {
      return 'COALESCE(rush_yds, 0) * 0.1 + COALESCE(is_rushing_touchdown::int, 0) * 6'
    }
  }

  const ry = scoring_format.rushing_yards || 0
  const rtd = scoring_format.rushing_touchdowns || 0
  const rufd = scoring_format.rushing_first_downs || 0
  const ra = scoring_format.rushing_attempts || 0

  let sql = `COALESCE(rush_yds, 0) * ${ry} + COALESCE(is_rushing_touchdown::int, 0) * ${rtd}`

  if (ra) {
    sql += ` + ${ra}`
  }

  if (rufd) {
    const is_sleeper_sfb =
      scoring_format &&
      scoring_format.scoring_format_id ===
        'ed9c2daa0f00d9389f450b577c16fb0864fa22c6e261c0161db5f2da54457286'
    if (is_sleeper_sfb) {
      sql += ` + (CASE WHEN is_first_down = true AND play_type = 'RUSH' AND COALESCE(is_rushing_touchdown::int, 0) = 0 THEN ${rufd} ELSE 0 END)`
    } else {
      sql += ` + (CASE WHEN is_first_down = true AND play_type = 'RUSH' THEN ${rufd} ELSE 0 END)`
    }
  }

  return sql
}

export const generate_rushing_scoring_sql = async (scoring_format) =>
  `ROUND(SUM(${await generate_rushing_scoring_inner(scoring_format)}), 2)`

export const generate_receiving_scoring_inner = async (
  scoring_format,
  has_position_data = false
) => {
  if (!scoring_format) {
    scoring_format = await get_scoring_format(DEFAULT_SCORING_FORMAT_ID)
    if (!scoring_format) {
      return 'COALESCE(is_completion::int, 0) * 1 + COALESCE(recv_yds, 0) * 0.1 + COALESCE(is_passing_touchdown::int, 0) * 6'
    }
  }

  const recy = scoring_format.receiving_yards || 0
  const rctd = scoring_format.receiving_touchdowns || 0
  const rec = scoring_format.receptions || 0
  const rbrec = scoring_format.running_back_reception || 0
  const wrrec = scoring_format.wide_receiver_reception || 0
  const terec = scoring_format.tight_end_reception || 0
  const trg = scoring_format.targets || 0
  const recfd = scoring_format.receiving_first_downs || 0

  let sql = `COALESCE(recv_yds, 0) * ${recy} + COALESCE(is_passing_touchdown::int, 0) * ${rctd}`

  if (has_position_data && (rbrec !== rec || wrrec !== rec || terec !== rec)) {
    sql += ` + CASE WHEN is_completion = true THEN CASE trg_pos WHEN 'RB' THEN ${rbrec} WHEN 'WR' THEN ${wrrec} WHEN 'TE' THEN ${terec} ELSE ${rec} END ELSE 0 END`
  } else {
    sql += ` + COALESCE(is_completion::int, 0) * ${rec}`
  }

  if (trg) {
    sql += ` + ${trg}`
  }

  if (recfd) {
    const is_sleeper_sfb =
      scoring_format &&
      scoring_format.scoring_format_id ===
        'ed9c2daa0f00d9389f450b577c16fb0864fa22c6e261c0161db5f2da54457286'
    if (is_sleeper_sfb) {
      sql += ` + (CASE WHEN is_first_down = true AND play_type = 'PASS' AND COALESCE(is_passing_touchdown::int, 0) = 0 THEN ${recfd} ELSE 0 END)`
    } else {
      sql += ` + (CASE WHEN is_first_down = true AND play_type = 'PASS' THEN ${recfd} ELSE 0 END)`
    }
  }

  return sql
}

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
