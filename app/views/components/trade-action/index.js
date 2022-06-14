import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getCurrentLeague } from '@core/leagues'
import { tradeActions, getCurrentTrade, getTradeIsValid } from '@core/trade'
import { getApp } from '@core/app'

import TradeAction from './trade-action'

const mapStateToProps = createSelector(
  getCurrentLeague,
  getCurrentTrade,
  getTradeIsValid,
  getApp,
  (league, trade, isValid, app) => ({
    league,
    trade,
    isValid,
    isProposer: trade.propose_tid === app.teamId
  })
)

const mapDispatchToProps = {
  propose: tradeActions.propose,
  accept: tradeActions.accept,
  reject: tradeActions.reject,
  cancel: tradeActions.cancel
}

export default connect(mapStateToProps, mapDispatchToProps)(TradeAction)
