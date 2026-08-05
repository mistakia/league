import db from '#db'
import {
  nfl_plays_column_params,
  DEFAULT_SCORING_FORMAT_ID
} from '#libs-shared'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import apply_play_by_play_column_params_to_query from '#libs-server/apply-play-by-play-column-params-to-query.mjs'
import { apply_plays_join } from '#libs-server/data-views/source-attach/apply-plays-join.mjs'
import { get_cache_info_for_fields_from_plays } from '#libs-server/data-views/get-cache-info-for-fields-from-plays.mjs'
import get_play_by_play_default_params from '#libs-server/data-views/get-play-by-play-default-params.mjs'
import get_effective_years from '#libs-server/data-views/get-effective-years.mjs'
import { is_year_offset_range } from '#libs-server/data-views/year-offset-range.mjs'
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

const FP_OUTPUT_PERIODS = [
  'game',
  'season',
  'team_play',
  'team_pass_play',
  'team_rush_play',
  'team_half',
  'team_quarter',
  'team_drive',
  'team_series',
  'player_rush_attempt',
  'player_pass_attempt',
  'player_target',
  'player_catchable_target',
  'player_catchable_deep_target',
  'player_reception',
  'player_play',
  'player_route',
  'player_pass_play',
  'player_rush_play'
]

const plays_source = {
  grain: 'player_year',
  // Grain narrowed to player_year (not player_year_week) so the
  // player_year->player_year_week bridge path isn't exercised by week row_axes.
  // The `with` builder (fantasy_points_from_plays_with) projects year AND week
  // onto the CTE, and apply_plays_join emits the week join predicate; declare
  // supports_row_axes so the dispatcher forwards both row_axes to those funcs
  // instead of intersecting against grain's ['year'] and dropping week -- which
  // collapses the CTE to a season total repeated at every per-week row. Mirrors
  // player_stats_from_plays / team_stats_from_plays / defensive_player_stats.
  supports_row_axes: ['year', 'week'],
  attach: apply_plays_join
}

const generate_fantasy_points_table_alias = ({ params = {} } = {}) => {
  const column_param_keys = Object.keys(nfl_plays_column_params).sort()
  const key = column_param_keys
    .map((key) => {
      const value = params[key]
      return Array.isArray(value)
        ? `${key}${value.sort().join('')}`
        : `${key}${value || ''}`
    })
    .join('')

  return get_table_hash(`fantasy_points_from_plays_${key}`)
}

// Get scoring format from database if scoring_format_id is provided
const get_scoring_format = async (scoring_format_id) => {
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

// Check if position data is needed based on scoring format
const needs_position_data = (scoring_format) => {
  if (!scoring_format) {
    return false // Default scoring doesn't need position data
  }

  // Check if any position-specific reception scoring differs from base reception scoring
  const base_rec = scoring_format.receptions || 0
  return (
    (scoring_format.running_back_reception &&
      scoring_format.running_back_reception !== base_rec) ||
    (scoring_format.wide_receiver_reception &&
      scoring_format.wide_receiver_reception !== base_rec) ||
    (scoring_format.tight_end_reception &&
      scoring_format.tight_end_reception !== base_rec)
  )
}

const fantasy_points_from_plays_with = async ({
  query,
  params = {},
  with_table_name,
  having_clauses = [],
  row_axes = [],
  data_view_options = {}
}) => {
  const { seas_type } = get_play_by_play_default_params({ params })

  // Scoring format should be processed by parameter processor before reaching this point
  const scoring_format = await get_scoring_format(params.scoring_format_id)

  // Determine if we need position data based on scoring format (must be before other processing)
  const requires_position_data = needs_position_data(scoring_format)

  // Only include essential columns to reduce data transfer
  const base_columns = new Set(['seas_type', 'year', 'week'])

  // Columns that should be in the final output (grouping columns)
  // Start with just seas_type, add row_axes as needed
  const output_columns = new Set(['seas_type'])

  // Only add year to output if year row_axes are active
  if (row_axes.includes('year')) {
    output_columns.add('year')
  }

  // Only add week to output if week row_axes are active
  if (row_axes.includes('week')) {
    output_columns.add('week')
  }

  for (const param_name of Object.keys(params)) {
    if (param_name === 'career_year') {
      base_columns.add('year')
    } else if (param_name === 'career_game') {
      base_columns.add('esbid')
    } else if (
      nfl_plays_column_params[param_name] &&
      param_name !== 'year_offset'
    ) {
      base_columns.add(param_name)
      // Only add to output_columns if it's actually needed for grouping
      // Most params are just filters and shouldn't be in the final output
    }
  }

  // Build column list for SELECT and GROUP BY (only output columns)
  const output_columns_list = Array.from(output_columns)

  // Generate specific scoring SQL for each player type
  // Each type only calculates the stats relevant to their role
  const bc_scoring = await generate_rushing_scoring_sql(scoring_format)
  const psr_scoring = await generate_passing_scoring_sql(scoring_format)
  const trg_scoring = await generate_receiving_scoring_sql(
    scoring_format,
    requires_position_data
  )
  // Mirrors the role-union path: a format that scores a stat-sourced role at
  // zero emits no subquery for it, so its SQL is unchanged.
  const stat_sourced_roles = await resolve_stat_sourced_roles(scoring_format)
  const scores_fumbles_lost = stat_sourced_roles.some(
    ({ name }) => name === 'fumble_lost'
  )

  // Apply parameter-based filters to each union query using proper query builder
  const filtered_params = { ...params, seas_type }
  delete filtered_params.career_year
  delete filtered_params.career_game

  // These roles' plays carry NONE of the four pid columns below, so the pid
  // predicate has to be widened by an EXISTS or they find nothing. A punt or
  // kickoff return is not a rush, pass, target or fumble, and nfl_plays names
  // no returner. Measured against production: only 4 of the 732 valid return-TD
  // stat rows satisfy the pid predicate.
  //
  // A two point conversion reads like it should be exempt -- it IS a rush, a
  // pass or a reception -- and it is not: only 2 of its 2,221 valid stat rows
  // satisfy the same predicate, because nfl_plays does not name the converting
  // player on a conversion attempt. Assuming otherwise would have produced a
  // role that is correct, joins correctly, and returns nothing.
  //
  // The EXISTS is emitted only when a role is actually scored, so a format
  // scoring these at zero gets byte-identical SQL to before.
  const stat_sourced_gate_stat_ids = stat_sourced_roles.flatMap(
    ({ gate_stat_ids }) => gate_stat_ids || []
  )

  // Create shared CTE with basic filtering
  const filtered_plays_cte = db('nfl_plays')
    .whereNotIn('nfl_plays.play_type', ['NOPL'])
    // Only filter for plays that have at least one relevant player
    .where(function () {
      this.whereNotNull('nfl_plays.ball_carrier_pid')
        .orWhereNotNull('nfl_plays.passer_pid')
        .orWhereNotNull('nfl_plays.target_pid')
        .orWhereNotNull('nfl_plays.player_fuml_pid')
      if (stat_sourced_gate_stat_ids.length) {
        this.orWhereExists(function () {
          this.select(db.raw('1'))
            .from('nfl_play_stats as return_td_gate')
            .whereRaw('"return_td_gate"."esbid" = "nfl_plays"."esbid"')
            .whereRaw('"return_td_gate"."play_id" = "nfl_plays"."play_id"')
            .whereIn('return_td_gate.stat_id', stat_sourced_gate_stat_ids)
            .where('return_td_gate.is_valid', true)
        })
      }
    })

  // Select only the columns we need to reduce data transfer
  const select_columns = [
    'nfl_plays.ball_carrier_pid',
    'nfl_plays.passer_pid',
    'nfl_plays.target_pid',
    'nfl_plays.week',
    // Grain axis (year/seas_type) stays stable in the row-axis vocabulary;
    // alias the renamed physical columns back so downstream code (group-by,
    // output_columns, the career_year join) keeps reading 'year'/'seas_type'.
    'nfl_plays.season_type as seas_type',
    'nfl_plays.season_year as year',
    'nfl_plays.rush_yds',
    'nfl_plays.is_rushing_touchdown',
    'nfl_plays.pass_yds',
    'nfl_plays.is_passing_touchdown',
    'nfl_plays.recv_yds',
    'nfl_plays.is_completion',
    'nfl_plays.is_interception',
    'nfl_plays.is_first_down',
    'nfl_plays.play_type'
  ]

  // Add additional columns needed for params (week and seas_type already included above)
  if (params.career_game) {
    select_columns.push('nfl_plays.esbid')
  }

  // The fumble-lost role falls back to nfl_plays.player_fuml_pid for stat rows
  // carrying no external id, so the CTE has to carry that column too.
  if (scores_fumbles_lost) {
    select_columns.push('nfl_plays.player_fuml_pid')
  }

  // Every stat-sourced subquery joins nfl_play_stats on (esbid, play_id), so
  // the CTE has to carry both whenever any such role is scored.
  if (stat_sourced_roles.length) {
    if (!select_columns.includes('nfl_plays.esbid')) {
      select_columns.push('nfl_plays.esbid')
    }
    select_columns.push('nfl_plays.play_id')
  }

  // Add any other param-based columns
  for (const param_name of Object.keys(params)) {
    if (
      nfl_plays_column_params[param_name] &&
      param_name !== 'year_offset' &&
      param_name !== 'career_year' &&
      param_name !== 'career_game' &&
      !select_columns.includes(`nfl_plays.${param_name}`)
    ) {
      select_columns.push(`nfl_plays.${param_name}`)
    }
  }

  // Conditionally add position joins and select appropriate columns
  if (requires_position_data) {
    filtered_plays_cte
      .select([...select_columns, 'p_trg.primary_position as trg_pos'])
      .leftJoin('player as p_trg', function () {
        this.on('nfl_plays.target_pid', 'p_trg.pid')
        // Only join for positions that can have different scoring
        this.andOnIn('p_trg.primary_position', ['RB', 'WR', 'TE', 'FB'])
      })
  } else {
    filtered_plays_cte.select(select_columns)
  }

  // Apply parameter filters once to the CTE
  apply_play_by_play_column_params_to_query({
    query: filtered_plays_cte,
    params: filtered_params,
    table_name: 'nfl_plays',
    query_context: data_view_options.query_context
  })

  // Skip when scope has been emitted: apply_play_by_play_column_params_to_query
  // (with query_context) already pushes nfl_plays.season_year via apply_scope_to_query.
  const view_scope_emitted =
    data_view_options.query_context &&
    data_view_options.query_context.nfl_week_ids &&
    data_view_options.query_context.nfl_week_ids.length
  if (!params.nfl_week_id && !view_scope_emitted) {
    const effective_years = get_effective_years({ params, data_view_options })
    if (effective_years.length) {
      filtered_plays_cte.whereIn('nfl_plays.season_year', effective_years)
    }
  }

  // Create the final UNION query using the pre-filtered CTE
  // Determine which columns to include in subqueries based on parameters
  const subquery_output_columns = [...output_columns]

  // If we have career parameters, include the necessary columns in subqueries
  if (params.career_year) {
    subquery_output_columns.push('year')
  }
  if (params.career_game) {
    subquery_output_columns.push('esbid')
  }

  const subquery_output_columns_list = Array.from(
    new Set(subquery_output_columns)
  )

  // Build individual union subqueries with conditional position grouping
  const bc_group_by = ['ball_carrier_pid', ...subquery_output_columns_list]
  const psr_group_by = ['passer_pid', ...subquery_output_columns_list]
  const trg_group_by = ['target_pid', ...subquery_output_columns_list]

  // Only add position columns to GROUP BY if position data is available
  if (requires_position_data) {
    trg_group_by.push('trg_pos') // Only trg queries use position data
  }

  const bc_subquery = db
    .select(
      'ball_carrier_pid as pid',
      db.raw(`${bc_scoring} as fantasy_points_from_plays`),
      ...subquery_output_columns_list
    )
    .from('filtered_plays')
    .whereNotNull('ball_carrier_pid')
    .groupBy(bc_group_by)

  const psr_subquery = db
    .select(
      'passer_pid as pid',
      db.raw(`${psr_scoring} as fantasy_points_from_plays`),
      ...subquery_output_columns_list
    )
    .from('filtered_plays')
    .whereNotNull('passer_pid')
    .groupBy(psr_group_by)

  const trg_subquery = db
    .select(
      'target_pid as pid',
      db.raw(`${trg_scoring} as fantasy_points_from_plays`),
      ...subquery_output_columns_list
    )
    .from('filtered_plays')
    .whereNotNull('target_pid')
    .groupBy(trg_group_by)

  // Both fumble roles take their pid from nfl_play_stats rather than from a
  // column on nfl_plays -- see nfl-play-stats-attribution.mjs. Columns are
  // qualified because the joined nfl_play_stats shares esbid / play_id with the
  // CTE.
  const play_stats_columns = subquery_output_columns_list.map(
    (col) => `filtered_plays.${col}`
  )
  const build_play_stats_subquery = ({ attribution, scoring }) => {
    const pid_expr = attribution.pid_expr({ plays_table: 'filtered_plays' })
    const subquery = db
      .select(
        db.raw(`${pid_expr} as pid`),
        db.raw(`${scoring} as fantasy_points_from_plays`),
        ...play_stats_columns
      )
      .from('filtered_plays')
    attribution.apply_joins({ query: subquery, plays_table: 'filtered_plays' })
    return subquery
      .whereRaw(`${pid_expr} IS NOT NULL`)
      .groupBy([db.raw(pid_expr), ...play_stats_columns])
  }

  // One UNION arm per scored stat-sourced role, in STAT_SOURCED_ROLES order.
  // The legacy path wraps each expression in its own ROUND(SUM(...)) because it
  // aggregates inside the arm; the role-union path does not, which is why the
  // two consume different members of the same scoring object.
  const stat_sourced_arms = await Promise.all(
    stat_sourced_roles.map(
      async ({ attribution, scoring, subquery_alias }) => ({
        subquery_alias,
        subquery: build_play_stats_subquery({
          attribution,
          scoring: await scoring.sql(scoring_format)
        })
      })
    )
  )

  // Combine with UNION ALL
  // Use subquery_output_columns_list if we have career parameters, otherwise use output_columns_list
  const union_columns_list =
    params.career_year || params.career_game
      ? subquery_output_columns_list
      : output_columns_list

  let union_query = db
    .with('filtered_plays', filtered_plays_cte)
    .select(
      'pid',
      db.raw('SUM(fantasy_points_from_plays) as fantasy_points_from_plays'),
      ...union_columns_list
    )
    .from(function () {
      this.select('*')
        .from(bc_subquery.as('bc_stats'))
        .unionAll(function () {
          this.select('*').from(psr_subquery.as('psr_stats'))
        })
        .unionAll(function () {
          this.select('*').from(trg_subquery.as('trg_stats'))
        })
        .modify((builder) => {
          for (const { subquery, subquery_alias } of stat_sourced_arms) {
            builder.unionAll(function () {
              this.select('*').from(subquery.as(subquery_alias))
            })
          }
        })
        .as('combined_stats')
    })
    .groupBy('pid', ...union_columns_list)
    .havingRaw('SUM(fantasy_points_from_plays) > 0')

  // Handle career_year and career_game parameters
  if (params.career_year || params.career_game) {
    // Select columns should use the original output_columns (without year/esbid)
    const select_columns = [
      'fantasy_points_plays.pid',
      db.raw(
        'SUM(fantasy_points_plays.fantasy_points_from_plays) as fantasy_points_from_plays'
      ),
      ...output_columns_list.map((col) => `fantasy_points_plays.${col}`)
    ]

    const group_by_columns = [
      'fantasy_points_plays.pid',
      ...output_columns_list.map((col) => `fantasy_points_plays.${col}`)
    ]

    let filtered_query = db
      .select(select_columns)
      .from(union_query.as('fantasy_points_plays'))

    // Add joins based on which parameters are present
    if (params.career_year) {
      filtered_query = filtered_query.join('player_seasonlogs', function () {
        this.on('fantasy_points_plays.pid', '=', 'player_seasonlogs.pid')
          .andOn(
            'fantasy_points_plays.year',
            '=',
            'player_seasonlogs.season_year'
          )
          .andOn(
            'fantasy_points_plays.seas_type',
            '=',
            'player_seasonlogs.season_type'
          )
      })
      filtered_query = filtered_query.whereBetween(
        'player_seasonlogs.career_year',
        [
          Math.min(params.career_year[0], params.career_year[1]),
          Math.max(params.career_year[0], params.career_year[1])
        ]
      )
    }

    if (params.career_game) {
      filtered_query = filtered_query.join('player_gamelogs', function () {
        this.on('fantasy_points_plays.pid', '=', 'player_gamelogs.pid').andOn(
          'fantasy_points_plays.esbid',
          '=',
          'player_gamelogs.esbid'
        )
      })
      filtered_query = filtered_query.whereBetween(
        'player_gamelogs.career_game',
        [
          Math.min(params.career_game[0], params.career_game[1]),
          Math.max(params.career_game[0], params.career_game[1])
        ]
      )
    }

    union_query = filtered_query.groupBy(group_by_columns)
  }

  // MATERIALIZED required: predicates are pushed at construction time; planner
  // predicate push-into-CTE is not needed and would let the planner inline the
  // CTE into a nested-loop that re-executes it per outer row.
  query.withMaterialized(with_table_name, union_query)
}

// Per-row passing scoring inner expression (no SUM / ROUND wrapper).
const generate_passing_scoring_inner = async (scoring_format) => {
  if (!scoring_format) {
    scoring_format = await get_scoring_format(DEFAULT_SCORING_FORMAT_ID)
    if (!scoring_format) {
      return 'COALESCE(pass_yds, 0) * 0.04 + COALESCE(is_passing_touchdown::int, 0) * 4 + COALESCE("is_interception"::int, 0) * -1'
    }
  }

  const py = scoring_format.passing_yards || 0
  const ptd = scoring_format.passing_touchdowns || 0
  const ints = scoring_format.passing_interceptions || 0

  return `COALESCE(pass_yds, 0) * ${py} + COALESCE(is_passing_touchdown::int, 0) * ${ptd} + COALESCE("is_interception"::int, 0) * ${ints}`
}

const generate_passing_scoring_sql = async (scoring_format) =>
  `ROUND(SUM(${await generate_passing_scoring_inner(scoring_format)}), 2)`

const generate_rushing_scoring_inner = async (scoring_format) => {
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

const generate_rushing_scoring_sql = async (scoring_format) =>
  `ROUND(SUM(${await generate_rushing_scoring_inner(scoring_format)}), 2)`

const generate_receiving_scoring_inner = async (
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

const generate_receiving_scoring_sql = async (
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

    const yards = `"${FIELD_GOAL_STATS_ALIAS}"."yards"`
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
// expression reads its `yards`). Postgres resolves the two by nesting, but an
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
const resolve_stat_sourced_roles = async (scoring_format) => {
  const resolved = await Promise.all(
    STAT_SOURCED_ROLES.map(async (role) => ({
      ...role,
      ...(await role.scoring.resolve(scoring_format))
    }))
  )
  return resolved.filter(({ scores }) => scores)
}

const should_use_main_where = ({ params }) => {
  // Equal-endpoint offsets ([k,k]) are a single-year shift, not a range: the
  // CTE stays collapsed and the source join correlates the single year, so the
  // main SELECT reads the plain per-season value. Only a genuine multi-year
  // range (is_year_offset_range) re-sums across CTE year rows here.
  return is_year_offset_range(params)
}

// Build the role-union role_attributions for fantasy points. Each role
// emits the per-play scoring expression (no SUM/ROUND wrapper -- the
// aggregator's SUM wraps it). Position-aware receiving
// (running_back_reception/wide_receiver_reception/tight_end_reception)
// is intentionally NOT enabled here: it requires a leftJoin on `player`
// inside the role_union inner sub, which the build_period_cte role_union
// path does not yet support. All three production scoring_format_ides
// in baseline.json have uniform `receptions` values, so this is parity-safe.
// SFB formats (sfb15_sleeper/sfb15_mfl) would diverge -- track as a follow-up.
const fantasy_points_role_attributions = async ({ params }) => {
  const scoring_format = await get_scoring_format(params.scoring_format_id)
  const rushing_inner = await generate_rushing_scoring_inner(scoring_format)
  const passing_inner = await generate_passing_scoring_inner(scoring_format)
  const receiving_inner = await generate_receiving_scoring_inner(
    scoring_format,
    false
  )
  const stat_sourced_roles = await resolve_stat_sourced_roles(scoring_format)

  return [
    { pid_column: 'ball_carrier_pid', measure_expr: rushing_inner },
    { pid_column: 'passer_pid', measure_expr: passing_inner },
    { pid_column: 'target_pid', measure_expr: receiving_inner },
    ...stat_sourced_roles.map(({ attribution, expression }) => ({
      pid_expr: attribution.pid_expr,
      apply_joins: attribution.apply_joins,
      measure_expr: expression
    }))
  ]
}

// Apply the same param-driven filters that the legacy `with` builder
// applies to its filtered_plays CTE. Runs once per inner role sub in
// build_period_cte's role_union path. Spread the full default-params
// (not just seas_type) so the nfl_week_id derived from params.year is
// applied -- otherwise role-union CTEs ignored params.year and scanned
// all-time plays. career_year/career_game are stripped and reinstated by
// fp_apply_career_year_filters below.
const fp_apply_filters = ({ query, params }) => {
  const default_params = get_play_by_play_default_params({ params })
  const filtered_params = { ...default_params }
  delete filtered_params.career_year
  delete filtered_params.career_game
  // Strip params consumed by the outer scoring-format path (listed in
  // consumes_params_extra) that apply_play_by_play_column_params_to_query
  // does not understand. Explicitly removing them documents that they are
  // intentionally excluded from the play-filter path.
  delete filtered_params.scoring_format_id

  query.whereNotIn('nfl_plays.play_type', ['NOPL'])
  apply_play_by_play_column_params_to_query({
    query,
    params: filtered_params,
    table_name: 'nfl_plays'
  })
}

export default {
  player_fantasy_points_from_plays: {
    with_where: ({ params }) => {
      if (should_use_main_where({ params })) {
        return null
      }
      return 'fantasy_points_from_plays'
    },
    main_where: ({ params, table_name }) => {
      if (should_use_main_where({ params })) {
        return `SUM(${table_name}.fantasy_points_from_plays)`
      }
      // Return null to use default column handling when no special aggregation needed
      return null
    },
    main_where_group_by: ({ params, table_name }) => {
      if (should_use_main_where({ params })) {
        return `${table_name}.fantasy_points_from_plays`
      }
      return null
    },
    table_alias: generate_fantasy_points_table_alias,
    column_name: 'fantasy_points_from_plays',
    with: fantasy_points_from_plays_with,
    source: plays_source,
    measure_source: 'plays_role_union',
    role_attributions: fantasy_points_role_attributions,
    apply_filters: fp_apply_filters,
    supports_output: {
      periods: FP_OUTPUT_PERIODS,
      aggregations: ['rate', 'count']
    },
    // scoring_format_id is consumed by the role-attribution computation;
    // the play-filter keys are consumed by fp_apply_filters via
    // apply_play_by_play_column_params_to_query. Both surfaces must
    // differentiate the CTE-name hash so two fantasy-points columns whose
    // per-column filter params diverge (e.g. one has qtr, one does not)
    // materialize into distinct CTEs.
    consumes_params_extra: [
      'scoring_format_id',
      ...Object.keys(nfl_plays_column_params)
    ],
    supported_rate_types: [
      'per_game',
      'per_team_half',
      'per_team_quarter',
      'per_team_play',
      'per_team_pass_play',
      'per_team_rush_play',
      'per_team_drive',
      'per_team_series',

      'per_player_rush_attempt',
      'per_player_pass_attempt',
      'per_player_target',
      'per_player_catchable_target',
      'per_player_catchable_deep_target',
      'per_player_reception',

      'per_player_play',
      'per_player_route',
      'per_player_pass_play',
      'per_player_rush_play'
    ],
    use_having: true,
    get_cache_info: get_cache_info_for_fields_from_plays
  }
}
