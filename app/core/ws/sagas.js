import { call, takeLatest, select, fork, delay, put } from 'redux-saga/effects'

import { wsActions } from './actions'
import { app_actions } from '@core/app'
import { get_app } from '@core/selectors'
import { openWS, closeWS, isOpen } from './service'

export function* disconnect() {
  yield call(closeWS)
}

export function* connect() {
  const { leagueId, token } = yield select(get_app)
  yield call(openWS, { token, leagueId })
}

export function* connect_auth() {
  // disconnect any existing connection and connect with auth
  yield call(disconnect)
  yield call(connect)
}

export function* reconnect() {
  const { userId } = yield select(get_app)
  if (userId) {
    while (!isOpen()) {
      yield call(connect)
      yield delay(2000) // TODO - increase delay each run
    }

    yield put(wsActions.reconnected())
  }
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchLogout() {
  yield takeLatest(app_actions.LOGOUT, disconnect)
}

export function* watchAuthFulfilled() {
  yield takeLatest(app_actions.AUTH_FULFILLED, connect_auth)
}

export function* watchWebSocketClose() {
  yield takeLatest(wsActions.WEBSOCKET_CLOSE, reconnect)
}

export function* watch_init_app() {
  yield takeLatest(app_actions.INIT_APP, connect)
}

//= ====================================
//  ROOT
// -------------------------------------

export const ws_sagas = [
  fork(watchAuthFulfilled),
  fork(watchLogout),
  fork(watchWebSocketClose),
  fork(watch_init_app)
]
