import { actions_utils } from '@core/utils'
const { create_api_actions, create_api_action_types } = actions_utils

export const gamelogs_actions = {
  ...create_api_action_types('GET_PLAYERS_GAMELOGS'),

  LOAD_PLAYERS_GAMELOGS: 'LOAD_PLAYERS_GAMELOGS',
  load_players_gamelogs: ({ year, week, nfl_team, opponent, position }) => ({
    type: gamelogs_actions.LOAD_PLAYERS_GAMELOGS,
    payload: {
      year,
      week,
      nfl_team,
      opponent,
      position
    }
  })
}

export const get_players_gamelogs_actions = create_api_actions(
  'GET_PLAYERS_GAMELOGS'
)
