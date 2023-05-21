import { call, takeLatest, fork, select } from 'redux-saga/effects'

import { get_app, get_player_maps } from '@core/selectors'
import { fetchProps, fetchPlayers } from '@core/api'
import { propActions } from './actions'

export function* load() {
  yield call(fetchProps)
}

export function* loadPlayers({ payload }) {
  const players = yield select(get_player_maps)
  const missing = payload.data.filter((p) => !players.getIn([p.pid, 'fname']))
  if (missing.length) {
    const { leagueId } = yield select(get_app)
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
