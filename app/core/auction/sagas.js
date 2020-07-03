import solver from 'javascript-lp-solver'
import { all, take, takeLatest, fork, select, delay, put, call } from 'redux-saga/effects'

import { getApp } from '@core/app'
import { getAuction } from './selectors'
import { auctionActions } from './actions'
import { send } from '@core/ws'
import { getCurrentLeague } from '@core/leagues'
import { getPlayersForWatchlist, getAllPlayers, playerActions } from '@core/players'
import { constants, getEligibleSlots } from '@common'

const getPositionSet = (players) => players.reduce((acc, e) => acc.set(e, (acc.get(e) || 0) + 1), new Map())

const optimizeLineup = ({ constraints, players }) => {
  const variables = {}
  const ints = {}

  for (const player of players.values()) {
    variables[player.player] = {
      points: Math.round(player.points.get('total') || 0),
      value: Math.round(player.values.get('hybrid') || 0),
      starter: 1
    }
    variables[player.player][player.player] = 1
    // variables[player.player][player.pos1] = 1
    if (constraints[player.player]) {
      constraints[player.player].max = 1
    } else {
      constraints[player.player] = { max: 1 }
    }
    ints[player.player] = 1
    for (const pos of constants.positions) {
      variables[player.player][pos] = player.pos1 === pos ? 1 : 0
    }
  }

  const model = {
    optimize: 'points',
    opType: 'max',
    constraints,
    variables,
    ints
  }

  return solver.Solve(model)
}

export function * optimize () {
  const auction = yield select(getAuction)
  const league = yield select(getCurrentLeague)
  const watchlist = yield select(getPlayersForWatchlist)
  const players = yield select(getAllPlayers)

  // TODO add signed players using signed value
  // TODO adjust budget based on available cap
  // TODO exclude unavailable players

  const sortedPlayers = players.sort((a, b) => b.points.total - a.points.total)
  const sortedWatchlist = watchlist.sort((a, b) => b.points.total - a.points.total)

  const rosterConstraints = {}
  for (const pos of constants.positions) {
    rosterConstraints[pos] = {
      max: getEligibleSlots({ pos, league }).length,
      min: league[`s${pos.toLowerCase()}`]
    }
  }

  const starterLimit = Object.keys(league)
    .filter(k => k.startsWith('s'))
    .map(k => league[k])
    .reduce((a, b) => a + b)

  const constraints = {
    value: { max: auction.lineupBudget },
    starter: { max: 0 }
  }

  const positions = watchlist.map(p => p.pos1)
  const positionSet = getPositionSet(positions)
  for (const [pos, min] of positionSet.entries()) {
    const posMin = Math.min(min, rosterConstraints[pos].min)
    constraints[pos] = rosterConstraints[pos]
    constraints[pos].min = posMin
    constraints.starter.max += posMin
  }

  // TODO add flexes

  let result = optimizeLineup({ constraints, players: sortedWatchlist })
  let selectedPlayers = Object.keys(result).filter(r => r.match(/^([A-Z]{2,})-([0-9]{4,})$/ig) || r.match(/^([A-Z]{1,3})$/ig))
  if (selectedPlayers.length < 10) {
    for (const player of selectedPlayers) {
      constraints[player] = { min: 1 }
    }
    result = optimizeLineup({
      constraints: { ...constraints, ...rosterConstraints, starter: { max: starterLimit } },
      players: sortedPlayers
    })
  }
  selectedPlayers = Object.keys(result).filter(r => r.match(/^([A-Z]{2,})-([0-9]{4,})$/ig) || r.match(/^([A-Z]{1,3})$/ig))
  yield put(auctionActions.setOptimalLineup({
    players: selectedPlayers,
    ...result
  }))
}

export function * joinAuction ({ type }) {
  const { leagueId, teamId } = yield select(getApp)
  const message = {
    type,
    payload: { lid: leagueId, tid: teamId }
  }
  send(message)
}

export function * releaseLock () {
  yield delay(1500)
  yield put(auctionActions.release())
}

export function * submitBid ({ payload }) {
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

export function * submitNomination ({ payload }) {
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

//= ====================================
//  WATCHERS
// -------------------------------------

export function * watchAuctionJoin () {
  yield takeLatest(auctionActions.AUCTION_JOIN, joinAuction)
}

export function * watchAuctionSubmitBid () {
  yield takeLatest(auctionActions.AUCTION_SUBMIT_BID, submitBid)
}

export function * watchAuctionSubmitNomination () {
  yield takeLatest(auctionActions.AUCTION_SUBMIT_NOMINATION, submitNomination)
}

export function * watchAuctionBid () {
  yield takeLatest(auctionActions.AUCTION_BID, releaseLock)
}

export function * watchInitAuctionLineup () {
  while (true) {
    yield all([
      take(playerActions.FETCH_PLAYERS_FULFILLED),
      take(playerActions.CALCULATE_VALUES),
      take(auctionActions.AUCTION_JOIN)
    ])
    yield call(optimize)
  }
}

export function * watchToggleWatchlist () {
  yield takeLatest(playerActions.TOGGLE_WATCHLIST, optimize)
}

export function * watchSetAuctionBudget () {
  yield takeLatest(auctionActions.SET_AUCTION_BUDGET, optimize)
}

//= ====================================
//  ROOT
// -------------------------------------

export const auctionSagas = [
  fork(watchAuctionJoin),
  fork(watchAuctionSubmitBid),
  fork(watchAuctionSubmitNomination),
  fork(watchAuctionBid),
  fork(watchInitAuctionLineup),
  fork(watchToggleWatchlist),
  fork(watchSetAuctionBudget)
]
