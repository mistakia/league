import { fork, all, take, call, select, put } from 'redux-saga/effects'

import { constants } from '@common'
import { teamActions, getTeamsForCurrentLeague } from '@core/teams'
import { standingsActions } from '@core/standings'
import { rosterActions, getRostersForCurrentLeague } from '@core/rosters'
import { matchupsActions, getMatchups } from '@core/matchups'
import { forecastActions } from './actions'
import Worker from 'workerize-loader?inline!./worker' // eslint-disable-line import/no-webpack-loader-syntax

export function * simulate () {
  const teams = yield select(getTeamsForCurrentLeague)
  const matchups = yield select(getMatchups)
  const rosters = yield select(getRostersForCurrentLeague)
  const worker = new Worker()
  const result = yield call(worker.simulate, {
    teams: teams.toJS(),
    matchups: matchups.get('items').filter(m => m.week >= constants.season.week).toJS(),
    rosters: rosters.toJS()
  })
  worker.terminate()

  yield put(forecastActions.setForecast(result))
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function * watchAll () {
  while (true) {
    yield all([
      take(teamActions.GET_TEAMS_FULFILLED),
      take(rosterActions.SET_LINEUPS),
      take(matchupsActions.GET_MATCHUPS_FULFILLED),
      take(standingsActions.SET_STANDINGS)
    ])

    yield call(simulate)
  }
}

//= ====================================
//  ROOT
// -------------------------------------

export const forecastSagas = [
  fork(watchAll)
]
