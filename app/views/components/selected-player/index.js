import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { player_actions } from '@core/players'
import {
  getSelectedPlayer,
  get_app,
  getAvailableSalarySpaceForCurrentLeague,
  get_auction_info_for_position,
  get_current_league
} from '@core/selectors'
import { get_free_agent_period, constants } from '@libs-shared'

import SelectedPlayer from './selected-player'

const map_state_to_props = createSelector(
  getSelectedPlayer,
  get_app,
  getAvailableSalarySpaceForCurrentLeague,
  get_auction_info_for_position,
  get_current_league,
  (player_map, app, league_available_salary_space, auction_info, league) => {
    const remaining_pts_added =
      auction_info.pts_added.total - auction_info.pts_added.rostered
    const rate = league_available_salary_space / remaining_pts_added
    const player_pts_added = player_map.getIn(['pts_added', '0'], 0)
    const market_salary_adjusted = Math.max(
      Math.round(player_pts_added * rate) || 0,
      0
    )

    const free_agency_period_dates = get_free_agent_period(league)
    const is_before_live_auction_end =
      constants.season.now.isBefore(free_agency_period_dates.end) &&
      (free_agency_period_dates.free_agency_live_auction_end
        ? constants.season.now.isBefore(
            free_agency_period_dates.free_agency_live_auction_end
          )
        : true)

    return {
      player_map,
      market_salary_adjusted,
      is_logged_in: Boolean(app.userId),
      is_hosted_league: Boolean(league.hosted),
      is_before_live_auction_end
    }
  }
)

const map_dispatch_to_props = {
  deselect: player_actions.deselect_player,
  load_all_players: player_actions.load_all_players
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(SelectedPlayer)
