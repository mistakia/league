import db from '#db'
import data_view_join_function from '#libs-server/data-views/data-view-join-function.mjs'
import { constants } from '#libs-shared'
import get_join_func from '#libs-server/get-join-func.mjs'

const get_default_params = ({ params = {} } = {}) => {
  const year = params.year || constants.season.stats_season_year
  let win_rate_type = params.win_rate_type || 'PASS_RUSH'
  if (Array.isArray(win_rate_type)) {
    win_rate_type = win_rate_type[0] || 'PASS_RUSH'
  }
  return { year: Number(year), win_rate_type }
}

const get_cache_info = ({ params = {} } = {}) => {
  const { year } = get_default_params({ params })
  if (year === constants.season.year) {
    return {
      cache_ttl: 1000 * 60 * 60 * 6, // 6 hours
      cache_expire_at: null
    }
  } else {
    return {
      cache_ttl: 1000 * 60 * 60 * 24 * 30, // 30 days
      cache_expire_at: null
    }
  }
}

const player_espn_line_join = (options) => {
  data_view_join_function({
    ...options,
    additional_conditions: function ({
      table_name,
      params,
      splits,
      year_split_join_clause
    }) {
      const { year, win_rate_type } = get_default_params({ params })

      this.andOn(
        `${table_name}.espn_win_rate_type`,
        '=',
        db.raw('?', [win_rate_type])
      )

      if (!splits.includes('year') && !year_split_join_clause) {
        this.andOn(`${table_name}.year`, '=', year)
      }
    }
  })
}

const team_espn_line_join = ({
  query,
  table_name,
  join_type = 'LEFT',
  params = {},
  splits = []
}) => {
  const { year } = get_default_params({ params })
  const join_func = get_join_func(join_type)

  query[join_func](table_name, function () {
    this.on(`${table_name}.team`, '=', 'player.current_nfl_team')

    if (!splits.includes('year')) {
      this.andOn(`${table_name}.year`, '=', db.raw('?', [year]))
    }
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
