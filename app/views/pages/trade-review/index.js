import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_trade_review_state } from '@core/selectors'
import { trade_review_actions } from '@core/trade-review'

import TradeReviewPage from './trade-review'

const map_state_to_props = createSelector(
  get_trade_review_state,
  (trade_review) => ({
    trades: trade_review.get('trades'),
    is_pending: trade_review.get('is_pending')
  })
)

// Both names are verified against the actions module rather than trusted: a
// creator that does not exist is dropped silently by bindActionCreators, with
// no connect warning, no lint error and no build failure -- the symptom arrives
// only when a user fires the handler.
const map_dispatch_to_props = {
  load_trade_review: trade_review_actions.load_trade_review,
  load_trade_review_trade: trade_review_actions.load_trade_review_trade
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(TradeReviewPage)
