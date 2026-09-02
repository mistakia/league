import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_auction_state, get_app } from '@core/selectors'
import { auction_actions } from '@core/auction'

import AuctionBlockCalendar from './auction-block-calendar'

const map_state_to_props = createSelector(
  get_auction_state,
  get_app,
  (auction, app) => ({
    live_blocks: auction.live_blocks,
    block_eligible_tids: auction.block_eligible_tids,
    final_block_at: auction.final_block_at,
    final_block_spots_remaining: auction.final_block_spots_remaining,
    free_agency_period_start: auction.free_agency_period_start,
    free_agency_period_end: auction.free_agency_period_end,
    auction_block_notice_minutes: auction.auction_block_notice_minutes,
    teamId: app.teamId,
    leagueId: app.leagueId
  })
)

const map_dispatch_to_props = {
  set_auction_block_opt_in: auction_actions.set_auction_block_opt_in
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(AuctionBlockCalendar)
