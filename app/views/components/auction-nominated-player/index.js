import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayerById } from '@core/players'
import { getAvailableSalarySpaceForCurrentLeague } from '@core/rosters'
import { getAuctionInfoForPosition } from '@core/auction'

import AuctionNominatedPlayer from './auction-nominated-player'

const mapStateToProps = createSelector(
  getPlayerById,
  getAvailableSalarySpaceForCurrentLeague,
  getAuctionInfoForPosition,
  (playerMap, league_available_salary_space, auction_info) => {
    const remaining_vorp = auction_info.vorp.total - auction_info.vorp.rostered
    const rate = league_available_salary_space / remaining_vorp
    const player_vorp = playerMap.getIn(['vorp', '0'], 0)
    const market_salary_adjusted = Math.round(player_vorp * rate) || 0

    return {
      playerMap,
      market_salary_adjusted
    }
  }
)

export default connect(mapStateToProps)(AuctionNominatedPlayer)
