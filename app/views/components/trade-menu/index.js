import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { trade_actions } from '@core/trade'
import {
  get_app,
  get_current_league,
  get_is_commish,
  get_trade,
  get_veto_candidate_trades
} from '@core/selectors'

import TradeMenu from './trade-menu'

const map_state_to_props = createSelector(
  get_trade,
  get_app,
  get_current_league,
  get_is_commish,
  get_veto_candidate_trades,
  (trade, app, league, is_commish, veto_candidate_trades) => ({
    trades: trade.items.sort((a, b) => b.trade_id - a.trade_id),
    selectedTradeId: trade.selectedTradeId,
    teamId: app.teamId,
    league,
    is_commish,
    veto_candidate_trades
  })
)

const map_dispatch_to_props = {
  select: trade_actions.select_trade
}

export default connect(map_state_to_props, map_dispatch_to_props)(TradeMenu)
