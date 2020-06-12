import { call, takeLatest, fork, select } from 'redux-saga/effects'

import { getToken } from './selectors'
import { appActions } from './actions'
import { postRegister, postLogin, postLogout, fetchAuth } from '@core/api'
import { connectWS } from '@core/ws'
import { localStorageAdapter } from '@core/utils'

export function * init () {
  const token = yield select(getToken)
  if (token) {
    yield call(fetchAuth)
    connectWS(token)
  }
}

export function * register ({ payload }) {
  yield call(postRegister, payload)
}

export function * login ({ payload }) {
  yield call(postLogin, payload)
}

export function * logout () {
  yield call(postLogout)
}

export function * saveToken ({ payload }) {
  localStorageAdapter.setItem('token', payload.data.token)
  yield fork(init)
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function * watchInitApp () {
  yield takeLatest(appActions.INIT_APP, init)
}

export function * watchRegister () {
  yield takeLatest(appActions.REGISTER, register)
}

export function * watchLogin () {
  yield takeLatest(appActions.LOGIN, login)
}

export function * watchLogout () {
  yield takeLatest(appActions.LOGOUT, logout)
}

export function * watchRegisterFulfilled () {
  yield takeLatest(appActions.REGISTER_FULFILLED, saveToken)
}

export function * watchLoginFulfilled () {
  yield takeLatest(appActions.LOGIN_FULFILLED, saveToken)
}

//= ====================================
//  ROOT
// -------------------------------------

export const appSagas = [
  fork(watchInitApp),
  fork(watchRegister),
  fork(watchLogin),
  fork(watchLogout),
  fork(watchRegisterFulfilled),
  fork(watchLoginFulfilled)
]
