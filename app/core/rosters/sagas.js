import { call, takeLatest, fork, select, put } from 'redux-saga/effects'

import { rosterActions } from './actions'
import { getRoster, getRosters, putRoster, postActivate, postDeactivate } from '@core/api'
import { getApp, appActions } from '@core/app'
import { getActivePlayersByRosterForCurrentLeague } from './selectors'
import { getCurrentLeague } from '@core/leagues'
import {
  constants,
  getOptimizerPositionConstraints
} from '@common'
import Worker from 'workerize-loader?inline!./worker' // eslint-disable-line import/no-webpack-loader-syntax

export function * loadRoster ({ payload }) {
  const { teamId } = payload
  yield call(getRoster, { teamId })
}

export function * loadRosters () {
  const { leagueId } = yield select(getApp)
  yield call(getRosters, { leagueId })
}

export function * updateRoster ({ payload }) {
  const { teamId, leagueId } = yield select(getApp)
  yield call(putRoster, { teamId, leagueId, ...payload })
}

export function * activate ({ payload }) {
  const { teamId, leagueId } = yield select(getApp)
  yield call(postActivate, { teamId, leagueId, ...payload })
}

export function * deactivate ({ payload }) {
  const { teamId, leagueId } = yield select(getApp)
  yield call(postDeactivate, { teamId, leagueId, ...payload })
}

export function * projectLineups () {
  const league = yield select(getCurrentLeague)

  const rosters = yield select(getActivePlayersByRosterForCurrentLeague)
  const lineups = {}

  for (const [teamId, players] of rosters.entrySeq()) {
    lineups[teamId] = {}

    const positions = players.map(p => p.pos1)
    const constraints = getOptimizerPositionConstraints({ positions, league })

    const worker = new Worker()
    for (let week = 1; week <= constants.season.finalWeek; week++) {
      if (constants.season.week > week) continue
      const result = yield call(worker.optimizeLineup, {
        constraints,
        players: players.toJS(),
        week
      })
      const starters = Object.keys(result)
        .filter(r => r.match(/^([A-Z]{2,})-([0-9]{4,})$/ig) || r.match(/^([A-Z]{1,3})$/ig))

      lineups[teamId][week] = {
        total: result.result,
        starters
      }
    }
  }

  yield put(rosterActions.setLineupProjections(lineups))
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function * watchLoadRoster () {
  yield takeLatest(rosterActions.LOAD_ROSTER, loadRoster)
}

export function * watchLoadRosters () {
  yield takeLatest(rosterActions.LOAD_ROSTERS, loadRosters)
}

export function * watchUpdateRoster () {
  yield takeLatest(rosterActions.UPDATE_ROSTER, updateRoster)
}

export function * watchActivatePlayer () {
  yield takeLatest(rosterActions.ACTIVATE_PLAYER, activate)
}

export function * watchDeactivatePlayer () {
  yield takeLatest(rosterActions.DEACTIVATE_PLAYER, deactivate)
}

export function * watchAuthFulfilled () {
  yield takeLatest(appActions.AUTH_FULFILLED, loadRosters)
}

export function * watchProjectLineups () {
  yield takeLatest(rosterActions.PROJECT_LINEUPS, projectLineups)
}

//= ====================================
//  ROOT
// -------------------------------------

export const rosterSagas = [
  fork(watchLoadRoster),
  fork(watchLoadRosters),
  fork(watchUpdateRoster),
  fork(watchActivatePlayer),
  fork(watchDeactivatePlayer),
  fork(watchAuthFulfilled),
  fork(watchProjectLineups)
]
