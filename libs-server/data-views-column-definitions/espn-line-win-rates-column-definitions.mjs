import db from '#db'
import data_view_join_function from '#libs-server/data-views/data-view-join-function.mjs'
import { constants } from '#libs-shared'
import get_join_func from '#libs-server/get-join-func.mjs'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import { create_exact_year_cache_info } from '#libs-server/data-views/cache-info-utils.mjs'

const get_default_params = ({ params = {} } = {}) => {
  const year = params.year || constants.season.stats_season_year
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
    const matchup_opponent_type = Array.isArray(params.matchup_opponent_type)
      ? params.matchup_opponent_type[0]
      : params.matchup_opponent_type

    if (matchup_opponent_type) {
      switch (matchup_opponent_type) {
        case 'current_week_opponent_total':
          this.on(`${table_name}.team`, '=', 'current_week_opponents.opponent')
          break

        case 'next_week_opponent_total':
          this.on(`${table_name}.team`, '=', 'next_week_opponents.opponent')
          break

        default:
          this.on(`${table_name}.team`, '=', 'player.current_nfl_team')
          break
      }
    } else {
      this.on(`${table_name}.team`, '=', 'player.current_nfl_team')
    }

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
