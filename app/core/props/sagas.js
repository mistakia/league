import { call, takeLatest, fork, select } from 'redux-saga/effects'

import { getApp } from '@core/app'
import { fetchProps, fetchPlayers } from '@core/api'
import { propActions } from './actions'
import { getAllPlayers } from '@core/players'

export function* load() {
  yield call(fetchProps)
}

export function* loadPlayers({ payload }) {
  const players = yield select(getAllPlayers)
  const missing = payload.data.filter((p) => !players.getIn([p.pid, 'fname']))
  if (missing.length) {
    const { leagueId } = yield select(getApp)
    const pids = [...new Set(missing.map((p) => p.pid))]
    yield call(fetchPlayers, { leagueId, pids })
  }
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchLoadProps() {
  yield takeLatest(propActions.LOAD_PROPS, load)
}

export function* watchGetPropsFulfilled() {
  yield takeLatest(propActions.GET_PROPS_FULFILLED, loadPlayers)
}

//= ====================================
//  ROOT
// -------------------------------------

export const propSagas = [fork(watchLoadProps), fork(watchGetPropsFulfilled)]
