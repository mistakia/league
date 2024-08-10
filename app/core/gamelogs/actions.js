import { actions_utils } from '@core/utils'
const { create_api_actions, create_api_action_types } = actions_utils

export const gamelogsActions = {
  ...create_api_action_types('GET_PLAYERS_GAMELOGS'),

  LOAD_PLAYERS_GAMELOGS: 'LOAD_PLAYERS_GAMELOGS',
  load_players_gamelogs: ({ year, week, nfl_team, opponent, position }) => ({
    type: gamelogsActions.LOAD_PLAYERS_GAMELOGS,
    payload: {
      year,
      week,
      nfl_team,
      opponent,
      position
    }
  }),

  SET_PLAYER_GAMELOGS_ANALYSIS: 'SET_PLAYER_GAMELOGS_ANALYSIS',
  setPlayerGamelogsAnalysis: (data) => ({
    type: gamelogsActions.SET_PLAYER_GAMELOGS_ANALYSIS,
    payload: {
      data
    }
  })
}

export const getPlayersGamelogsActions = create_api_actions(
  'GET_PLAYERS_GAMELOGS'
)
