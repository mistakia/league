import { league_defaults } from '@constants'
import { actions_utils } from '@core/utils'
const { create_api_actions, create_api_action_types } = actions_utils

export const app_actions = {
  ...create_api_action_types('AUTH'),
  ...create_api_action_types('REGISTER'),
  ...create_api_action_types('LOGIN'),
  ...create_api_action_types('RESET_PASSWORD'),
  ...create_api_action_types('REQUEST_PASSWORD_RESET'),

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

  // A client-side navigation into a league route must land the app in the same
  // state a full page load of that URL would, and INIT_APP fires once on mount
  // — so the route is the only thing that can move the connected league after
  // it. Without this, following a link to /leagues/1 leaves the app on
  // whichever league it started with and renders that one's data under the new
  // URL.
  SELECT_LEAGUE: 'SELECT_LEAGUE',
  select_league: ({ leagueId }) => ({
    type: app_actions.SELECT_LEAGUE,
    payload: {
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

  RESET_PASSWORD: 'RESET_PASSWORD',
  reset_password: ({ token, password }) => ({
    type: app_actions.RESET_PASSWORD,
    payload: {
      token,
      password
    }
  }),

  REQUEST_PASSWORD_RESET: 'REQUEST_PASSWORD_RESET',
  request_password_reset: ({ email_or_username }) => ({
    type: app_actions.REQUEST_PASSWORD_RESET,
    payload: {
      email_or_username
    }
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
export const reset_password_actions = create_api_actions('RESET_PASSWORD')
export const request_password_reset_actions = create_api_actions(
  'REQUEST_PASSWORD_RESET'
)
