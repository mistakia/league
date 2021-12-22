import { fork, all, take, call, select, put } from 'redux-saga/effects'

import { constants } from '@common'
import { playerActions } from '@core/players'
import { getCurrentLeague } from '@core/leagues'
import { teamActions, getTeamsForCurrentLeague } from '@core/teams'
import {
  rosterActions,
  getStartersByTeamId,
  getActivePlayersByTeamId
} from '@core/rosters'
import { matchupsActions, getMatchups } from '@core/matchups'
import { gamelogsActions, getPlayerGamelogs } from '@core/gamelogs'
import { standingsActions } from './actions'
import Worker from 'workerize-loader?inline!../worker' // eslint-disable-line import/no-webpack-loader-syntax

export function* calculate() {
  const league = yield select(getCurrentLeague)
  const teams = yield select(getTeamsForCurrentLeague)
  const starters = {}
  const active = {}
  const finalWeek = Math.min(
    Math.max(constants.season.week - 1, 0),
    constants.season.regularSeasonFinalWeek
  )
  for (let week = 1; week <= finalWeek; week++) {
    starters[week] = {}
    active[week] = {}
    for (const team of teams.valueSeq()) {
      const startingPlayers = yield select(getStartersByTeamId, {
        tid: team.uid,
        week
      })
      starters[week][team.uid] = startingPlayers.map((p) => ({
        player: p.player,
        pos: p.pos,
        slot: p.slot
      }))

      const activePlayers = yield select(getActivePlayersByTeamId, {
        tid: team.uid,
        week
      })
      active[week][team.uid] = activePlayers.map((p) => ({
        player: p.player,
        pos: p.pos
      }))
    }
  }
  const gamelogs = yield select(getPlayerGamelogs)
  const matchups = yield select(getMatchups)
  const worker = new Worker()
  const result = yield call(worker.calculateStandings, {
    league,
    matchups: matchups.get('items').toJS(),
    tids: teams
      .toList()
      .map((t) => t.uid)
      .toJS(),
    starters,
    active,
    gamelogs: gamelogs.toJS()
  })
  worker.terminate()

  yield put(standingsActions.setStandings(result))
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchAll() {
  while (true) {
    yield all([
      take(playerActions.FETCH_PLAYERS_FULFILLED),
      take(teamActions.GET_TEAMS_FULFILLED),
      take(rosterActions.GET_ROSTERS_FULFILLED),
      take(gamelogsActions.GET_PLAYER_GAMELOGS_FULFILLED),
      take(matchupsActions.GET_MATCHUPS_FULFILLED)
    ])

    yield call(calculate)
  }
}

//= ====================================
//  ROOT
// -------------------------------------

export const standingsSagas = [fork(watchAll)]
