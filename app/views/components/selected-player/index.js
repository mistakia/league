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

    const faPeriod = getFreeAgentPeriod(league)
    const is_before_end_of_free_agent_period = constants.season.now.isBefore(
      faPeriod.end
    )

    return {
      playerMap,
      market_salary_adjusted,
      is_logged_in: Boolean(app.userId),
      is_before_end_of_free_agent_period
    }
  }
)

const mapDispatchToProps = {
  deselect: playerActions.deselectPlayer,
  loadAllPlayers: playerActions.loadAllPlayers
}

export default connect(mapStateToProps, mapDispatchToProps)(SelectedPlayer)
