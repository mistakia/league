import { call, takeLatest, fork, select } from 'redux-saga/effects'

import { get_app, get_trade, get_trade_selected_team_id } from '@core/selectors'
import { trade_actions } from './actions'
import {
  api_post_propose_trade,
  api_post_accept_trade,
  api_post_cancel_trade,
  api_post_reject_trade,
  api_get_trades
} from '@core/api'

export function* propose() {
  const { teamId, leagueId } = yield select(get_app)
  const accept_tid = yield select(get_trade_selected_team_id)
  const trade = yield select(get_trade)

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
  yield call(api_post_propose_trade, params)
}

export function* load() {
  const { teamId, leagueId } = yield select(get_app)
  yield call(api_get_trades, { leagueId, teamId })
}

export function* cancel() {
  const { selectedTradeId } = yield select(get_trade)
  const { leagueId } = yield select(get_app)
  yield call(api_post_cancel_trade, { leagueId, tradeId: selectedTradeId })
}

export function* reject() {
  const { selectedTradeId } = yield select(get_trade)
  const { leagueId } = yield select(get_app)
  yield call(api_post_reject_trade, { leagueId, tradeId: selectedTradeId })
}

export function* accept() {
  const { teamId, leagueId } = yield select(get_app)
  const { selectedTradeId } = yield select(get_trade)
  const trade = yield select(get_trade)
  const releasePlayers = trade.releasePlayers.toJS()
  yield call(api_post_accept_trade, {
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
  yield takeLatest(trade_actions.PROPOSE_TRADE, propose)
}

export function* watchLoadTrades() {
  yield takeLatest(trade_actions.LOAD_TRADES, load)
}

export function* watchCancelTrade() {
  yield takeLatest(trade_actions.CANCEL_TRADE, cancel)
}

export function* watchAcceptTrade() {
  yield takeLatest(trade_actions.ACCEPT_TRADE, accept)
}

export function* watchRejectTrade() {
  yield takeLatest(trade_actions.REJECT_TRADE, reject)
}

//= ====================================
//  ROOT
// -------------------------------------

export const trade_sagas = [
  fork(watchProposeTrade),
  fork(watchLoadTrades),
  fork(watchCancelTrade),
  fork(watchAcceptTrade),
  fork(watchRejectTrade)
]
