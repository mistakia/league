import { constants } from '@libs-shared'
import { actions_utils } from '@core/utils'
const { create_api_actions, create_api_action_types } = actions_utils

export const appActions = {
  ...create_api_action_types('AUTH'),
  ...create_api_action_types('REGISTER'),
  ...create_api_action_types('LOGIN'),

  SELECT_YEAR: 'SELECT_YEAR',
  selectYear: (year) => ({
    type: appActions.SELECT_YEAR,
    payload: {
      year: Number(year)
    }
  }),

  INIT_APP: 'INIT_APP',
  init: ({ token, leagueId = constants.DEFAULTS.LEAGUE_ID }) => ({
    type: appActions.INIT_APP,
    payload: {
      token,
      leagueId
    }
  }),

  LOGIN: 'LOGIN',
  login: ({ email_or_username, password }) => ({
    type: appActions.LOGIN,
    payload: {
      email_or_username,
      password
    }
  }),

  LOGOUT: 'LOGOUT',
  logout: () => ({
    type: appActions.LOGOUT
  }),

  REGISTER: 'REGISTER',
  register: ({ email, username, password, leagueId, teamId, invite_code }) => ({
    type: appActions.REGISTER,
    payload: {
      email,
      username,
      password,
      leagueId,
      teamId,
      invite_code
    }
  })
}

export const authActions = create_api_actions('AUTH')
export const registerActions = create_api_actions('REGISTER')
export const loginActions = create_api_actions('LOGIN')
