import { call, takeLatest, select, fork, delay, put } from 'redux-saga/effects'

import { wsActions } from './actions'
import { appActions } from '@core/app'
import { get_app } from '@core/selectors'
import { openWS, closeWS, isOpen } from './service'

export function* disconnect() {
  yield call(closeWS)
}

export function* connect() {
  const { leagueId, token } = yield select(get_app)
  yield call(openWS, { token, leagueId })
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
  yield takeLatest(appActions.LOGOUT, disconnect)
}

export function* watchAuthFulfilled() {
  yield takeLatest(appActions.AUTH_FULFILLED, connect)
}

export function* watchWebSocketClose() {
  yield takeLatest(wsActions.WEBSOCKET_CLOSE, reconnect)
}

//= ====================================
//  ROOT
// -------------------------------------

export const wsSagas = [
  fork(watchAuthFulfilled),
  fork(watchLogout),
  fork(watchWebSocketClose)
]
