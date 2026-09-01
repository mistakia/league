import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { player_actions } from '@core/players'
import { current_season } from '#constants'
import {
  getSelectedPlayer,
  get_app,
  getAvailableSalarySpaceForCurrentLeague,
  get_auction_info_for_position,
  get_current_league,
  get_player_seasonlogs_for_selected_player,
  is_free_agent_period
} from '@core/selectors'
import { get_free_agent_period } from '#libs-shared'

import SelectedPlayer from './selected-player'

const map_state_to_props = createSelector(
  getSelectedPlayer,
  get_app,
  getAvailableSalarySpaceForCurrentLeague,
  get_auction_info_for_position,
  get_current_league,
  get_player_seasonlogs_for_selected_player,
  is_free_agent_period,
  (
    player_map,
    app,
    league_available_salary_space,
    auction_info,
    league,
    player_seasonlogs,
    is_in_free_agent_period
  ) => {
    const remaining_pts_added =
      auction_info.pts_added.total - auction_info.pts_added.rostered
    const rate = league_available_salary_space / remaining_pts_added
    const player_pts_added = player_map.getIn(['pts_added', 'season'], 0)
    // The LIVE auction price: what the player costs given the cap space and
    // value still on the board right now. Distinct from the persisted
    // projected_positive_salary_at_available_cap, which is the same question answered at cron time.
    const auction_adjusted_salary = Math.max(
      Math.round(player_pts_added * rate) || 0,
      0
    )

    const free_agency_period_dates = get_free_agent_period(league)
    // The auction concludes when the free agency period does, so one
    // comparison replaces the pair.
    const is_before_live_auction_end = current_season.now.isBefore(
      free_agency_period_dates.end
    )

    return {
      player_map,
      player_seasonlogs,
      auction_adjusted_salary,
      is_logged_in: Boolean(app.userId),
      is_hosted_league: Boolean(league.is_hosted),
      is_before_live_auction_end,
      // An election is accepted on any UNROSTERED player at any point in the
      // free agency period. This drawer is reachable from every player list in
      // the app, which is what makes "any free agent" true without reworking
      // six list layouts -- so this gate is the whole reach of pre-stating.
      can_elect_on_player: is_in_free_agent_period && !player_map.get('tid')
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
