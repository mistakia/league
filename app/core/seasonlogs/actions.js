import { actions_utils } from '@core/utils'
const { create_api_actions, create_api_action_types } = actions_utils

export const seasonlogs_actions = {
  ...create_api_action_types('GET_NFL_TEAM_SEASONLOGS'),

  LOAD_NFL_TEAM_SEASONLOGS: 'LOAD_NFL_TEAM_SEASONLOGS',
  load_nfl_team_seasonlogs: () => ({
    type: seasonlogs_actions.LOAD_NFL_TEAM_SEASONLOGS
  })
}

export const get_nfl_team_seasonlogs_actions = create_api_actions(
  'GET_NFL_TEAM_SEASONLOGS'
)
