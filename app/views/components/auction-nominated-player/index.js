import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  getAvailableSalarySpaceForCurrentLeague,
  get_auction_info_for_position,
  getPlayerById
} from '@core/selectors'

import AuctionNominatedPlayer from './auction-nominated-player'

const map_state_to_props = createSelector(
  getPlayerById,
  getAvailableSalarySpaceForCurrentLeague,
  get_auction_info_for_position,
  (player_map, league_available_salary_space, auction_info) => {
    const remaining_pts_added =
      auction_info.pts_added.total - auction_info.pts_added.rostered
    const rate = league_available_salary_space / remaining_pts_added
    const player_pts_added = player_map.getIn(['pts_added', '0'], 0)
    const market_salary_adjusted = Math.max(
      Math.round(player_pts_added * rate) || 0,
      0
    )

    return {
      player_map,
      market_salary_adjusted
    }
  }
)

export default connect(map_state_to_props)(AuctionNominatedPlayer)
