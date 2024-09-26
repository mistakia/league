import db from '#db'
import { constants } from '#libs-shared'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import data_view_join_function from '#libs-server/data-views/data-view-join-function.mjs'

const get_default_params = ({ params = {} } = {}) => {
  let year = params.year || [constants.season.stats_season_year]
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

  if (!acceptable_team_units.includes(team_unit)) {
    team_unit = 'OFFENSE'
  }

  const dvoa_type = Array.isArray(params.dvoa_type)
    ? params.dvoa_type[0] || 'total_dvoa'
    : params.dvoa_type || 'total_dvoa'

  return { year, team_unit, matchup_opponent_type, dvoa_type }
}

const get_cache_info = ({ params = {} } = {}) => {
  const { year } = get_default_params({ params })

  // TODO factor in week

  if (year.includes(constants.season.year)) {
    return {
      cache_ttl: 1000 * 60 * 60 * 6, // 6 hours
      // TODO should expire before the next game starts
      cache_expire_at: null
    }
  } else {
    // includes only prior years
    return {
      cache_ttl: 1000 * 60 * 60 * 24 * 30, // 30 days
      cache_expire_at: null
    }
  }
}

const dvoa_team_unit_seasonlogs_table_alias = ({ params = {} } = {}) => {
  const { year, matchup_opponent_type } = get_default_params({ params })
  const suffix = matchup_opponent_type ? `_${matchup_opponent_type}` : ''
  return get_table_hash(`dvoa_team_unit_seasonlogs_${year.join('_')}${suffix}`)
}

const dvoa_team_unit_seasonlogs_join = (join_arguments) => {
  data_view_join_function({
    ...join_arguments,
    join_year: true,
    default_year: constants.season.stats_season_year,
    join_on_team: true,
    join_table_clause: `dvoa_team_unit_seasonlogs_index as ${join_arguments.table_name}`,
    additional_conditions: function ({ table_name, params }) {
      const { team_unit } = get_default_params({ params })
      this.andOn(`${table_name}.team_unit`, '=', db.raw('?', [team_unit]))
    }
  })
}

const create_dvoa_team_unit_field = (column_name) => ({
  column_name,
  table_name: 'dvoa_team_unit_seasonlogs_index',
  table_alias: dvoa_team_unit_seasonlogs_table_alias,
  join: dvoa_team_unit_seasonlogs_join,
  supported_splits: ['year'],
  get_cache_info
})

const get_dvoa_column_name = ({ params }) => {
  const { dvoa_type } = get_default_params({ params })
  const rank_suffix = params.rank ? '_rank' : ''
  const column_name = `${dvoa_type}${rank_suffix}`
  return column_name
}

const create_dvoa_team_unit_dvoa_field = () => ({
  ...create_dvoa_team_unit_field('total_dvoa'),
  main_select: ({ params, table_name }) => {
    const column_name = get_dvoa_column_name({ params })
    return [`${table_name}.${column_name}`]
  },
  main_group_by: ({ params, table_name }) => {
    const column_name = get_dvoa_column_name({ params })
    return [`${table_name}.${column_name}`]
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
