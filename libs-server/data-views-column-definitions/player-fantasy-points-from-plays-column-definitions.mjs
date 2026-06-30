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
  const base_rec = scoring_format.rec || 0
  return (
    (scoring_format.rbrec && scoring_format.rbrec !== base_rec) ||
    (scoring_format.wrrec && scoring_format.wrrec !== base_rec) ||
    (scoring_format.terec && scoring_format.terec !== base_rec)
  )
}

// TODO add two points conversion
// TODO add special teams touchdowns
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
  const fuml_scoring = await generate_fumble_scoring_sql(scoring_format)

  // Apply parameter-based filters to each union query using proper query builder
  const filtered_params = { ...params, seas_type }
  delete filtered_params.career_year
  delete filtered_params.career_game

  // Create shared CTE with basic filtering
  const filtered_plays_cte = db('nfl_plays')
    .whereNotIn('nfl_plays.play_type', ['NOPL'])
    // Only filter for plays that have at least one relevant player
    .where(function () {
      this.whereNotNull('nfl_plays.bc_pid')
        .orWhereNotNull('nfl_plays.psr_pid')
        .orWhereNotNull('nfl_plays.trg_pid')
        .orWhereNotNull('nfl_plays.player_fuml_pid')
    })

  // Select only the columns we need to reduce data transfer
  const select_columns = [
    'nfl_plays.bc_pid',
    'nfl_plays.psr_pid',
    'nfl_plays.trg_pid',
    'nfl_plays.player_fuml_pid',
    'nfl_plays.week',
    'nfl_plays.seas_type',
    'nfl_plays.year',
    'nfl_plays.rush_yds',
    'nfl_plays.rush_td',
    'nfl_plays.pass_yds',
    'nfl_plays.pass_td',
    'nfl_plays.recv_yds',
    'nfl_plays.comp',
    'nfl_plays.int',
    'nfl_plays.first_down',
    'nfl_plays.play_type',
    'nfl_plays.fuml'
  ]

  // Add additional columns needed for params (week and seas_type already included above)
  if (params.career_game) {
    select_columns.push('nfl_plays.esbid')
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
      .select([...select_columns, 'p_trg.pos as trg_pos'])
      .leftJoin('player as p_trg', function () {
        this.on('nfl_plays.trg_pid', 'p_trg.pid')
        // Only join for positions that can have different scoring
        this.andOnIn('p_trg.pos', ['RB', 'WR', 'TE', 'FB'])
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
  // (with query_context) already pushes nfl_plays.year via apply_scope_to_query.
  const view_scope_emitted =
    data_view_options.query_context &&
    data_view_options.query_context.nfl_week_ids &&
    data_view_options.query_context.nfl_week_ids.length
  if (!params.nfl_week_id && !view_scope_emitted) {
    const effective_years = get_effective_years({ params, data_view_options })
    if (effective_years.length) {
      filtered_plays_cte.whereIn('nfl_plays.year', effective_years)
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
  const bc_group_by = ['bc_pid', ...subquery_output_columns_list]
  const psr_group_by = ['psr_pid', ...subquery_output_columns_list]
  const trg_group_by = ['trg_pid', ...subquery_output_columns_list]
  const fuml_group_by = ['player_fuml_pid', ...subquery_output_columns_list]

  // Only add position columns to GROUP BY if position data is available
  if (requires_position_data) {
    trg_group_by.push('trg_pos') // Only trg queries use position data
  }

  const bc_subquery = db
    .select(
      'bc_pid as pid',
      db.raw(`${bc_scoring} as fantasy_points_from_plays`),
      ...subquery_output_columns_list
    )
    .from('filtered_plays')
    .whereNotNull('bc_pid')
    .groupBy(bc_group_by)

  const psr_subquery = db
    .select(
      'psr_pid as pid',
      db.raw(`${psr_scoring} as fantasy_points_from_plays`),
      ...subquery_output_columns_list
    )
    .from('filtered_plays')
    .whereNotNull('psr_pid')
    .groupBy(psr_group_by)

  const trg_subquery = db
    .select(
      'trg_pid as pid',
      db.raw(`${trg_scoring} as fantasy_points_from_plays`),
      ...subquery_output_columns_list
    )
    .from('filtered_plays')
    .whereNotNull('trg_pid')
    .groupBy(trg_group_by)

  const fuml_subquery = db
    .select(
      'player_fuml_pid as pid',
      db.raw(`${fuml_scoring} as fantasy_points_from_plays`),
      ...subquery_output_columns_list
    )
    .from('filtered_plays')
    .whereNotNull('player_fuml_pid')
    .groupBy(fuml_group_by)

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
        .unionAll(function () {
          this.select('*').from(fuml_subquery.as('fuml_stats'))
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
          .andOn('fantasy_points_plays.year', '=', 'player_seasonlogs.year')
          .andOn(
            'fantasy_points_plays.seas_type',
            '=',
            'player_seasonlogs.seas_type'
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
      return 'COALESCE(pass_yds, 0) * 0.04 + COALESCE(pass_td::int, 0) * 4 + COALESCE("int"::int, 0) * -1'
    }
  }

  const py = scoring_format.py || 0
  const ptd = scoring_format.tdp || 0
  const ints = scoring_format.ints || 0

  return `COALESCE(pass_yds, 0) * ${py} + COALESCE(pass_td::int, 0) * ${ptd} + COALESCE("int"::int, 0) * ${ints}`
}

const generate_passing_scoring_sql = async (scoring_format) =>
  `ROUND(SUM(${await generate_passing_scoring_inner(scoring_format)}), 2)`

const generate_rushing_scoring_inner = async (scoring_format) => {
  if (!scoring_format) {
    scoring_format = await get_scoring_format(DEFAULT_SCORING_FORMAT_ID)
    if (!scoring_format) {
      return 'COALESCE(rush_yds, 0) * 0.1 + COALESCE(rush_td::int, 0) * 6'
    }
  }

  const ry = scoring_format.ry || 0
  const rtd = scoring_format.tdr || 0
  const rufd = scoring_format.rush_first_down || 0
  const ra = scoring_format.ra || 0

  let sql = `COALESCE(rush_yds, 0) * ${ry} + COALESCE(rush_td::int, 0) * ${rtd}`

  if (ra) {
    sql += ` + ${ra}`
  }

  if (rufd) {
    const is_sleeper_sfb =
      scoring_format &&
      scoring_format.scoring_format_id ===
        'ed9c2daa0f00d9389f450b577c16fb0864fa22c6e261c0161db5f2da54457286'
    if (is_sleeper_sfb) {
      sql += ` + (CASE WHEN first_down = true AND play_type = 'RUSH' AND COALESCE(rush_td::int, 0) = 0 THEN ${rufd} ELSE 0 END)`
    } else {
      sql += ` + (CASE WHEN first_down = true AND play_type = 'RUSH' THEN ${rufd} ELSE 0 END)`
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
      return 'COALESCE(comp::int, 0) * 1 + COALESCE(recv_yds, 0) * 0.1 + COALESCE(pass_td::int, 0) * 6'
    }
  }

  const recy = scoring_format.recy || 0
  const rctd = scoring_format.tdrec || 0
  const rec = scoring_format.rec || 0
  const rbrec = scoring_format.rbrec || 0
  const wrrec = scoring_format.wrrec || 0
  const terec = scoring_format.terec || 0
  const trg = scoring_format.trg || 0
  const recfd = scoring_format.rec_first_down || 0

  let sql = `COALESCE(recv_yds, 0) * ${recy} + COALESCE(pass_td::int, 0) * ${rctd}`

  if (has_position_data && (rbrec !== rec || wrrec !== rec || terec !== rec)) {
    sql += ` + CASE WHEN comp = true THEN CASE trg_pos WHEN 'RB' THEN ${rbrec} WHEN 'WR' THEN ${wrrec} WHEN 'TE' THEN ${terec} ELSE ${rec} END ELSE 0 END`
  } else {
    sql += ` + COALESCE(comp::int, 0) * ${rec}`
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
      sql += ` + (CASE WHEN first_down = true AND play_type = 'PASS' AND COALESCE(pass_td::int, 0) = 0 THEN ${recfd} ELSE 0 END)`
    } else {
      sql += ` + (CASE WHEN first_down = true AND play_type = 'PASS' THEN ${recfd} ELSE 0 END)`
    }
  }

  return sql
}

const generate_receiving_scoring_sql = async (
  scoring_format,
  has_position_data = false
) =>
  `ROUND(SUM(${await generate_receiving_scoring_inner(scoring_format, has_position_data)}), 2)`

// NOTE: only handles fumble lost penalties (fuml). Fum return TDs are credited
// to the recoverer (different pid) and would require joining nfl_play_stats.
const generate_fumble_scoring_inner = async (scoring_format) => {
  if (!scoring_format) {
    scoring_format = await get_scoring_format(DEFAULT_SCORING_FORMAT_ID)
    if (!scoring_format) {
      return '-1'
    }
  }

  const fuml = scoring_format.fuml || 0
  return String(fuml)
}

const generate_fumble_scoring_sql = async (scoring_format) =>
  `ROUND(SUM(${await generate_fumble_scoring_inner(scoring_format)}), 2)`

const should_use_main_where = ({ params }) => {
  return (
    params.year_offset &&
    Array.isArray(params.year_offset) &&
    params.year_offset.length > 1
  )
}

// Build the role-union role_attributions for fantasy points. Each role
// emits the per-play scoring expression (no SUM/ROUND wrapper -- the
// aggregator's SUM wraps it). Position-aware receiving (rbrec/wrrec/terec)
// is intentionally NOT enabled here: it requires a leftJoin on `player`
// inside the role_union inner sub, which the build_period_cte role_union
// path does not yet support. All three production scoring_format_ides
// in baseline.json have uniform `rec` values, so this is parity-safe.
// SFB formats (sfb15_sleeper/sfb15_mfl) would diverge -- track as a follow-up.
const fp_role_attributions = async ({ params }) => {
  const scoring_format = await get_scoring_format(params.scoring_format_id)
  const rushing_inner = await generate_rushing_scoring_inner(scoring_format)
  const passing_inner = await generate_passing_scoring_inner(scoring_format)
  const receiving_inner = await generate_receiving_scoring_inner(
    scoring_format,
    false
  )
  const fumble_inner = await generate_fumble_scoring_inner(scoring_format)
  return [
    { pid_column: 'bc_pid', measure_expr: rushing_inner },
    { pid_column: 'psr_pid', measure_expr: passing_inner },
    { pid_column: 'trg_pid', measure_expr: receiving_inner },
    { pid_column: 'player_fuml_pid', measure_expr: fumble_inner }
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
    role_attributions: fp_role_attributions,
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
