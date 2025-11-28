import { league_defaults } from '@constants'
import { actions_utils } from '@core/utils'
const { create_api_actions, create_api_action_types } = actions_utils

export const app_actions = {
  ...create_api_action_types('AUTH'),
  ...create_api_action_types('REGISTER'),
  ...create_api_action_types('LOGIN'),

  SELECT_YEAR: 'SELECT_YEAR',
  select_year: (year) => ({
    type: app_actions.SELECT_YEAR,
    payload: {
      year: Number(year)
    }
  }),

  INIT_APP: 'INIT_APP',
  init: ({ token, leagueId = league_defaults.LEAGUE_ID }) => ({
    type: app_actions.INIT_APP,
    payload: {
      token,
      leagueId
    }
  }),

  LOGIN: 'LOGIN',
  login: ({ email_or_username, password }) => ({
    type: app_actions.LOGIN,
    payload: {
      email_or_username,
      password
    }
  }),

  LOGOUT: 'LOGOUT',
  logout: () => ({
    type: app_actions.LOGOUT
  }),

  REGISTER: 'REGISTER',
  register: ({ email, username, password, leagueId, teamId, invite_code }) => ({
    type: app_actions.REGISTER,
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

export const auth_actions = create_api_actions('AUTH')
export const register_actions = create_api_actions('REGISTER')
export const login_actions = create_api_actions('LOGIN')
