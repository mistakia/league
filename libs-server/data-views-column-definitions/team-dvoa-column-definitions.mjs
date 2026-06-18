import { current_season } from '#constants'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import { create_season_aggregate_cache_info } from '#libs-server/data-views/cache-info-utils.mjs'
import { team_year_offset_range_select } from '#libs-server/data-views/param-utils.mjs'

const get_default_params = ({ params = {} } = {}) => {
  let year = params.year || [current_season.stats_season_year]
  if (!Array.isArray(year)) {
    year = [year]
  }

  const matchup_opponent_type = Array.isArray(params.matchup_opponent_type)
    ? params.matchup_opponent_type[0]
    : params.matchup_opponent_type

  const acceptable_team_units = ['OFFENSE', 'DEFENSE', 'SPECIAL_TEAMS']
  let team_unit = params.team_unit || 'OFFENSE'

  if (Array.isArray(team_unit)) {
    team_unit = team_unit[0]
  }

  team_unit = team_unit.toUpperCase()

  if (team_unit === 'OFF') {
    team_unit = 'OFFENSE'
  } else if (team_unit === 'DEF') {
    team_unit = 'DEFENSE'
  }

  if (!acceptable_team_units.includes(team_unit)) {
    team_unit = 'OFFENSE'
  }

  const dvoa_type = Array.isArray(params.dvoa_type)
    ? params.dvoa_type[0] || 'total_dvoa'
    : params.dvoa_type || 'total_dvoa'

  return { year, team_unit, matchup_opponent_type, dvoa_type }
}

const get_cache_info = create_season_aggregate_cache_info({
  get_params: ({ params = {} } = {}) => {
    const { year } = get_default_params({ params })
    return { year, week: [] }
  }
})

const dvoa_team_unit_seasonlogs_table_alias = ({ params = {} } = {}) => {
  const { year, matchup_opponent_type, team_unit } = get_default_params({
    params
  })
  const suffix = matchup_opponent_type ? `_${matchup_opponent_type}` : ''
  return get_table_hash(
    `dvoa_team_unit_seasonlogs_${team_unit}_${year.join('_')}${suffix}`
  )
}

const dvoa_team_source = {
  table: 'dvoa_team_unit_seasonlogs_index',
  grain: 'team_year',
  key_columns: { team: 'nfl_team', year: 'year' },
  year_default: (params) => [get_default_params({ params }).year[0]],
  extra_predicates: (params) => {
    const { team_unit } = get_default_params({ params })
    return [{ column: 'team_unit', value: team_unit }]
  }
}

// DVOA, adjusted line yards, power success / stuffed rate, and second-level /
// open-field yards are all per-carry rates or percentages, not additive; a
// range year_offset must AVG across the window, not SUM (the select-string
// default). (team_unit_dvoa spreads this but renders via a custom main_select,
// so the correlated-aggregate path -- and this field -- never fires for it; the
// range-offset handling for that column is tracked with the Stage 4 join-skip
// fix.)
const create_dvoa_team_unit_field = (column_name) => ({
  column_name,
  table_name: 'dvoa_team_unit_seasonlogs_index',
  table_alias: dvoa_team_unit_seasonlogs_table_alias,
  source: dvoa_team_source,
  range_offset_aggregate: 'AVG',
  get_cache_info
})

const get_dvoa_column_name = ({ params }) => {
  const { dvoa_type } = get_default_params({ params })
  const rank_suffix = params.rank ? '_rank' : ''
  const column_name = `${dvoa_type}${rank_suffix}`
  return column_name
}

// team_unit_dvoa renders via a custom main_select because its column is
// dynamic (dvoa_type param -> total_dvoa / total_dvoa_rank / ...), so it never
// reaches the generic correlated-aggregate path and its range-offset main_select
// read the JOIN alias get-data-view-results drops (dangling alias, invalid SQL).
// The bespoke override resolves the dynamic column and AVGs it across the
// offset-expanded window, scoped to the same team_unit discriminator the JOIN
// applies. select_as makes the offset alias match the non-offset projection.
const create_dvoa_team_unit_dvoa_field = () => ({
  ...create_dvoa_team_unit_field('team_unit_dvoa'),
  select_as: () => 'team_unit_dvoa',
  main_select: ({ params, table_name, column_index }) => {
    const column_name = get_dvoa_column_name({ params })
    return [`${table_name}.${column_name} as team_unit_dvoa_${column_index}`]
  },
  main_group_by: ({ params, table_name }) => {
    const column_name = get_dvoa_column_name({ params })
    return [`${table_name}.${column_name}`]
  },
  main_select_string_year_offset_range: ({
    params,
    data_view_options,
    query_context
  }) => {
    const { team_unit } = get_default_params({ params })
    return team_year_offset_range_select({
      table: 'dvoa_team_unit_seasonlogs_index',
      column: get_dvoa_column_name({ params }),
      source: dvoa_team_source,
      params,
      data_view_options,
      query_context,
      aggregate: 'AVG',
      extra_predicates: [{ column: 'team_unit', value: team_unit }]
    })
  }
})

export default {
  team_unit_adjusted_line_yards: create_dvoa_team_unit_field(
    'team_adjusted_line_yards'
  ),
  team_unit_power_success: create_dvoa_team_unit_field('team_power_success'),
  team_unit_stuffed_rate: create_dvoa_team_unit_field('team_stuffed_rate'),
  team_unit_rushing_second_level_yards: create_dvoa_team_unit_field(
    'team_second_level_yards'
  ),
  team_unit_rushing_open_field_yards: create_dvoa_team_unit_field(
    'team_open_field_yards'
  ),
  team_unit_dvoa: create_dvoa_team_unit_dvoa_field()
}
