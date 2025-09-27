import COLUMN_GROUPS from './column-groups'
import * as table_constants from 'react-table/src/constants.mjs'
import {
  common_column_params,
  nfl_plays_team_column_params,
  constants
} from '@libs-shared'

const { single_year, career_year } = common_column_params
const { matchup_opponent_type } = nfl_plays_team_column_params

// Generate year values from 2024 to current year
const get_year_values = () => {
  const years = []
  for (let year_value = 2024; year_value <= constants.year; year_value++) {
    years.push(year_value)
  }
  return years
}

const create_espn_line_field = ({
  column_title,
  header_label,
  player_value_path
}) => ({
  column_title,
  column_groups: [COLUMN_GROUPS.ESPN],
  header_label,
  player_value_path,
  size: 70,
  data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
  column_params: {
    year: {
      ...single_year,
      values: get_year_values()
    },
    win_rate_type: {
      values: ['PASS_RUSH', 'PASS_BLOCK', 'RUN_BLOCK', 'RUN_STOP'],
      data_type: table_constants.TABLE_DATA_TYPES.SELECT,
      single: true,
      default_value: 'PASS_RUSH',
      label: 'Win Rate Type'
    },
    career_year
  },
  splits: ['year']
})

const create_team_espn_line_field = ({
  column_title,
  header_label,
  player_value_path
}) => ({
  column_title,
  column_groups: [COLUMN_GROUPS.ESPN],
  header_label,
  player_value_path,
  size: 70,
  data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
  column_params: {
    year: {
      ...single_year,
      values: get_year_values()
    },
    matchup_opponent_type,
    career_year
  },
  splits: ['year']
})

export default {
  player_espn_line_win_rate: create_espn_line_field({
    column_title: 'Player ESPN Line Play Win Rate',
    header_label: 'Win Rate',
    player_value_path: 'espn_line_win_rate'
  }),
  player_espn_line_wins: create_espn_line_field({
    column_title: 'Player ESPN Line Play Wins',
    header_label: 'Wins',
    player_value_path: 'espn_line_wins'
  }),
  team_espn_pass_rush_win_rate: create_team_espn_line_field({
    column_title: 'Team ESPN Pass Rush Win Rate',
    header_label: 'PRWR',
    player_value_path: 'espn_team_pass_rush_win_rate'
  }),
  team_espn_pass_block_win_rate: create_team_espn_line_field({
    column_title: 'Team ESPN Pass Block Win Rate',
    header_label: 'PBWR',
    player_value_path: 'espn_team_pass_block_win_rate'
  }),
  team_espn_run_block_win_rate: create_team_espn_line_field({
    column_title: 'Team ESPN Run Block Win Rate',
    header_label: 'RBWR',
    player_value_path: 'espn_team_run_block_win_rate'
  }),
  team_espn_run_stop_win_rate: create_team_espn_line_field({
    column_title: 'Team ESPN Run Stop Win Rate',
    header_label: 'RSWR',
    player_value_path: 'espn_team_run_stop_win_rate'
  })
}
