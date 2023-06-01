import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  getAvailableSalarySpaceForCurrentLeague,
  getAuctionInfoForPosition,
  getPlayerById
} from '@core/selectors'

import AuctionNominatedPlayer from './auction-nominated-player'

const mapStateToProps = createSelector(
  getPlayerById,
  getAvailableSalarySpaceForCurrentLeague,
  getAuctionInfoForPosition,
  (playerMap, league_available_salary_space, auction_info) => {
    const remaining_pts_added =
      auction_info.pts_added.total - auction_info.pts_added.rostered
    const rate = league_available_salary_space / remaining_pts_added
    const player_pts_added = playerMap.getIn(['pts_added', '0'], 0)
    const market_salary_adjusted = Math.max(
      Math.round(player_pts_added * rate) || 0,
      0
    )

    return {
      playerMap,
      market_salary_adjusted
    }
  }
)

export default connect(mapStateToProps)(AuctionNominatedPlayer)
