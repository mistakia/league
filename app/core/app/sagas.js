import { call, takeLatest, fork, select, put } from 'redux-saga/effects'

import { get_app } from '@core/selectors'
import { app_actions } from './actions'
import { api_post_register, api_post_login, api_get_auth } from '@core/api'
import { localStorageAdapter } from '@core/utils'
import { league_actions } from '@core/leagues/actions'

export function* init() {
  const { token } = yield select(get_app)
  if (token) {
    yield call(api_get_auth)
  } else {
    yield put(league_actions.load_league())
  }
}

export function* register({ payload }) {
  yield call(api_post_register, payload)
}

export function* login({ payload }) {
  yield call(api_post_login, payload)
}

export function logout() {
  localStorageAdapter.removeItem('token')
}

export function* saveToken({ payload }) {
  const { token } = yield select(get_app)
  localStorageAdapter.setItem('token', token)
  yield fork(init)
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchInitApp() {
  yield takeLatest(app_actions.INIT_APP, init)
}

export function* watchRegister() {
  yield takeLatest(app_actions.REGISTER, register)
}

export function* watchLogin() {
  yield takeLatest(app_actions.LOGIN, login)
}

export function* watchLogout() {
  yield takeLatest(app_actions.LOGOUT, logout)
}

export function* watchRegisterFulfilled() {
  yield takeLatest(app_actions.REGISTER_FULFILLED, saveToken)
}

export function* watchLoginFulfilled() {
  yield takeLatest(app_actions.LOGIN_FULFILLED, saveToken)
}

//= ====================================
//  ROOT
// -------------------------------------

export const app_sagas = [
  fork(watchInitApp),
  fork(watchRegister),
  fork(watchLogin),
  fork(watchLogout),
  fork(watchRegisterFulfilled),
  fork(watchLoginFulfilled)
]
