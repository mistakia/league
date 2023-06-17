import { constants } from '@libs-shared'

export const appActions = {
  INIT_APP: 'INIT_APP',

  AUTH_PENDING: 'AUTH_PENDING',
  AUTH_FAILED: 'AUTH_FAILED',
  AUTH_FULFILLED: 'AUTH_FULFILLED',

  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  REGISTER: 'REGISTER',

  REGISTER_FAILED: 'REGISTER_FAILED',
  REGISTER_PENDING: 'REGISTER_PENDING',
  REGISTER_FULFILLED: 'REGISTER_FULFILLED',

  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGIN_PENDING: 'LOGIN_PENDING',
  LOGIN_FULFILLED: 'LOGIN_FULFILLED',

  SELECT_YEAR: 'SELECT_YEAR',

  selectYear: (year) => ({
    type: appActions.SELECT_YEAR,
    payload: {
      year: Number(year)
    }
  }),

  init: ({ token, leagueId = constants.DEFAULTS.LEAGUE_ID }) => ({
    type: appActions.INIT_APP,
    payload: {
      token,
      leagueId
    }
  }),

  login: ({ email, password }) => ({
    type: appActions.LOGIN,
    payload: {
      email,
      password
    }
  }),

  logout: () => ({
    type: appActions.LOGOUT
  }),

  register: ({ email, password, leagueId, teamId }) => ({
    type: appActions.REGISTER,
    payload: {
      email,
      password,
      leagueId,
      teamId
    }
  }),

  authFailed: (opts, error) => ({
    type: appActions.AUTH_FAILED,
    payload: {
      opts,
      error
    }
  }),

  authPending: (opts) => ({
    type: appActions.AUTH_PENDING,
    payload: {
      opts
    }
  }),

  authFulfilled: (opts, data) => ({
    type: appActions.AUTH_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  loginFailed: (opts, error) => ({
    type: appActions.LOGIN_FAILED,
    payload: {
      opts,
      error
    }
  }),

  loginPending: (opts) => ({
    type: appActions.LOGIN_PENDING,
    payload: {
      opts
    }
  }),

  loginFulfilled: (opts, data) => ({
    type: appActions.LOGIN_FULFILLED,
    payload: {
      opts,
      data
    }
  }),

  registerFailed: (opts, error) => ({
    type: appActions.REGISTER_FAILED,
    payload: {
      opts,
      error
    }
  }),

  registerPending: (opts) => ({
    type: appActions.REGISTER_PENDING,
    payload: {
      opts
    }
  }),

  registerFulfilled: (opts, data) => ({
    type: appActions.REGISTER_FULFILLED,
    payload: {
      opts,
      data
    }
  })
}

export const authActions = {
  failed: appActions.authFailed,
  fulfilled: appActions.authFulfilled,
  pending: appActions.authPending
}

export const registerActions = {
  failed: appActions.registerFailed,
  fulfilled: appActions.registerFulfilled,
  pending: appActions.registerPending
}

export const loginActions = {
  failed: appActions.loginFailed,
  fulfilled: appActions.loginFulfilled,
  pending: appActions.loginPending
}
