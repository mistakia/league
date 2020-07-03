import { all, take, takeLatest, fork, select, delay, put, call } from 'redux-saga/effects'

import { getApp } from '@core/app'
import { getAuction } from './selectors'
import { auctionActions } from './actions'
import { send } from '@core/ws'
import { getCurrentLeague } from '@core/leagues'
import { getPlayersForWatchlist, getAllPlayers, playerActions } from '@core/players'
import { constants, getEligibleSlots } from '@common'
import Worker from 'workerize-loader?inline!./worker' // eslint-disable-line import/no-webpack-loader-syntax

const getPositionSet = (players) => players.reduce((acc, e) => acc.set(e, (acc.get(e) || 0) + 1), new Map())

export function * optimize () {
  const auction = yield select(getAuction)
  const league = yield select(getCurrentLeague)
  const watchlist = yield select(getPlayersForWatchlist)
  const players = yield select(getAllPlayers)
  const { vbaseline } = yield select(getApp)

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
    constraints[pos] = Object.assign({}, rosterConstraints[pos])
    constraints[pos].min = posMin
    constraints.starter.max += posMin
    positionSet.set(pos, Math.max((min - rosterConstraints[pos].min), 0))
  }

  const processFlex = (positions, flexCount) => {
    const pos = positions.shift()
    const posCount = positionSet.get(pos)
    if (!posCount) {
      if (positions.length) processFlex(positions, flexCount)
      return
    }

    positionSet.set(pos, Math.max((posCount - flexCount), 0))
    const min = Math.min(posCount, flexCount)
    constraints.starter.max += min
    if (min < flexCount && positions.length) processFlex(positions, flexCount)
  }

  if (league.srbwr) {
    processFlex(['RB', 'WR'], league.srbwr)
  }

  if (league.swrte) {
    processFlex(['WR', 'TE'], league.swrte)
  }

  if (league.srbwrte) {
    processFlex(['RB', 'WR', 'TE'], league.srbwrte)
  }

  if (league.sqbrbwrte) {
    processFlex(['QB', 'RB', 'WR', 'TE'], league.sqbrbwrte)
  }

  const worker = new Worker()
  let result = yield call(worker.optimizeLineup, {
    constraints,
    vbaseline,
    players: sortedWatchlist.valueSeq().toJS()
  })
  let selectedPlayers = Object.keys(result)
    .filter(r => r.match(/^([A-Z]{2,})-([0-9]{4,})$/ig) || r.match(/^([A-Z]{1,3})$/ig))
  if (selectedPlayers.length < 10) {
    for (const player of selectedPlayers) {
      constraints[player] = { min: 1 }
    }
    result = yield call(worker.optimizeLineup, {
      constraints: { ...constraints, ...rosterConstraints, starter: { max: starterLimit } },
      vbaseline,
      players: sortedPlayers.valueSeq().toJS()
    })
  }
  selectedPlayers = Object.keys(result)
    .filter(r => r.match(/^([A-Z]{2,})-([0-9]{4,})$/ig) || r.match(/^([A-Z]{1,3})$/ig))
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
      take(playerActions.SET_PLAYER_VALUES),
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
