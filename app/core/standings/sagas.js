import { fork, all, take, call, select, put } from 'redux-saga/effects'

import { constants } from '@common'
import { getCurrentLeague } from '@core/leagues'
import { teamActions, getTeamsForCurrentLeague } from '@core/teams'
import { rosterActions, getStartersByTeamId } from '@core/rosters'
import { matchupsActions, getMatchups } from '@core/matchups'
import { gamelogsActions, getGamelogs } from '@core/gamelogs'
import { standingsActions } from './actions'
import Worker from 'workerize-loader?inline!./worker' // eslint-disable-line import/no-webpack-loader-syntax

export function * calculate () {
  const league = yield select(getCurrentLeague)
  const teams = yield select(getTeamsForCurrentLeague)
  const starters = {}
  for (let week = 1; week < constants.season.week; week++) {
    starters[week] = {}
    for (const team of teams.valueSeq()) {
      const players = yield select(getStartersByTeamId, { tid: team.uid, week })
      starters[week][team.uid] = players.map(p => ({ player: p.player, pos: p.pos }))
    }
  }
  const gamelogs = yield select(getGamelogs)
  const matchups = yield select(getMatchups)
  const worker = new Worker()
  const result = yield call(worker.calculate, {
    league,
    matchups: matchups.get('items').toJS(),
    tids: teams.toList().map(t => t.uid).toJS(),
    starters,
    gamelogs: gamelogs.toJS()
  })
  worker.terminate()

  yield put(standingsActions.setStandings(result))
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function * watchAll () {
  while (true) {
    yield all([
      take(teamActions.GET_TEAMS_FULFILLED),
      take(rosterActions.GET_ROSTERS_FULFILLED),
      take(gamelogsActions.GET_GAMELOGS_FULFILLED),
      take(matchupsActions.GET_MATCHUPS_FULFILLED)
    ])

    yield call(calculate)
  }
}

//= ====================================
//  ROOT
// -------------------------------------

export const standingsSagas = [
  fork(watchAll)
]
