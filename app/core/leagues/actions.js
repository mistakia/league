import { actions_utils } from '@core/utils'
const { create_api_actions, create_api_action_types } = actions_utils

export const leagueActions = {
  ...create_api_action_types('PUT_LEAGUE'),
  ...create_api_action_types('GET_LEAGUE'),

  LOAD_LEAGUE: 'LOAD_LEAGUE',
  load_league: () => ({
    type: leagueActions.LOAD_LEAGUE
  }),

  UPDATE_LEAGUE: 'UPDATE_LEAGUE',
  update: ({ leagueId, value, field }) => ({
    type: leagueActions.UPDATE_LEAGUE,
    payload: {
      leagueId,
      value,
      field
    }
  }),

  SET_LEAGUE: 'SET_LEAGUE',
  set: (opts) => ({
    type: leagueActions.SET_LEAGUE,
    payload: {
      opts
    }
  })
}

export const putLeagueActions = create_api_actions('PUT_LEAGUE')
export const getLeagueActions = create_api_actions('GET_LEAGUE')
