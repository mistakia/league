import { actions_utils } from '@core/utils'
const { create_api_actions, create_api_action_types } = actions_utils

export const league_actions = {
  ...create_api_action_types('PUT_LEAGUE'),
  ...create_api_action_types('GET_LEAGUE'),

  LOAD_LEAGUE: 'LOAD_LEAGUE',
  load_league: () => ({
    type: league_actions.LOAD_LEAGUE
  }),

  UPDATE_LEAGUE: 'UPDATE_LEAGUE',
  update: ({ leagueId, value, field }) => ({
    type: league_actions.UPDATE_LEAGUE,
    payload: {
      leagueId,
      value,
      field
    }
  }),

  SET_LEAGUE: 'SET_LEAGUE',
  set: (opts) => ({
    type: league_actions.SET_LEAGUE,
    payload: {
      opts
    }
  })
}

export const put_league_actions = create_api_actions('PUT_LEAGUE')
export const get_league_actions = create_api_actions('GET_LEAGUE')
