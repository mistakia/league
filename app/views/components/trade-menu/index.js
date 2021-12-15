import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getTrade, tradeActions } from '@core/trade'
import { getApp } from '@core/app'

import TradeMenu from './trade-menu'

const mapStateToProps = createSelector(getTrade, getApp, (trade, app) => ({
  trades: trade.items.sort((a, b) => b.uid - a.uid),
  selectedTradeId: trade.selectedTradeId,
  teamId: app.teamId
}))

const mapDispatchToProps = {
  select: tradeActions.selectTrade
}

export default connect(mapStateToProps, mapDispatchToProps)(TradeMenu)
