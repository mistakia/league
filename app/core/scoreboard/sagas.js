import { call, takeLatest, fork, select } from 'redux-saga/effects'

import { getScoreboard, getScoreboardUpdated } from '@core/selectors'
import { scoreboardActions } from './actions'
import { playActions } from '@core/plays'
import { send, wsActions } from '@core/ws'
import { constants } from '@common'

export function* register() {
  if (!constants.isRegularSeason) return
  const updated = yield select(getScoreboardUpdated)
  console.log(`register scoreboard ${updated}`)
  send({
    type: scoreboardActions.SCOREBOARD_REGISTER,
    payload: { updated }
  })
}

export function* reregister() {
  const state = yield select(getScoreboard)
  const isLoaded = state.get('isLoaded')
  if (isLoaded) {
    yield call(register)
  }
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchGetScoreboardFulfilled() {
  yield takeLatest(playActions.GET_PLAYSTATS_FULFILLED, register)
}

export function* watchUpdateScoreboardPlays() {
  yield takeLatest(scoreboardActions.UPDATE_SCOREBOARD_PLAYS, register)
}

export function* watchWebSocketReconnected() {
  yield takeLatest(wsActions.WEBSOCKET_RECONNECTED, reregister)
}

//= ====================================
//  ROOT
// -------------------------------------

export const scoreboardSagas = [
  fork(watchGetScoreboardFulfilled),
  fork(watchUpdateScoreboardPlays),
  fork(watchWebSocketReconnected)
]
