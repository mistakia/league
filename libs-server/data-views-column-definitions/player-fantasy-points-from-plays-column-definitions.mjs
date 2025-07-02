import db from '#db'
import { nfl_plays_column_params } from '#libs-shared'
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

// Optimized default hardcoded scoring for backward compatibility (half PPR)
// Simplified since UNION approach ensures proper player role separation
const default_select_string = `ROUND(SUM(
  CASE 
    -- Reception scoring (0.5 PPR)
    WHEN trg_pid = COALESCE(bc_pid, psr_pid, trg_pid, player_fuml_pid) AND comp = true THEN 
      0.5 + COALESCE(recv_yds, 0) * 0.1 + CASE WHEN pass_td = true THEN 6 ELSE 0 END
    -- Rushing scoring  
    WHEN bc_pid = COALESCE(bc_pid, psr_pid, trg_pid, player_fuml_pid) THEN
      COALESCE(rush_yds, 0) * 0.1 + CASE WHEN rush_td = true THEN 6 ELSE 0 END
    -- Passing scoring
    WHEN psr_pid = COALESCE(bc_pid, psr_pid, trg_pid, player_fuml_pid) THEN
      COALESCE(pass_yds, 0) * 0.04 + CASE WHEN pass_td = true THEN 4 WHEN int = true THEN -1 ELSE 0 END
    -- Fumble scoring
    WHEN player_fuml_pid = COALESCE(bc_pid, psr_pid, trg_pid, player_fuml_pid) THEN -1
    ELSE 0 
  END
), 2)`

// Generate dynamic scoring SQL based on scoring format
const generate_scoring_sql = (scoring_format) => {
  if (!scoring_format) {
    return default_select_string
  }

  const cases = []

  // Passing yards - only count when psr_pid matches the COALESCE result
  if (scoring_format.py) {
    cases.push(
      `CASE WHEN psr_pid = COALESCE(bc_pid, psr_pid, trg_pid, player_fuml_pid) THEN COALESCE(pass_yds, 0) * ${scoring_format.py} ELSE 0 END`
    )
  }

  // Passing touchdowns
  if (scoring_format.tdp) {
    cases.push(
      `CASE WHEN psr_pid = COALESCE(bc_pid, psr_pid, trg_pid, player_fuml_pid) AND pass_td = true THEN ${scoring_format.tdp} ELSE 0 END`
    )
  }

  // Interceptions
  if (scoring_format.ints) {
    cases.push(
      `CASE WHEN psr_pid = COALESCE(bc_pid, psr_pid, trg_pid, player_fuml_pid) AND int = true THEN ${scoring_format.ints} ELSE 0 END`
    )
  }

  // Rushing yards - only count when bc_pid matches the COALESCE result
  if (scoring_format.ry) {
    cases.push(
      `CASE WHEN bc_pid = COALESCE(bc_pid, psr_pid, trg_pid, player_fuml_pid) THEN COALESCE(rush_yds, 0) * ${scoring_format.ry} ELSE 0 END`
    )
  }

  // Rushing touchdowns
  if (scoring_format.tdr) {
    cases.push(
      `CASE WHEN bc_pid = COALESCE(bc_pid, psr_pid, trg_pid, player_fuml_pid) AND rush_td = true THEN ${scoring_format.tdr} ELSE 0 END`
    )
  }

  // Receiving yards - simplified since each player type gets their own query
  if (scoring_format.recy) {
    cases.push(
      `CASE WHEN trg_pid = COALESCE(bc_pid, psr_pid, trg_pid, player_fuml_pid) THEN COALESCE(recv_yds, 0) * ${scoring_format.recy} ELSE 0 END`
    )
  }

  // Receiving touchdowns - simplified since each player type gets their own query
  if (scoring_format.tdrec) {
    cases.push(
      `CASE WHEN trg_pid = COALESCE(bc_pid, psr_pid, trg_pid, player_fuml_pid) AND pass_td = true THEN ${scoring_format.tdrec} ELSE 0 END`
    )
  }

  // Receptions - simplified since each player type gets their own query
  if (scoring_format.rec) {
    cases.push(
      `CASE WHEN trg_pid = COALESCE(bc_pid, psr_pid, trg_pid, player_fuml_pid) AND comp = true THEN ${scoring_format.rec} ELSE 0 END`
    )
  }

  // Position-specific reception scoring (overrides standard reception points)
  if (scoring_format.rbrec && scoring_format.rbrec !== scoring_format.rec) {
    // TODO: Need position data in the query to implement position-specific scoring
    // For now, fall back to standard reception scoring
  }

  // Targets scoring - simplified since each player type gets their own query
  if (scoring_format.trg) {
    cases.push(
      `CASE WHEN trg_pid = COALESCE(bc_pid, psr_pid, trg_pid, player_fuml_pid) THEN ${scoring_format.trg} ELSE 0 END`
    )
  }

  // Fumbles
  if (scoring_format.fuml) {
    cases.push(
      `CASE WHEN player_fuml_pid = COALESCE(bc_pid, psr_pid, trg_pid, player_fuml_pid) THEN ${scoring_format.fuml} ELSE 0 END`
    )
  }

  // Rushing first downs
  if (scoring_format.rush_first_down) {
    cases.push(
      `CASE WHEN bc_pid = COALESCE(bc_pid, psr_pid, trg_pid, player_fuml_pid) AND first_down = true AND play_type = 'RUSH' THEN ${scoring_format.rush_first_down} ELSE 0 END`
    )
  }

  // Receiving first downs - simplified since each player type gets their own query
  if (scoring_format.rec_first_down) {
    cases.push(
      `CASE WHEN trg_pid = COALESCE(bc_pid, psr_pid, trg_pid, player_fuml_pid) AND first_down = true AND play_type = 'PASS' THEN ${scoring_format.rec_first_down} ELSE 0 END`
    )
  }

  if (cases.length === 0) {
    return default_select_string
  }

  console.log({ cases })

  return `ROUND(SUM(${cases.join(' + ')}), 2)`
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

  console.log({ format, scoring_format_hash: hash })

  return format
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
  const select_string = generate_scoring_sql(scoring_format)

  // Only include essential columns to reduce data transfer
  const base_columns = new Set(['seas_type', 'year'])

  // Columns that should be in the final output (grouping columns)
  const output_columns = new Set(['seas_type', 'year'])

  if (splits.includes('week')) {
    base_columns.add('week')
    output_columns.add('week')
  }

  for (const param_name of Object.keys(params)) {
    if (param_name === 'career_year') {
      base_columns.add('year')
      output_columns.add('year')
    } else if (param_name === 'career_game') {
      base_columns.add('esbid')
      output_columns.add('esbid')
    } else if (
      nfl_plays_column_params[param_name] &&
      param_name !== 'year_offset'
    ) {
      base_columns.add(param_name)
      output_columns.add(param_name)
    }
  }

  // Build column list for SELECT and GROUP BY (only output columns)
  const output_columns_list = Array.from(output_columns)
  const select_columns_str = output_columns_list.join(', ')
  const group_by_columns_str = output_columns_list
    .map((col) => `nfl_plays.${col}`)
    .join(', ')

  // Most performant approach: UNION ALL separate queries for each player type
  const union_queries = []

  // Ball carrier query - only for rushing plays
  const bc_scoring = select_string.replace(
    /COALESCE\(bc_pid, psr_pid, trg_pid, player_fuml_pid\)/g,
    'bc_pid'
  )
  union_queries.push(`
    SELECT bc_pid as pid, ${bc_scoring} as fantasy_points_from_plays${select_columns_str ? ', ' + select_columns_str : ''}
    FROM nfl_plays 
    WHERE bc_pid IS NOT NULL 
      AND play_type NOT IN ('NOPL')
      AND (rush_yds > 0 OR rush_td = true OR player_fuml_pid IS NOT NULL)
    ${group_by_columns_str ? `GROUP BY bc_pid, ${group_by_columns_str}` : 'GROUP BY bc_pid'}
  `)

  // Passer query - only for passing plays
  const psr_scoring = select_string.replace(
    /COALESCE\(bc_pid, psr_pid, trg_pid, player_fuml_pid\)/g,
    'psr_pid'
  )
  union_queries.push(`
    SELECT psr_pid as pid, ${psr_scoring} as fantasy_points_from_plays${select_columns_str ? ', ' + select_columns_str : ''}
    FROM nfl_plays 
    WHERE psr_pid IS NOT NULL 
      AND play_type NOT IN ('NOPL')
      AND (pass_yds > 0 OR pass_td = true OR int = true OR player_fuml_pid IS NOT NULL)
    ${group_by_columns_str ? `GROUP BY psr_pid, ${group_by_columns_str}` : 'GROUP BY psr_pid'}
  `)

  // Target query - only for receiving plays
  const trg_scoring = select_string.replace(
    /COALESCE\(bc_pid, psr_pid, trg_pid, player_fuml_pid\)/g,
    'trg_pid'
  )
  union_queries.push(`
    SELECT trg_pid as pid, ${trg_scoring} as fantasy_points_from_plays${select_columns_str ? ', ' + select_columns_str : ''}
    FROM nfl_plays 
    WHERE trg_pid IS NOT NULL 
      AND play_type NOT IN ('NOPL')
      AND (recv_yds > 0 OR pass_td = true OR comp = true OR player_fuml_pid IS NOT NULL)
    ${group_by_columns_str ? `GROUP BY trg_pid, ${group_by_columns_str}` : 'GROUP BY trg_pid'}
  `)

  // Fumble query - for any player who fumbled
  const fuml_scoring = select_string.replace(
    /COALESCE\(bc_pid, psr_pid, trg_pid, player_fuml_pid\)/g,
    'player_fuml_pid'
  )
  union_queries.push(`
    SELECT player_fuml_pid as pid, ${fuml_scoring} as fantasy_points_from_plays${select_columns_str ? ', ' + select_columns_str : ''}
    FROM nfl_plays 
    WHERE player_fuml_pid IS NOT NULL 
      AND play_type NOT IN ('NOPL')
    ${group_by_columns_str ? `GROUP BY player_fuml_pid, ${group_by_columns_str}` : 'GROUP BY player_fuml_pid'}
  `)

  // Create the final UNION query with proper aggregation
  const union_sql = `
    SELECT pid, SUM(fantasy_points_from_plays) as fantasy_points_from_plays${select_columns_str ? ', ' + select_columns_str : ''}
    FROM (
      ${union_queries.join(' UNION ALL ')}
    ) combined_stats
    ${group_by_columns_str ? `GROUP BY pid, ${select_columns_str}` : 'GROUP BY pid'}
    HAVING SUM(fantasy_points_from_plays) > 0
  `

  const with_query = db.raw(union_sql)

  // Create a temporary query to build proper WHERE clauses using apply_play_by_play_column_params_to_query
  const temp_query = db('nfl_plays')

  // Apply all play-by-play parameters to get the proper WHERE conditions
  const filtered_params = { ...params, seas_type }
  delete filtered_params.career_year
  delete filtered_params.career_game

  apply_play_by_play_column_params_to_query({
    query: temp_query,
    params: filtered_params,
    table_name: 'nfl_plays'
  })

  // Extract WHERE clauses from the temporary query
  const where_conditions = temp_query
    .toSQL()
    .sql.split('WHERE')[1]
    ?.split('ORDER BY')[0]
    ?.split('GROUP BY')[0]
    ?.split('HAVING')[0]
    ?.trim()

  // Apply WHERE conditions to each UNION sub-query
  if (where_conditions) {
    for (let i = 0; i < union_queries.length; i++) {
      union_queries[i] = union_queries[i].replace(
        /WHERE (.*?)\s+GROUP BY/s,
        `WHERE $1 AND ${where_conditions} GROUP BY`
      )
    }

    // Rebuild the union_sql with updated queries
    const updated_union_sql = `
      SELECT pid, SUM(fantasy_points_from_plays) as fantasy_points_from_plays${select_columns_str ? ', ' + select_columns_str : ''}
      FROM (
        ${union_queries.join(' UNION ALL ')}
      ) combined_stats
      ${group_by_columns_str ? `GROUP BY pid, ${select_columns_str}` : 'GROUP BY pid'}
      HAVING SUM(fantasy_points_from_plays) > 0
    `

    query.with(with_table_name, db.raw(updated_union_sql))
  } else {
    query.with(with_table_name, with_query)
  }
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
      return select_string
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
