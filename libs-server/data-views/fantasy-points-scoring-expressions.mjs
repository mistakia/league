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
    ],
    bonus_stat: { stat: 'passing_yards', yards_expr: 'COALESCE(pass_yds, 0)' }
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
        predicate: "is_first_down = true AND play_type = 'RUSH'",
        // Appended to the predicate when a format sets touchdown_is_first_down
        // = false, so a rushing touchdown that also gained a first down scores
        // the touchdown only. Mirrors the excluding-TD stat the gamelog path
        // substitutes; both paths must agree or the same play scores twice on
        // one of them.
        excluding_touchdown_predicate: 'is_rushing_touchdown IS NOT TRUE'
      }
    ],
    // The per-play yardage a bonus rule for this role reads. `stat` is the
    // vocabulary a bonus rule names; `yards_expr` is how this role measures it.
    bonus_stat: { stat: 'rushing_yards', yards_expr: 'COALESCE(rush_yds, 0)' }
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
        //
        // `position_column` is the legacy `with` path's reference: that builder
        // projects the position into its filtered_plays CTE as `trg_pos` and the
        // subqueries read it from there. The role-union path joins `player`
        // directly in its inner sub and so passes its own reference -- see
        // receiving_position_attribution below.
        position_override: {
          predicate: 'is_completion = true',
          position_column: 'trg_pos',
          // The positions the join restricts to. A player outside this set
          // reads NULL and the CASE falls through to the base value, so the
          // list is part of the scoring semantics rather than an optimization.
          join_positions: ['RB', 'WR', 'TE', 'FB'],
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
        predicate: "is_first_down = true AND play_type = 'PASS'",
        excluding_touchdown_predicate: 'is_passing_touchdown IS NOT TRUE',
        // The tight-end first-down premium. Same shape as the reception
        // override above; `predicate` is filled from the term's own predicate
        // at render time, since the excluding-touchdown toggle can change it.
        position_override: {
          position_column: 'trg_pos',
          join_positions: ['RB', 'WR', 'TE', 'FB'],
          columns: [['TE', 'tight_end_receiving_first_downs']]
        }
      }
    ],
    bonus_stat: { stat: 'receiving_yards', yards_expr: 'COALESCE(recv_yds, 0)' }
  }
]

const scoring_value = (scoring_format, column) => scoring_format[column] || 0

// A term's effective predicate. Identical to the declared one unless the format
// says a touchdown does not count as a first down, in which case the term's
// excluding-touchdown clause is appended. Emitting the clause only then is what
// keeps SQL byte-identical for the 65 production formats, all of which carry
// touchdown_is_first_down = true.
//
// Read as `!== false` rather than through the registry default, matching how
// every other value in this module is read: a format row that does not carry
// the column at all must behave as it did before the column existed.
const term_predicate = (term, scoring_format) => {
  if (
    term.excluding_touchdown_predicate &&
    scoring_format.touchdown_is_first_down === false
  ) {
    return `${term.predicate} AND ${term.excluding_touchdown_predicate}`
  }
  return term.predicate
}

// The bonus rules this role can express, split by class.
//
//   big_play   LINEAR -- a per-play condition, so it is an ordinary summed term
//              and needs no grain beyond the play.
//   milestone  AGGREGATE-CONDITIONAL -- a condition on the player-GAME total,
//              which is only expressible above the per-game stage in
//              build_role_union_period_cte.
//
// A rule naming a stat this role does not source is skipped here and picked up
// by the role that does. `rush_rec_yd` spans two roles and so is handled by the
// milestone builder rather than by any single role.
const bonus_rules = (scoring_format) => {
  const rules = scoring_format?.bonuses
  return Array.isArray(rules) ? rules : []
}

const is_usable_rule = (rule) =>
  rule &&
  typeof rule === 'object' &&
  Number(rule.points) !== 0 &&
  Number.isFinite(Number(rule.threshold))

// `points * count(qualifying plays)` as a per-play CASE, one term per rule.
const render_big_play_terms = (role, scoring_format) => {
  if (!role.bonus_stat) {
    return []
  }
  return bonus_rules(scoring_format)
    .filter(
      (rule) =>
        is_usable_rule(rule) &&
        rule.type === 'big_play' &&
        rule.stat === role.bonus_stat.stat
    )
    .map(
      (rule) =>
        `(CASE WHEN ${role.bonus_stat.yards_expr} >= ${Number(rule.threshold)} THEN ${Number(rule.points)} ELSE 0 END)`
    )
}

const render_position_override = (
  term,
  scoring_format,
  base_value,
  position_column_override
) => {
  const { predicate, position_column, columns } = term.position_override
  const cases = columns
    .map(([position, column]) => {
      // An override of exactly 0 falls back to the base value rather than
      // scoring nothing. That is the gamelog path's pinned behaviour
      // (calculate-points uses `||`, not `??`), and the two paths must agree.
      const override = scoring_value(scoring_format, column)
      return `WHEN '${position}' THEN ${override || base_value}`
    })
    .join(' ')
  const column_reference = position_column_override || position_column
  // A `rate` term's override declares its own predicate (a reception is
  // `is_completion = true`); a `conditional` term's IS its predicate, which the
  // touchdown toggle can change, so it is taken from the term rather than
  // restated on the override.
  const effective_predicate = predicate || term_predicate(term, scoring_format)
  return `CASE WHEN ${effective_predicate} THEN CASE ${column_reference} ${cases} ELSE ${base_value} END ELSE 0 END`
}

// An override applies only when it is NONZERO and differs from the base.
//
// The nonzero half is load bearing rather than defensive. `tight_end_reception`
// and the two beside it are set equal to the base by every production format,
// but `tight_end_receiving_first_downs` defaults to 0 while
// `receiving_first_downs` is commonly 0.5 -- so a strict `!== base` test would
// switch positional scoring ON for existing formats and emit a CASE paying a
// tight end nothing. Treating 0 as "no override" matches calculate-points,
// which reads the override through `||`.
const uses_position_override = (term, scoring_format, has_position_data) => {
  if (!has_position_data || !term.position_override) {
    return false
  }
  const base_value = scoring_value(scoring_format, term.column)
  return term.position_override.columns.some(([, column]) => {
    const override = scoring_value(scoring_format, column)
    return override !== 0 && override !== base_value
  })
}

const render_term = (
  term,
  scoring_format,
  has_position_data,
  position_column_override
) => {
  const value = scoring_value(scoring_format, term.column)

  if (uses_position_override(term, scoring_format, has_position_data)) {
    return render_position_override(
      term,
      scoring_format,
      value,
      position_column_override
    )
  }

  switch (term.kind) {
    case 'rate':
      return `${term.expr} * ${value}`
    case 'flat':
      return `${value}`
    case 'conditional':
      return `(CASE WHEN ${term_predicate(term, scoring_format)} THEN ${value} ELSE 0 END)`
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
  has_position_data = false,
  position_column_override = null
) => {
  if (!scoring_format) {
    scoring_format = await get_scoring_format(DEFAULT_SCORING_FORMAT_ID)
    if (!scoring_format) {
      return role.fallback
    }
  }

  return [
    ...role.terms
      .filter((term) =>
        term_is_emitted(term, scoring_format, has_position_data)
      )
      .map((term) =>
        render_term(
          term,
          scoring_format,
          has_position_data,
          position_column_override
        )
      ),
    // Appended after the declared terms, so a format with no big_play rule
    // emits exactly the SQL it did before bonuses existed.
    ...render_big_play_terms(role, scoring_format)
  ].join(' + ')
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
  has_position_data = false,
  position_column_override = null
) =>
  generate_role_scoring_inner(
    role_by_name.receiving,
    scoring_format,
    has_position_data,
    position_column_override
  )

export const generate_receiving_scoring_sql = async (
  scoring_format,
  has_position_data = false
) =>
  `ROUND(SUM(${await generate_receiving_scoring_inner(scoring_format, has_position_data)}), 2)`

// --- Milestone bonuses: the aggregate-conditional class ---
//
// A milestone is a condition on the player-GAME total, which no per-play
// expression can express. build_role_union_period_cte grew a per-game stage for
// exactly this: a role declares `game_aggregates` (per-play expressions summed
// per player-game) and the column declares `game_conditional_expr` (evaluated
// once per player-game against those sums).
//
// `rush_rec_yd` is why the aggregates are declared per ROLE and evaluated
// centrally rather than inside a role: rushing yards come from the
// ball_carrier_pid arm and receiving yards from the target_pid arm, so their sum
// only exists after the union.
const MILESTONE_ALIAS_BY_STAT = {
  passing_yards: 'bonus_passing_yards',
  rushing_yards: 'bonus_rushing_yards',
  receiving_yards: 'bonus_receiving_yards'
}

// The stats a milestone rule may name, and how each resolves against the
// per-game aliases. A rule naming anything else is ignored rather than thrown,
// so a config written for a newer engine does not break an older one.
const milestone_value_expr = (stat) => {
  if (MILESTONE_ALIAS_BY_STAT[stat]) {
    return `role_union.${MILESTONE_ALIAS_BY_STAT[stat]}`
  }
  if (stat === 'rush_rec_yd') {
    return `(role_union.${MILESTONE_ALIAS_BY_STAT.rushing_yards} + role_union.${MILESTONE_ALIAS_BY_STAT.receiving_yards})`
  }
  return null
}

const milestone_rules = (scoring_format) =>
  bonus_rules(scoring_format).filter(
    (rule) =>
      is_usable_rule(rule) &&
      rule.type === 'milestone' &&
      milestone_value_expr(rule.stat)
  )

// The per-game aggregates a role must project for this format's milestones.
// Empty for every format carrying no milestone rule, which is what keeps the
// per-game stage unemitted and the SQL unchanged.
export const resolve_role_game_aggregates = (role_name, scoring_format) => {
  const role = role_by_name[role_name]
  if (!role?.bonus_stat) {
    return null
  }

  const stats_needed = new Set(
    milestone_rules(scoring_format).flatMap((rule) =>
      rule.stat === 'rush_rec_yd'
        ? ['rushing_yards', 'receiving_yards']
        : [rule.stat]
    )
  )

  if (!stats_needed.has(role.bonus_stat.stat)) {
    return null
  }
  return {
    [MILESTONE_ALIAS_BY_STAT[role.bonus_stat.stat]]: role.bonus_stat.yards_expr
  }
}

// The SQL added once per player-game: the sum of every milestone that fires.
// Null when the format declares none, which leaves the per-game stage unemitted.
export const generate_milestone_conditional = (scoring_format) => {
  const rules = milestone_rules(scoring_format)
  if (!rules.length) {
    return null
  }

  return rules
    .map(
      (rule) =>
        `(CASE WHEN ${milestone_value_expr(rule.stat)} >= ${Number(rule.threshold)} THEN ${Number(rule.points)} ELSE 0 END)`
    )
    .join(' + ')
}

// Does this format need position data to score receptions correctly?
//
// Derived from the receiving role's own `position_override` declaration rather
// than restating the three column names, so a fourth positional reception
// column would be honored by adding it to the table and nothing else. Both
// from-plays builders gate on this, which is what keeps them from disagreeing
// about whether the positional CASE applies.
//
// Confirmed equivalent to the hand-written predicate it replaced across all 65
// production formats -- that one required the positional value to be TRUTHY as
// well as different, so the two disagree only for a format overriding a nonzero
// base with an explicit 0, which none carries.
export const needs_position_data = (scoring_format) => {
  if (!scoring_format) {
    return false
  }
  return PLAYS_SOURCED_ROLES.some((role) =>
    role.terms.some((term) =>
      uses_position_override(term, scoring_format, true)
    )
  )
}

// The `player` join and position reference the role-union path needs to score
// receptions positionally, in the shape build_period_cte's role_attributions
// already accept -- the same `apply_joins` hook the stat-sourced roles use.
//
// This is what makes position-aware receiving reachable on that path. A comment
// in the column definitions asserted for a long time that it was not, because
// the builder had no leftJoin support; `apply_joins` was added for the
// nfl_play_stats-sourced roles and applies unconditionally to any role
// supplying one, so the capability had been there and unused.
//
// The join mirrors the legacy `with` builder's exactly, restriction included: a
// player outside join_positions reads NULL and the CASE falls through to the
// base value, so widening it here would silently change scoring on one path
// only.
export const receiving_position_attribution = (() => {
  const { position_override } = role_by_name.receiving.terms.find(
    (term) => term.position_override
  )
  const alias = 'p_trg'
  return {
    position_column: `${alias}.primary_position`,
    apply_joins: ({ query, plays_table }) => {
      query.leftJoin(`player as ${alias}`, function () {
        this.on(`${plays_table}.target_pid`, `${alias}.pid`)
        this.andOnIn(
          `${alias}.primary_position`,
          position_override.join_positions
        )
      })
    }
  }
})()

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
    ...PLAYS_SOURCED_ROLES.flatMap((role) => [
      ...role.terms.flatMap((term) => [
        term.column,
        ...(term.position_override
          ? term.position_override.columns.map(([, column]) => column)
          : []),
        // A term carrying an excluding-touchdown clause is what makes
        // `touchdown_is_first_down` a scored column here: the switch has no
        // term of its own, it changes another term's predicate.
        ...(term.excluding_touchdown_predicate
          ? ['touchdown_is_first_down']
          : [])
      ]),
      // Likewise `bonuses` has no single term -- a role that declares a
      // bonus_stat can emit big_play terms and project milestone aggregates
      // from the rule list, which is what scoring it means on this path.
      ...(role.bonus_stat ? ['bonuses'] : [])
    ]),
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
