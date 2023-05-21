import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { tradeActions } from '@core/trade'
import { get_app, getTrade } from '@core/selectors'

import TradeMenu from './trade-menu'

const mapStateToProps = createSelector(getTrade, get_app, (trade, app) => ({
  trades: trade.items.sort((a, b) => b.uid - a.uid),
  selectedTradeId: trade.selectedTradeId,
  teamId: app.teamId
}))

const mapDispatchToProps = {
  select: tradeActions.selectTrade
}

export default connect(mapStateToProps, mapDispatchToProps)(TradeMenu)
