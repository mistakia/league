import { actions_utils } from '@core/utils'
const { create_api_actions, create_api_action_types } = actions_utils

export const league_careerlogs_actions = {
  ...create_api_action_types('GET_LEAGUE_CAREERLOGS'),

  LOAD_LEAGUE_CAREERLOGS: 'LOAD_LEAGUE_CAREERLOGS',
  load_league_careerlogs: (leagueId) => ({
    type: league_careerlogs_actions.LOAD_LEAGUE_CAREERLOGS,
    payload: { leagueId }
  })
}

export const get_league_careerlogs_actions = create_api_actions(
  'GET_LEAGUE_CAREERLOGS'
)
