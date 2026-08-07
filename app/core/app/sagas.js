import { call, takeLatest, fork, select, put } from 'redux-saga/effects'

import { get_app } from '@core/selectors'
import { app_actions } from './actions'
import {
  api_post_register,
  api_post_login,
  api_get_auth,
  api_post_reset_password_confirm,
  api_post_request_password_reset
} from '@core/api'
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

export function* reset_password({ payload }) {
  yield call(api_post_reset_password_confirm, payload)
}

export function* request_password_reset({ payload }) {
  yield call(api_post_request_password_reset, payload)
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

export function* watch_reset_password() {
  yield takeLatest(app_actions.RESET_PASSWORD, reset_password)
}

export function* watch_request_password_reset() {
  yield takeLatest(app_actions.REQUEST_PASSWORD_RESET, request_password_reset)
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
  fork(watch_reset_password),
  fork(watch_request_password_reset),
  fork(watchLogout),
  fork(watchRegisterFulfilled),
  fork(watchLoginFulfilled)
]
