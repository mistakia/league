import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_auction_state, get_app } from '@core/selectors'
import { auction_actions } from '@core/auction'

import AuctionPassButton from './auction-pass-button'

const map_state_to_props = createSelector(
  get_auction_state,
  get_app,
  (auction, app) => ({
    nominated_pid: auction.nominated_pid,
    is_slow_mode: auction.is_slow_mode,
    user_has_passed_current_auction_nomination:
      auction.slow_mode_state &&
      auction.slow_mode_state.passed_teams &&
      auction.slow_mode_state.passed_teams.includes(app.teamId)
  })
)

const map_dispatch_to_props = {
  pass_nomination: auction_actions.pass_nomination
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(AuctionPassButton)
