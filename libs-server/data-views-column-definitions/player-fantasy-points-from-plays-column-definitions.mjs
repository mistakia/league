import db from '#db'
import { nfl_plays_column_params } from '#libs-shared'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import apply_play_by_play_column_params_to_query from '#libs-server/apply-play-by-play-column-params-to-query.mjs'
import { apply_plays_join } from '#libs-server/data-views/source-attach/apply-plays-join.mjs'
import { get_cache_info_for_fields_from_plays } from '#libs-server/data-views/get-cache-info-for-fields-from-plays.mjs'
import get_play_by_play_default_params from '#libs-server/data-views/get-play-by-play-default-params.mjs'
import get_effective_years from '#libs-server/data-views/get-effective-years.mjs'
import { is_year_offset_range } from '#libs-server/data-views/year-offset-range.mjs'
import {
  get_scoring_format,
  generate_passing_scoring_inner,
  generate_passing_scoring_sql,
  generate_rushing_scoring_inner,
  generate_rushing_scoring_sql,
  generate_receiving_scoring_inner,
  generate_receiving_scoring_sql,
  needs_position_data,
  receiving_position_attribution,
  resolve_stat_sourced_roles
} from '#libs-server/data-views/fantasy-points-scoring-expressions.mjs'

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

const should_use_main_where = ({ params }) => {
  // Equal-endpoint offsets ([k,k]) are a single-year shift, not a range: the
  // CTE stays collapsed and the source join correlates the single year, so the
  // main SELECT reads the plain per-season value. Only a genuine multi-year
  // range (is_year_offset_range) re-sums across CTE year rows here.
  return is_year_offset_range(params)
}

// Build the role-union role_attributions for fantasy points. Each role
// emits the per-play scoring expression (no SUM/ROUND wrapper -- the
// aggregator's SUM wraps it).
//
// Position-aware receiving is gated on the same `needs_position_data` predicate
// as the legacy `with` builder, so the two paths agree on whether the positional
// CASE applies. Five production formats need it -- sfb15_mfl and sfb15_sleeper
// among them -- and this path scored all five as if every reception were worth
// the base value until the join was wired.
const fantasy_points_role_attributions = async ({ params }) => {
  const scoring_format = await get_scoring_format(params.scoring_format_id)
  const requires_position_data = needs_position_data(scoring_format)
  const rushing_inner = await generate_rushing_scoring_inner(scoring_format)
  const passing_inner = await generate_passing_scoring_inner(scoring_format)
  const receiving_inner = await generate_receiving_scoring_inner(
    scoring_format,
    requires_position_data,
    receiving_position_attribution.position_column
  )
  const stat_sourced_roles = await resolve_stat_sourced_roles(scoring_format)

  return [
    { pid_column: 'ball_carrier_pid', measure_expr: rushing_inner },
    { pid_column: 'passer_pid', measure_expr: passing_inner },
    {
      pid_column: 'target_pid',
      measure_expr: receiving_inner,
      // Emitted only when the format needs it, so a uniform-reception format
      // pays for no join and its SQL is unchanged.
      ...(requires_position_data
        ? { apply_joins: receiving_position_attribution.apply_joins }
        : {})
    },
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
    use_having: true,
    get_cache_info: get_cache_info_for_fields_from_plays
  }
}
