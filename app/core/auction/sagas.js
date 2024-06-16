import { takeLatest, fork, select, delay, put, call } from 'redux-saga/effects'

import {
  get_player_maps,
  getPlayers,
  get_app,
  getAuction,
  getCurrentLeague,
  getRosteredPlayerIdsForCurrentLeague,
  getCurrentPlayers,
  getPlayersForWatchlist
} from '@core/selectors'
import { auctionActions } from './actions'
import { send } from '@core/ws'
import { constants, getEligibleSlots } from '@libs-shared'
import { beep } from '@core/audio'

export function* optimize() {
  const league = yield select(getCurrentLeague)
  const watchlist = yield select(getPlayersForWatchlist)

  // make sure player values have been calculated
  const pState = yield select(getPlayers)
  const baselines = pState.get('baselines')
  if (!baselines.size) {
    return
  }

  const rostered_pids = yield select(getRosteredPlayerIdsForCurrentLeague)
  const sortedWatchlist = watchlist
    .filter((pMap) => !rostered_pids.includes(pMap.get('pid')))
    .sort(
      (a, b) =>
        b.getIn(['points', 'total'], 0) - a.getIn(['points', 'total'], 0)
    )
  const currentPlayers = yield select(getCurrentPlayers)

  const defaultLimit = {
    fa: {
      max: currentPlayers.roster.availableSpace
    },
    value: {
      // TODO - adjust based on bench depth
      max: Math.min(currentPlayers.roster.availableCap, league.cap * 0.8)
    }
  }

  const formatAuctionPlayer = (playerMap) => ({
    pid: playerMap.get('pid'),
    pos: playerMap.get('pos'),
    market_salary: playerMap.getIn(['market_salary', '0'], 0),
    points: playerMap.getIn(['points', '0', 'total'], 0)
  })

  // optimze lineup using current players and watchlist
  const { default: Worker } = yield call(
    () => import('workerize-loader?inline!../worker') // eslint-disable-line import/no-webpack-loader-syntax
  )
  const worker = new Worker()
  let result = yield call(worker.optimizeAuctionLineup, {
    limits: defaultLimit,
    players: sortedWatchlist.map(formatAuctionPlayer).toJS(),
    active: currentPlayers.active.map(formatAuctionPlayer).toJS(),
    league
  })
  let starter_pids = Object.keys(result).filter(
    (r) =>
      r.match(constants.player_pid_regex) || r.match(constants.team_pid_regex)
  )

  const rosterConstraints = {}
  for (const pos of constants.positions) {
    rosterConstraints[pos] = {
      max: getEligibleSlots({ pos, league }).length,
      min: league[`s${pos.toLowerCase()}`]
    }
  }

  const starterLimit = Object.keys(league)
    .filter((k) => k.startsWith('s'))
    .map((k) => league[k])
    .reduce((a, b) => a + b)

  // if lineup incomplete, optimize with available players
  if (starter_pids.length < starterLimit) {
    const limits = {
      ...defaultLimit
    }
    for (const pid of starter_pids) {
      limits[pid] = { min: 1 }
    }

    const playerMaps = yield select(get_player_maps)
    const availablePlayers = playerMaps
      .filter((pMap) => !rostered_pids.includes(pMap.get('pid')))
      .sort(
        (a, b) =>
          b.getIn(['points', 'total'], 0) - a.getIn(['points', 'total'], 0)
      )
      .toList()

    result = yield call(worker.optimizeAuctionLineup, {
      limits,
      players: availablePlayers.map(formatAuctionPlayer).toJS(),
      active: currentPlayers.active.map(formatAuctionPlayer).toJS(),
      league
    })
  }
  worker.terminate()
  starter_pids = Object.keys(result).filter(
    (r) =>
      r.match(constants.player_pid_regex) || r.match(constants.team_pid_regex)
  )
  yield put(
    auctionActions.setOptimalLineup({
      pids: starter_pids,
      ...result
    })
  )
}

export function* joinAuction({ type }) {
  const { leagueId, teamId, clientId } = yield select(get_app)
  const message = {
    type,
    payload: { lid: leagueId, tid: teamId, clientId }
  }
  send(message)
}

export function* releaseLock() {
  yield delay(1500)
  yield put(auctionActions.release())
}

export function* submitBid({ payload }) {
  const { userId, teamId } = yield select(get_app)
  const { nominated_pid, bid } = yield select(getAuction)
  if (payload.value <= bid) {
    yield put(auctionActions.release())
    // TODO notify user
    return
  }

  const { value } = payload

  const message = {
    type: auctionActions.AUCTION_BID,
    payload: {
      userid: userId,
      tid: teamId,
      pid: nominated_pid,
      value
    }
  }
  send(message)
  yield call(releaseLock)
}

export function* submitNomination({ payload }) {
  const { userId, teamId } = yield select(get_app)
  const { selected_pid } = yield select(getAuction)
  const { value } = payload
  const message = {
    type: auctionActions.AUCTION_SUBMIT_NOMINATION,
    payload: {
      userid: userId,
      tid: teamId,
      value,
      pid: selected_pid
    }
  }
  send(message)
}

export function resume() {
  send({ type: auctionActions.AUCTION_RESUME })
}

export function pause() {
  send({ type: auctionActions.AUCTION_PAUSE })
}

export function* soundNotification() {
  const { muted } = yield select(getAuction)
  if (!muted) {
    beep()
  }
}

export function toggle_pause_on_team_disconnect() {
  send({ type: auctionActions.AUCTION_TOGGLE_PAUSE_ON_TEAM_DISCONNECT })
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchAuctionJoin() {
  yield takeLatest(auctionActions.AUCTION_JOIN, joinAuction)
}

export function* watchAuctionSubmitBid() {
  yield takeLatest(auctionActions.AUCTION_SUBMIT_BID, submitBid)
}

export function* watchAuctionSubmitNomination() {
  yield takeLatest(auctionActions.AUCTION_SUBMIT_NOMINATION, submitNomination)
}

export function* watchAuctionBid() {
  yield takeLatest(auctionActions.AUCTION_BID, releaseLock)
}

/* export function* watchInitAuctionLineup() {
 *   while (true) {
 *     yield all([
 *       take(playerActions.FETCH_ALL_PLAYERS_FULFILLED),
 *       take(auctionActions.AUCTION_JOIN)
 *     ])
 *     yield call(optimize)
 *   }
 * }
 *  */
/* export function* watchToggleWatchlist() {
 *   yield takeLatest(playerActions.TOGGLE_WATCHLIST, optimize)
 * }
 *
 * export function* watchSetAuctionBudget() {
 *   yield takeLatest(auctionActions.SET_AUCTION_BUDGET, optimize)
 * }
 *  */
export function* watchAuctionPause() {
  yield takeLatest(auctionActions.AUCTION_PAUSE, pause)
}

export function* watchAuctionResume() {
  yield takeLatest(auctionActions.AUCTION_RESUME, resume)
}

export function* watchAuctionStart() {
  yield takeLatest(auctionActions.AUCTION_START, soundNotification)
}

export function* watchAuctionPaused() {
  yield takeLatest(auctionActions.AUCTION_PAUSED, soundNotification)
}

export function* watchAuctionTogglePauseOnTeamDisconnect() {
  yield takeLatest(
    auctionActions.AUCTION_TOGGLE_PAUSE_ON_TEAM_DISCONNECT,
    toggle_pause_on_team_disconnect
  )
}

//= ====================================
//  ROOT
// -------------------------------------

// TODO - auto rejoin auction on websocket reconnection
export const auctionSagas = [
  fork(watchAuctionJoin),
  fork(watchAuctionSubmitBid),
  fork(watchAuctionSubmitNomination),
  fork(watchAuctionBid),
  // fork(watchInitAuctionLineup),
  // fork(watchToggleWatchlist),
  // fork(watchSetAuctionBudget),
  fork(watchAuctionPause),
  fork(watchAuctionResume),
  fork(watchAuctionStart),
  fork(watchAuctionPaused),
  fork(watchAuctionTogglePauseOnTeamDisconnect)
]
