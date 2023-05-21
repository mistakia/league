import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { tradeActions } from '@core/trade'
import {
  get_app,
  getCurrentLeague,
  getCurrentTrade,
  getTradeIsValid
} from '@core/selectors'

import TradeAction from './trade-action'

const mapStateToProps = createSelector(
  getCurrentLeague,
  getCurrentTrade,
  getTradeIsValid,
  get_app,
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
