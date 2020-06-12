import { call, takeLatest, fork, select } from 'redux-saga/effects'

import { getApp } from '@core/app'
import { auctionActions } from './actions'
import { send, wsActions } from '@core/ws'

export function * joinAuction ({ type }) {
  const { leagueId, teamId } = yield select(getApp)
  const message = {
    type,
    payload: { lid: leagueId, tid: teamId }
  }
  send(message)
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function * watchAuctionJoin () {
  yield takeLatest(auctionActions.AUCTION_JOIN, joinAuction)
}


//= ====================================
//  ROOT
// -------------------------------------

export const auctionSagas = [
  fork(watchAuctionJoin)
]
