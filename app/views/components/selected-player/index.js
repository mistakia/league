import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { playerActions } from '@core/players'
import {
  getSelectedPlayer,
  get_app,
  getAvailableSalarySpaceForCurrentLeague,
  getAuctionInfoForPosition,
  getCurrentLeague
} from '@core/selectors'
import { getFreeAgentPeriod, constants } from '@libs-shared'

import SelectedPlayer from './selected-player'

const mapStateToProps = createSelector(
  getSelectedPlayer,
  get_app,
  getAvailableSalarySpaceForCurrentLeague,
  getAuctionInfoForPosition,
  getCurrentLeague,
  (playerMap, app, league_available_salary_space, auction_info, league) => {
    const remaining_pts_added =
      auction_info.pts_added.total - auction_info.pts_added.rostered
    const rate = league_available_salary_space / remaining_pts_added
    const player_pts_added = playerMap.getIn(['pts_added', '0'], 0)
    const market_salary_adjusted = Math.max(
      Math.round(player_pts_added * rate) || 0,
      0
    )

    const free_agency_period_dates = getFreeAgentPeriod(league)
    const is_before_live_auction_end =
      constants.season.now.isBefore(free_agency_period_dates.end) &&
      (free_agency_period_dates.free_agency_live_auction_end
        ? constants.season.now.isBefore(
            free_agency_period_dates.free_agency_live_auction_end
          )
        : true)

    return {
      playerMap,
      market_salary_adjusted,
      is_logged_in: Boolean(app.userId),
      is_hosted_league: Boolean(league.hosted),
      is_before_live_auction_end
    }
  }
)

const mapDispatchToProps = {
  deselect: playerActions.deselectPlayer,
  loadAllPlayers: playerActions.loadAllPlayers
}

export default connect(mapStateToProps, mapDispatchToProps)(SelectedPlayer)
