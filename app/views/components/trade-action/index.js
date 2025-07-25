import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { trade_actions } from '@core/trade'
import {
  get_app,
  get_current_league,
  get_current_trade,
  get_trade_is_valid
} from '@core/selectors'

import TradeAction from './trade-action'

const map_state_to_props = createSelector(
  get_current_league,
  get_current_trade,
  get_trade_is_valid,
  get_app,
  (league, trade, isValid, app) => ({
    league,
    trade,
    isValid,
    isProposer: trade.propose_tid === app.teamId
  })
)

const map_dispatch_to_props = {
  propose: trade_actions.propose,
  accept: trade_actions.accept,
  reject: trade_actions.reject,
  cancel: trade_actions.cancel
}

export default connect(map_state_to_props, map_dispatch_to_props)(TradeAction)
