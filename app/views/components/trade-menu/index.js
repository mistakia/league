import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getTrade, tradeActions } from '@core/trade'

import TradeMenu from './trade-menu'

const mapStateToProps = createSelector(
  getTrade,
  (trade) => ({
    trades: trade.items,
    selectedTradeId: trade.selectedTradeId
  })
)

const mapDispatchToProps = {
  select: tradeActions.selectTrade
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(TradeMenu)
