import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  getAvailableSalarySpaceForCurrentLeague,
  get_auction_info_for_position
} from '@core/selectors'

import PlayerAuctionValue from './player-auction-value'

// THE LIVE AUCTION PRICE: what the player costs given the cap space and the
// value still on the board right now, which is why it moves as the auction
// proceeds. Distinct from the persisted
// projected_positive_salary_at_available_cap, which is the same question
// answered at cron time.
//
// COMPUTED ONCE, HERE. Both call sites -- the auction bar and the
// selected-player drawer -- carried their own copy of this arithmetic in their
// own connect(), and a copy of a formula in two files is a copy that drifts.
// The component owns the number it renders.
const map_state_to_props = createSelector(
  (state, { player_map }) => player_map,
  getAvailableSalarySpaceForCurrentLeague,
  get_auction_info_for_position,
  (player_map, league_available_salary_space, auction_info) => {
    const remaining_pts_added =
      auction_info.pts_added.total - auction_info.pts_added.rostered
    const rate = league_available_salary_space / remaining_pts_added
    const player_pts_added = player_map.getIn(['pts_added', 'season'], 0)

    return {
      auction_adjusted_salary: Math.max(
        Math.round(player_pts_added * rate) || 0,
        0
      ),
      market_salary: player_map.getIn(['market_salary', 'season'], 0)
    }
  }
)

export default connect(map_state_to_props)(PlayerAuctionValue)
