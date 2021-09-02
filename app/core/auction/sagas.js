import {
  all,
  take,
  takeLatest,
  fork,
  select,
  delay,
  put,
  call
} from 'redux-saga/effects'

import { getApp } from '@core/app'
import { getAuction } from './selectors'
import { auctionActions } from './actions'
import { send } from '@core/ws'
import { getCurrentLeague } from '@core/leagues'
import {
  getRosteredPlayerIdsForCurrentLeague,
  getCurrentPlayers
} from '@core/rosters'
import {
  getPlayersForWatchlist,
  getAllPlayers,
  playerActions,
  getPlayers
} from '@core/players'
import { constants, getEligibleSlots } from '@common'
import { beep } from '@core/audio'
import Worker from 'workerize-loader?inline!../worker' // eslint-disable-line import/no-webpack-loader-syntax

export function* optimize() {
  const league = yield select(getCurrentLeague)
  const watchlist = yield select(getPlayersForWatchlist)
  const players = yield select(getAllPlayers)

  // make sure player values have been calculated
  const pState = yield select(getPlayers)
  const baselines = pState.get('baselines')
  if (!baselines.size) {
    return
  }

  const rosteredPlayerIds = yield select(getRosteredPlayerIdsForCurrentLeague)
  const availablePlayers = players.filter(
    (p) => !rosteredPlayerIds.includes(p.player)
  )
  const sortedPlayers = availablePlayers.sort(
    (a, b) => b.points.total - a.points.total
  )
  const sortedWatchlist = watchlist
    .filter((p) => !rosteredPlayerIds.includes(p.player))
    .sort((a, b) => b.points.total - a.points.total)
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

  // optimze lineup using current players and watchlist
  const worker = new Worker()
  let result = yield call(worker.optimizeAuctionLineup, {
    limits: defaultLimit,
    players: sortedWatchlist.valueSeq().toJS(),
    active: currentPlayers.active.toJS(),
    league
  })
  let starterPlayerIds = Object.keys(result).filter(
    (r) => r.match(/^([A-Z]{2,})-([0-9]{4,})$/gi) || r.match(/^([A-Z]{1,3})$/gi)
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
  if (starterPlayerIds.length < starterLimit) {
    const limits = {
      ...defaultLimit
    }
    for (const player of starterPlayerIds) {
      limits[player] = { min: 1 }
    }

    result = yield call(worker.optimizeLineup, {
      limits,
      players: sortedPlayers.valueSeq().toJS(),
      active: currentPlayers.active.toJS(),
      league
    })
  }
  worker.terminate()
  starterPlayerIds = Object.keys(result).filter(
    (r) => r.match(/^([A-Z]{2,})-([0-9]{4,})$/gi) || r.match(/^([A-Z]{1,3})$/gi)
  )
  yield put(
    auctionActions.setOptimalLineup({
      players: starterPlayerIds,
      ...result
    })
  )
}

export function* joinAuction({ type }) {
  const { leagueId, teamId } = yield select(getApp)
  const message = {
    type,
    payload: { lid: leagueId, tid: teamId }
  }
  send(message)
}

export function* releaseLock() {
  yield delay(1500)
  yield put(auctionActions.release())
}

export function* submitBid({ payload }) {
  const { userId, teamId } = yield select(getApp)
  const { player, bid } = yield select(getAuction)
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
      player,
      value
    }
  }
  send(message)
  yield call(releaseLock)
}

export function* submitNomination({ payload }) {
  const { userId, teamId } = yield select(getApp)
  const { selected } = yield select(getAuction)
  const { value } = payload
  const message = {
    type: auctionActions.AUCTION_SUBMIT_NOMINATION,
    payload: {
      userid: userId,
      tid: teamId,
      value,
      player: selected
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

export function* watchInitAuctionLineup() {
  while (true) {
    yield all([
      take(playerActions.FETCH_PLAYERS_FULFILLED),
      take(playerActions.SET_PLAYER_VALUES),
      take(auctionActions.AUCTION_JOIN)
    ])
    yield call(optimize)
  }
}

export function* watchToggleWatchlist() {
  yield takeLatest(playerActions.TOGGLE_WATCHLIST, optimize)
}

export function* watchSetAuctionBudget() {
  yield takeLatest(auctionActions.SET_AUCTION_BUDGET, optimize)
}

export function* watchAuctionPause() {
  yield takeLatest(auctionActions.AUCTION_PAUSE, pause)
}

export function* watchAuctionResume() {
  yield takeLatest(auctionActions.AUCTION_RESUME, resume)
}

export function* watchSetValueType() {
  yield takeLatest(auctionActions.SET_VALUE_TYPE, optimize)
}

export function* watchAuctionStart() {
  yield takeLatest(auctionActions.AUCTION_START, soundNotification)
}

export function* watchAuctionPaused() {
  yield takeLatest(auctionActions.AUCTION_PAUSED, soundNotification)
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
  fork(watchInitAuctionLineup),
  fork(watchToggleWatchlist),
  fork(watchSetAuctionBudget),
  fork(watchAuctionPause),
  fork(watchAuctionResume),
  fork(watchSetValueType),
  fork(watchAuctionStart),
  fork(watchAuctionPaused)
]
