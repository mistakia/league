import { takeLatest, fork, select, delay, put, call } from 'redux-saga/effects'

import { getApp } from '@core/app'
import { getAuction } from './selectors'
import { auctionActions } from './actions'
import { send } from '@core/ws'

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

//= ====================================
//  ROOT
// -------------------------------------

export const auctionSagas = [
  fork(watchAuctionJoin),
  fork(watchAuctionSubmitBid),
  fork(watchAuctionSubmitNomination),
  fork(watchAuctionBid)
]
