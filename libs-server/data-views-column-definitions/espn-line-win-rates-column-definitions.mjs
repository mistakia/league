import db from '#db'
import data_view_join_function from '#libs-server/data-views/data-view-join-function.mjs'
import { current_season } from '#constants'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import { create_exact_year_cache_info } from '#libs-server/data-views/cache-info-utils.mjs'

const get_default_params = ({ params = {} } = {}) => {
  const year = params.year || current_season.stats_season_year
  let win_rate_type = params.win_rate_type || 'PASS_RUSH'
  if (Array.isArray(win_rate_type)) {
    win_rate_type = win_rate_type[0] || 'PASS_RUSH'
  }
  return { year: Number(year), win_rate_type }
}

const get_cache_info = create_exact_year_cache_info({
  get_year: (params) => get_default_params({ params }).year
})

const player_espn_line_join = (options) => {
  data_view_join_function({
    ...options,
    additional_conditions: function ({
      table_name,
      params,
      splits,
      data_view_options
    }) {
      const { year, win_rate_type } = get_default_params({ params })

      this.andOn(
        `${table_name}.espn_win_rate_type`,
        '=',
        db.raw('?', [win_rate_type])
      )

      if (!splits.includes('year')) {
        this.andOn(`${table_name}.year`, '=', year)
      }
    }
  })
}

const espn_team_win_rates_table_alias = ({ params = {} } = {}) => {
  const { year } = get_default_params({ params })
  const matchup_opponent_type = Array.isArray(params.matchup_opponent_type)
    ? params.matchup_opponent_type[0]
    : params.matchup_opponent_type

  // Include matchup_opponent_type in the hash to create unique table aliases
  const hash_key = matchup_opponent_type
    ? `espn_team_win_rates_${year}_${matchup_opponent_type}`
    : `espn_team_win_rates_${year}`

  return get_table_hash(hash_key)
}

const team_espn_line_join = (join_arguments) => {
  data_view_join_function({
    ...join_arguments,
    join_year: true,
    join_on_team: true,
    join_table_team_field: 'team',
    join_table_clause: `espn_team_win_rates_index as ${join_arguments.table_name}`,
    default_year: current_season.stats_season_year
  })
}

const create_player_espn_line_column = (column_name) => ({
  table_name: 'espn_player_win_rates_index',
  column_name,
  select_as: () => `espn_line_${column_name}`,
  join: player_espn_line_join,
  supported_splits: ['year'],
  get_cache_info
})

const create_team_espn_line_column = (column_name) => ({
  table_name: 'espn_team_win_rates_index',
  column_name,
  select_as: () => `espn_team_${column_name}`,
  table_alias: espn_team_win_rates_table_alias,
  join: team_espn_line_join,
  supported_splits: ['year'],
  get_cache_info
})

export default {
  player_espn_line_win_rate: create_player_espn_line_column('win_rate'),
  player_espn_line_wins: create_player_espn_line_column('wins'),
  team_espn_pass_rush_win_rate:
    create_team_espn_line_column('pass_rush_win_rate'),
  team_espn_pass_block_win_rate: create_team_espn_line_column(
    'pass_block_win_rate'
  ),
  team_espn_run_block_win_rate:
    create_team_espn_line_column('run_block_win_rate'),
  team_espn_run_stop_win_rate: create_team_espn_line_column('run_stop_win_rate')
}
