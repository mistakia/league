import { call, takeLatest, fork, select } from 'redux-saga/effects'

import { getApp } from '@core/app'
import { poachActions } from './actions'
import { postPoach } from '@core/api'

export function* poach({ payload }) {
  const { leagueId, teamId } = yield select(getApp)
  yield call(postPoach, { leagueId, teamId, ...payload })
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchPoach() {
  yield takeLatest(poachActions.POACH_PLAYER, poach)
}

//= ====================================
//  ROOT
// -------------------------------------

export const poachSagas = [fork(watchPoach)]
