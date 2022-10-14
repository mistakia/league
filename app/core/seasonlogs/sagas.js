import { fork, takeLatest, select, call } from 'redux-saga/effects'

import { getNflTeamSeasonlogs } from '@core/api'
import { appActions, getApp } from '@core/app'

export function* load() {
  const { leagueId } = yield select(getApp)
  yield call(getNflTeamSeasonlogs, { leagueId })
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchInitApp() {
  yield takeLatest(appActions.INIT_APP, load)
}

//= ====================================
//  ROOT
// -------------------------------------

export const seasonlogSagas = [fork(watchInitApp)]
