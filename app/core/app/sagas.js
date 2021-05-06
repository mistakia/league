import { call, takeLatest, fork, select } from 'redux-saga/effects'

import { getApp } from './selectors'
import { appActions } from './actions'
import { postRegister, postLogin, fetchAuth } from '@core/api'
import { localStorageAdapter } from '@core/utils'
import { loadPlayers } from '@core/players'

export function* init() {
  const { token, key } = yield select(getApp)
  if (token && key) {
    yield call(fetchAuth)
  } else {
    yield call(loadPlayers)
  }
}

export function* register({ payload }) {
  yield call(postRegister, payload)
}

export function* login({ payload }) {
  yield call(postLogin, payload)
}

export function logout() {
  localStorageAdapter.removeItem('token')
}

export function* saveToken({ payload }) {
  const { token, key } = yield select(getApp)
  localStorageAdapter.setItem('key', key)
  localStorageAdapter.setItem('token', token)
  yield fork(init)
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchInitApp() {
  yield takeLatest(appActions.INIT_APP, init)
}

export function* watchRegister() {
  yield takeLatest(appActions.REGISTER, register)
}

export function* watchLogin() {
  yield takeLatest(appActions.LOGIN, login)
}

export function* watchLogout() {
  yield takeLatest(appActions.LOGOUT, logout)
}

export function* watchRegisterFulfilled() {
  yield takeLatest(appActions.REGISTER_FULFILLED, saveToken)
}

export function* watchLoginFulfilled() {
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
