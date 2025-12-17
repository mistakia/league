import db from '#db'
import {
  nfl_plays_column_params,
  DEFAULT_SCORING_FORMAT_HASH
} from '#libs-shared'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import apply_play_by_play_column_params_to_query from '../apply-play-by-play-column-params-to-query.mjs'
import data_view_join_function from '#libs-server/data-views/data-view-join-function.mjs'
import { get_rate_type_sql } from '#libs-server/data-views/select-string.mjs'
import { get_cache_info_for_fields_from_plays } from '#libs-server/data-views/get-cache-info-for-fields-from-plays.mjs'
import get_play_by_play_default_params from '#libs-server/data-views/get-play-by-play-default-params.mjs'

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

// Get scoring format from database if scoring_format_hash is provided
const get_scoring_format = async (scoring_format_hash) => {
  if (!scoring_format_hash) {
    return null
  }

  // Handle array format (take first element)
  const hash = Array.isArray(scoring_format_hash)
    ? scoring_format_hash[0]
    : scoring_format_hash

  if (!hash) {
    return null
  }

  const format = await db('league_scoring_formats')
    .where('scoring_format_hash', hash)
    .first()

  if (!format) {
    // In test environment, fallback to default scoring instead of throwing error
    if (process.env.NODE_ENV === 'test') {
      console.warn(
        `Scoring format not found for hash: ${hash}. Falling back to default scoring.`
      )
      return null
    }
    throw new Error(
      `Scoring format not found for hash: ${hash}. Please ensure the scoring format exists in the database.`
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
  splits = []
}) => {
  const { seas_type } = get_play_by_play_default_params({ params })

  // Scoring format should be processed by parameter processor before reaching this point
  const scoring_format = await get_scoring_format(params.scoring_format_hash)

  // Determine if we need position data based on scoring format (must be before other processing)
  const requires_position_data = needs_position_data(scoring_format)

  // Only include essential columns to reduce data transfer
  const base_columns = new Set(['seas_type', 'year', 'week'])

  // Columns that should be in the final output (grouping columns)
  // Start with just seas_type, add splits as needed
  const output_columns = new Set(['seas_type'])

  // Only add year to output if year splits are active
  if (splits.includes('year')) {
    output_columns.add('year')
  }

  // Only add week to output if week splits are active
  if (splits.includes('week')) {
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
    table_name: 'nfl_plays'
  })

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

  query.with(with_table_name, union_query)
}

// Generate passing scoring SQL
const generate_passing_scoring_sql = async (scoring_format) => {
  if (!scoring_format) {
    scoring_format = await get_scoring_format(DEFAULT_SCORING_FORMAT_HASH)
    if (!scoring_format) {
      // Default passing scoring: 0.04 points per yard, 4 points per TD, -1 point per interception
      return 'ROUND(SUM(COALESCE(pass_yds, 0) * 0.04 + COALESCE(pass_td::int, 0) * 4 + COALESCE("int"::int, 0) * -1), 2)'
    }
  }

  const py = scoring_format.py || 0
  const ptd = scoring_format.tdp || 0
  const ints = scoring_format.ints || 0

  return `ROUND(SUM(COALESCE(pass_yds, 0) * ${py} + COALESCE(pass_td::int, 0) * ${ptd} + COALESCE("int"::int, 0) * ${ints}), 2)`
}

// Generate rushing scoring SQL
const generate_rushing_scoring_sql = async (scoring_format) => {
  if (!scoring_format) {
    scoring_format = await get_scoring_format(DEFAULT_SCORING_FORMAT_HASH)
    if (!scoring_format) {
      // Default rushing scoring: 0.1 points per yard, 6 points per TD
      return 'ROUND(SUM(COALESCE(rush_yds, 0) * 0.1 + COALESCE(rush_td::int, 0) * 6), 2)'
    }
  }

  const ry = scoring_format.ry || 0
  const rtd = scoring_format.tdr || 0
  const rufd = scoring_format.rush_first_down || 0
  const ra = scoring_format.ra || 0

  let sql = `COALESCE(rush_yds, 0) * ${ry} + COALESCE(rush_td::int, 0) * ${rtd}`

  // Add points per rush attempt
  if (ra) {
    sql += ` + ${ra}`
  }

  if (rufd) {
    // For Sleeper Scott Fish Bowl, exclude touchdown plays from first down calculation
    const is_sleeper_sfb =
      scoring_format &&
      scoring_format.scoring_format_hash ===
        'ed9c2daa0f00d9389f450b577c16fb0864fa22c6e261c0161db5f2da54457286'
    if (is_sleeper_sfb) {
      sql += ` + (CASE WHEN first_down = true AND play_type = 'RUSH' AND COALESCE(rush_td::int, 0) = 0 THEN ${rufd} ELSE 0 END)`
    } else {
      sql += ` + (CASE WHEN first_down = true AND play_type = 'RUSH' THEN ${rufd} ELSE 0 END)`
    }
  }

  return `ROUND(SUM(${sql}), 2)`
}

// Generate receiving scoring SQL
const generate_receiving_scoring_sql = async (
  scoring_format,
  has_position_data = false
) => {
  if (!scoring_format) {
    scoring_format = await get_scoring_format(DEFAULT_SCORING_FORMAT_HASH)
    if (!scoring_format) {
      // Default receiving scoring: 1 point per reception (full PPR), 0.1 points per yard, 6 points per TD
      return 'ROUND(SUM(COALESCE(comp::int, 0) * 1 + COALESCE(recv_yds, 0) * 0.1 + COALESCE(pass_td::int, 0) * 6), 2)'
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

  // Handle reception points based on position data availability
  if (has_position_data && (rbrec !== rec || wrrec !== rec || terec !== rec)) {
    // Position-specific reception scoring
    sql += ` + CASE WHEN comp = true THEN CASE trg_pos WHEN 'RB' THEN ${rbrec} WHEN 'WR' THEN ${wrrec} WHEN 'TE' THEN ${terec} ELSE ${rec} END ELSE 0 END`
  } else {
    // Standard reception scoring
    sql += ` + COALESCE(comp::int, 0) * ${rec}`
  }

  // Add target points if applicable
  if (trg) {
    sql += ` + ${trg}`
  }

  // Add receiving first down points
  if (recfd) {
    // For Sleeper Scott Fish Bowl, exclude touchdown plays from first down calculation
    const is_sleeper_sfb =
      scoring_format &&
      scoring_format.scoring_format_hash ===
        'ed9c2daa0f00d9389f450b577c16fb0864fa22c6e261c0161db5f2da54457286'
    if (is_sleeper_sfb) {
      sql += ` + (CASE WHEN first_down = true AND play_type = 'PASS' AND COALESCE(pass_td::int, 0) = 0 THEN ${recfd} ELSE 0 END)`
    } else {
      sql += ` + (CASE WHEN first_down = true AND play_type = 'PASS' THEN ${recfd} ELSE 0 END)`
    }
  }

  return `ROUND(SUM(${sql}), 2)`
}

// Generate fumble scoring SQL
// NOTE: This currently only handles fumble lost penalties (fuml).
// Fumble return TDs (fum_ret_td) are credited to a different player (the recoverer)
// and would require joining with nfl_play_stats to identify statId 56/58/60/62.
// For now, fum_ret_td scoring is handled via gamelogs (calculate-stats-from-play-stats.mjs).
// TODO: Add fumble return TD support by joining with play_stats for statId 56/58/60/62
const generate_fumble_scoring_sql = async (scoring_format) => {
  if (!scoring_format) {
    scoring_format = await get_scoring_format(DEFAULT_SCORING_FORMAT_HASH)
    if (!scoring_format) {
      // Default fumble scoring: -1 point per fumble (turnover penalty)
      return 'ROUND(SUM(-1), 2)'
    }
  }

  const fuml = scoring_format.fuml || 0
  // fum_ret_td scoring requires play_stats join - not yet implemented for data views
  // const fum_ret_td = scoring_format.fum_ret_td || 0
  return `ROUND(SUM(${fuml}), 2)`
}

const should_use_main_where = ({ params }) => {
  return (
    (params.year_offset &&
      Array.isArray(params.year_offset) &&
      params.year_offset.length > 1) ||
    (params.rate_type && params.rate_type.length > 0)
  )
}

export default {
  player_fantasy_points_from_plays: {
    with_where: ({ params }) => {
      if (should_use_main_where({ params })) {
        return null
      }
      return 'fantasy_points_from_plays'
    },
    main_where: ({
      params,
      table_name,
      column_id,
      column_index,
      rate_type_column_mapping
    }) => {
      if (should_use_main_where({ params })) {
        if (params.rate_type && params.rate_type.includes('per_game')) {
          const rate_type_table_name =
            rate_type_column_mapping[`${column_id}_${column_index}`]
          return get_rate_type_sql({
            table_name,
            column_name: 'fantasy_points_from_plays',
            rate_type_table_name
          })
        }
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
    join: data_view_join_function,
    supported_splits: ['year', 'week'],
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
