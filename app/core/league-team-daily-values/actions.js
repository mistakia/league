import { actions_utils } from '@core/utils'
const { create_api_actions, create_api_action_types } = actions_utils

export const league_team_daily_values_actions = {
  ...create_api_action_types('GET_LEAGUE_TEAM_DAILY_VALUES'),

  LOAD_LEAGUE_TEAM_DAILY_VALUES: 'LOAD_LEAGUE_TEAM_DAILY_VALUES',
  load_league_team_daily_values: () => ({
    type: league_team_daily_values_actions.LOAD_LEAGUE_TEAM_DAILY_VALUES
  })
}

export const get_league_team_daily_values_actions = create_api_actions(
  'GET_LEAGUE_TEAM_DAILY_VALUES'
)
