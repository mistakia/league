import { take, call, takeLatest, fork, select, put } from 'redux-saga/effects'

import { rosterActions } from './actions'
import {
  getRoster,
  getRosters,
  putRoster,
  postActivate,
  postDeactivate,
  postRosters,
  deleteRosters,
  putRosters,
  postAddFreeAgent,
  postReserve
} from '@core/api'
import { getApp, appActions } from '@core/app'
import { constants } from '@common'
import { getPlayers, getAllPlayers, playerActions } from '@core/players'
import {
  getActivePlayersByRosterForCurrentLeague,
  getCurrentTeamRosterRecord,
  getCurrentPlayers
} from './selectors'
import { getCurrentLeague } from '@core/leagues'
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

export function * setPlayerLineupContribution ({ payload }) {
  const currentRoster = yield select(getCurrentTeamRosterRecord)
  if (!currentRoster.lineups.get(constants.season.week)) {
    yield take(rosterActions.SET_LINEUPS)
  }
  const projectedContribution = {}
  const playerItems = yield select(getAllPlayers)
  const player = playerItems.get(payload.player)
  const playerData = yield call(calculatePlayerLineupContribution, { player })
  projectedContribution[player.player] = playerData
  yield put(playerActions.setProjectedContribution(projectedContribution))
}

export function * calculatePlayerLineupContribution ({ player }) {
  const currentRosterPlayers = yield select(getCurrentPlayers)
  const league = yield select(getCurrentLeague)
  const baselines = (yield select(getPlayers)).get('baselines')
  const playerItems = yield select(getAllPlayers)
  const currentRoster = yield select(getCurrentTeamRosterRecord)

  const playerData = {
    starts: 0,
    sp: 0,
    bp: 0,
    weeks: {}
  }

  // run lineup optimizer without player
  const isActive = currentRosterPlayers.active.find(p => p.player === player.player)
  const playerPool = isActive
    ? currentRosterPlayers.active.filter(p => p.player !== player.player)
    : currentRosterPlayers.active.push(player)
  const worker = new Worker()
  const result = yield call(worker.optimizeLineup, {
    players: playerPool.toJS(),
    league
  })

  for (const week in result) {
    const weekData = {
      start: 0,
      sp: 0,
      bp: 0
    }
    const currentProjectedWeek = currentRoster.lineups.get(week)
    const isStarter = isActive
      ? currentProjectedWeek.starters.includes(player.player)
      : result[week].starters.includes(player.player)

    if (isStarter) {
      playerData.starts += 1
      weekData.start = 1
      // starter+ is difference between current lineup and lineup without player
      const diff = isActive
        ? currentProjectedWeek.total - result[week].total
        : result[week].total - currentProjectedWeek.total
      playerData.sp += diff
      weekData.sp = diff
    } else {
      const baselinePlayerId = baselines.getIn([week, player.pos1, 'available'])
      const baselinePlayer = playerItems.get(baselinePlayerId)
      // bench+ is difference between player output and best available
      const diff = player.getIn(['points', week, 'total']) - baselinePlayer.getIn(['points', week, 'total'])
      if (diff > 0) {
        playerData.bp += diff
        weekData.bp = diff
      }
    }
    playerData.weeks[week] = weekData
  }

  return playerData
}

export function * projectLineups () {
  const league = yield select(getCurrentLeague)

  const rosters = yield select(getActivePlayersByRosterForCurrentLeague)
  const lineups = {}

  for (const [teamId, players] of rosters.entrySeq()) {
    lineups[teamId] = {}

    const worker = new Worker()
    lineups[teamId] = yield call(worker.optimizeLineup, {
      players: players.toJS(),
      league
    })
  }

  yield put(rosterActions.setLineupProjections(lineups))
  const currentRosterPlayers = yield select(getCurrentPlayers)

  const projectedContribution = {}
  for (const player of currentRosterPlayers.players) {
    const playerData = yield call(calculatePlayerLineupContribution, { player })
    projectedContribution[player.player] = playerData
  }

  yield put(playerActions.setProjectedContribution(projectedContribution))

  // TODO - calculate for poaches & waivers
}

export function * addPlayer ({ payload }) {
  const { leagueId } = yield select(getApp)
  yield call(postRosters, { leagueId, ...payload })
}

export function * removePlayer ({ payload }) {
  const { leagueId } = yield select(getApp)
  yield call(deleteRosters, { leagueId, ...payload })
}

export function * updatePlayer ({ payload }) {
  const { leagueId } = yield select(getApp)
  yield call(putRosters, { leagueId, ...payload })
}

export function * addFreeAgent ({ payload }) {
  const { leagueId, teamId } = yield select(getApp)
  yield call(postAddFreeAgent, { leagueId, teamId, ...payload })
}

export function * reserve ({ payload }) {
  const { leagueId, teamId } = yield select(getApp)
  yield call(postReserve, { leagueId, teamId, ...payload })
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

export function * watchRosterActivation () {
  yield takeLatest(rosterActions.ROSTER_ACTIVATION, projectLineups)
}

export function * watchRosterDeactivation () {
  yield takeLatest(rosterActions.ROSTER_DEACTIVATION, projectLineups)
}

export function * watchPostActivateFulfilled () {
  yield takeLatest(rosterActions.POST_ACTIVATE_FULFILLED, projectLineups)
}

export function * watchPostDeactivateFulfilled () {
  yield takeLatest(rosterActions.POST_DEACTIVATE_FULFILLED, projectLineups)
}

export function * watchAddPlayerRoster () {
  yield takeLatest(rosterActions.ADD_PLAYER_ROSTER, addPlayer)
}

export function * watchUpdatePlayerRoster () {
  yield takeLatest(rosterActions.UPDATE_PLAYER_ROSTER, updatePlayer)
}

export function * watchRemovePlayerRoster () {
  yield takeLatest(rosterActions.REMOVE_PLAYER_ROSTER, removePlayer)
}

export function * watchAddFreeAgent () {
  yield takeLatest(rosterActions.ADD_FREE_AGENT, addFreeAgent)
}

export function * watchSetRosterReserve () {
  yield takeLatest(rosterActions.SET_ROSTER_RESERVE, reserve)
}

export function * watchPlayersSelectPlayer () {
  yield takeLatest(playerActions.PLAYERS_SELECT_PLAYER, setPlayerLineupContribution)
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

  fork(watchPlayersSelectPlayer),

  fork(watchProjectLineups),
  fork(watchRosterActivation),
  fork(watchRosterDeactivation),
  fork(watchSetRosterReserve),
  fork(watchPostActivateFulfilled),
  fork(watchPostDeactivateFulfilled),

  fork(watchAddFreeAgent),

  fork(watchAddPlayerRoster),
  fork(watchRemovePlayerRoster),
  fork(watchUpdatePlayerRoster)
]
