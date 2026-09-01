import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  get_auction_state,
  get_teams_for_current_league
} from '@core/selectors'

import AuctionSettlementStatus from './auction-settlement-status'

const map_state_to_props = createSelector(
  get_auction_state,
  get_teams_for_current_league,
  (auction, teams) => ({
    auction_mode: auction.auction_mode,
    // Team ids, resolved to names here rather than on the server. Outstanding
    // teams are NAMED, not counted: a count tells nobody who to nudge, and the
    // nudge is the only forcing function election mode has.
    outstanding_election_tids: auction.outstanding_election_tids,
    teams_by_id: teams,
    nominated_pid: auction.nominated_pid
  })
)

export default connect(map_state_to_props)(AuctionSettlementStatus)
