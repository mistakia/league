import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { trade_actions } from '@core/trade'
import { get_app, get_trade } from '@core/selectors'

import TradeMenu from './trade-menu'

const map_state_to_props = createSelector(get_trade, get_app, (trade, app) => ({
  trades: trade.items.sort((a, b) => b.uid - a.uid),
  selectedTradeId: trade.selectedTradeId,
  teamId: app.teamId
}))

const map_dispatch_to_props = {
  select: trade_actions.select_trade
}

export default connect(map_state_to_props, map_dispatch_to_props)(TradeMenu)
