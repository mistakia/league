import { call, takeLatest, fork, select, put } from 'redux-saga/effects'

import { get_app } from '@core/selectors'
import { appActions } from './actions'
import { postRegister, postLogin, fetchAuth } from '@core/api'
import { localStorageAdapter } from '@core/utils'
import { leagueActions } from '@core/leagues/actions'

export function* init() {
  const { token } = yield select(get_app)
  if (token) {
    yield call(fetchAuth)
  } else {
    yield put(leagueActions.load_league())
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
  const { token } = yield select(get_app)
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
