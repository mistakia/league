import { call, takeLatest, fork, select } from 'redux-saga/effects'

import { get_app, getTrade, getTradeSelectedTeamId } from '@core/selectors'
import { tradeActions } from './actions'
import {
  postProposeTrade,
  postAcceptTrade,
  postCancelTrade,
  postRejectTrade,
  getTrades
} from '@core/api'

export function* propose() {
  const { teamId, leagueId } = yield select(get_app)
  const accept_tid = yield select(getTradeSelectedTeamId)
  const trade = yield select(getTrade)

  const params = {
    proposingTeamPlayers: trade.proposingTeamPlayers.toJS(),
    acceptingTeamPlayers: trade.acceptingTeamPlayers.toJS(),
    proposingTeamPicks: trade.proposingTeamPicks.toJS(),
    acceptingTeamPicks: trade.acceptingTeamPicks.toJS(),
    releasePlayers: trade.releasePlayers.toJS(),
    propose_tid: teamId,
    accept_tid,
    leagueId
  }
  yield call(postProposeTrade, params)
}

export function* load() {
  const { teamId, leagueId } = yield select(get_app)
  yield call(getTrades, { leagueId, teamId })
}

export function* cancel() {
  const { selectedTradeId } = yield select(getTrade)
  const { leagueId } = yield select(get_app)
  yield call(postCancelTrade, { leagueId, tradeId: selectedTradeId })
}

export function* reject() {
  const { selectedTradeId } = yield select(getTrade)
  const { leagueId } = yield select(get_app)
  yield call(postRejectTrade, { leagueId, tradeId: selectedTradeId })
}

export function* accept() {
  const { teamId, leagueId } = yield select(get_app)
  const { selectedTradeId } = yield select(getTrade)
  const trade = yield select(getTrade)
  const releasePlayers = trade.releasePlayers.toJS()
  yield call(postAcceptTrade, {
    teamId,
    leagueId,
    releasePlayers,
    tradeId: selectedTradeId
  })
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchProposeTrade() {
  yield takeLatest(tradeActions.PROPOSE_TRADE, propose)
}

export function* watchLoadTrades() {
  yield takeLatest(tradeActions.LOAD_TRADES, load)
}

export function* watchCancelTrade() {
  yield takeLatest(tradeActions.CANCEL_TRADE, cancel)
}

export function* watchAcceptTrade() {
  yield takeLatest(tradeActions.ACCEPT_TRADE, accept)
}

export function* watchRejectTrade() {
  yield takeLatest(tradeActions.REJECT_TRADE, reject)
}

//= ====================================
//  ROOT
// -------------------------------------

export const tradeSagas = [
  fork(watchProposeTrade),
  fork(watchLoadTrades),
  fork(watchCancelTrade),
  fork(watchAcceptTrade),
  fork(watchRejectTrade)
]
