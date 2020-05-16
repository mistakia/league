import { Record } from 'immutable'

import { appActions } from './actions'

const initialState = new Record({
  token: null,
  userId: null,
  isPending: true,
  isUpdating: false
})

export function appReducer (state = initialState(), { payload, type }) {
  switch (type) {
    case appActions.INIT_APP:
      return state.merge({
        token: payload.token,
        isPending: !!payload.token
      })

    case appActions.AUTH_FAILED:
      return state.merge({
        isPending: false
      })

    case appActions.AUTH_FULFILLED:
      return state.merge({
        userId: payload.data.user.id,
        isPending: false
      })

    case appActions.REGISTER_FAILED:
    case appActions.LOGIN_FAILED:
      return state.merge({
        isUpdating: false
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
