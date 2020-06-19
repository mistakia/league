import { Record } from 'immutable'

import { appActions } from './actions'

const initialState = new Record({
  token: null,
  userId: undefined,
  teamId: undefined,
  leagueId: undefined,
  isPending: true,
  isUpdating: false,
  authError: null
})

export function appReducer (state = initialState(), { payload, type }) {
  switch (type) {
    case appActions.INIT_APP:
      return state.merge({
        token: payload.token,
        isPending: !!payload.token
      })

    case appActions.LOGOUT:
      return initialState().merge({ isPending: false })

    case appActions.AUTH_FAILED:
      return state.merge({
        isPending: false
      })

    case appActions.AUTH_FULFILLED:
      return state.merge({
        leagueId: payload.data.leagues.length ? payload.data.leagues[0].uid : undefined,
        teamId: payload.data.teams.length ? payload.data.teams[0].uid : undefined,
        userId: payload.data.user.id,
        isPending: false
      })

    case appActions.REGISTER_FAILED:
    case appActions.LOGIN_FAILED:
      return state.merge({
        isUpdating: false,
        authError: payload.error
      })

    case appActions.REGISTER_PENDING:
    case appActions.LOGIN_PENDING:
      return state.merge({ isUpdating: true })

    case appActions.REGISTER_FULFILLED:
    case appActions.LOGIN_FULFILLED:
      return state.merge({
        isUpdating: false,
        token: payload.data.token
      })

    default:
      return state
  }
}
