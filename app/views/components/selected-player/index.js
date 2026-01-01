import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { player_actions } from '@core/players'
import { current_season } from '@constants'
import {
  getSelectedPlayer,
  get_app,
  getAvailableSalarySpaceForCurrentLeague,
  get_auction_info_for_position,
  get_current_league,
  get_player_seasonlogs_for_selected_player
} from '@core/selectors'
import { get_free_agent_period } from '@libs-shared'

import SelectedPlayer from './selected-player'

const map_state_to_props = createSelector(
  getSelectedPlayer,
  get_app,
  getAvailableSalarySpaceForCurrentLeague,
  get_auction_info_for_position,
  get_current_league,
  get_player_seasonlogs_for_selected_player,
  (
    player_map,
    app,
    league_available_salary_space,
    auction_info,
    league,
    player_seasonlogs
  ) => {
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
      current_season.now.isBefore(free_agency_period_dates.end) &&
      (free_agency_period_dates.free_agency_live_auction_end
        ? current_season.now.isBefore(
            free_agency_period_dates.free_agency_live_auction_end
          )
        : true)

    return {
      player_map,
      player_seasonlogs,
      market_salary_adjusted,
      is_logged_in: Boolean(app.userId),
      is_hosted_league: Boolean(league.hosted),
      is_before_live_auction_end
    }
  }
)

const map_dispatch_to_props = {
  deselect: player_actions.deselect_player,
  load_all_players: player_actions.load_all_players,
  load_player_seasonlogs: player_actions.load_player_seasonlogs
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(SelectedPlayer)
