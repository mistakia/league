import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  get_app,
  get_restricted_free_agency_players,
  get_cutlist_players,
  get_current_league,
  get_current_players_for_league,
  is_before_restricted_free_agency_end,
  get_waiver_players_for_current_team,
  get_poach_players_for_current_league,
  get_teams_for_current_league
} from '@core/selectors'
import { player_actions } from '@core/players'
import { draft_pick_value_actions } from '@core/draft-pick-value'
import { transactions_actions } from '@core/transactions'
import { team_actions } from '@core/teams'
import { roster_actions } from '@core/rosters'
import { calculatePercentiles } from '@libs-shared'

import LeagueHomePage from './league-home'

const map_state_to_props = createSelector(
  get_app,
  get_restricted_free_agency_players,
  get_current_players_for_league,
  get_cutlist_players,
  get_current_league,
  get_waiver_players_for_current_team,
  get_poach_players_for_current_league,
  is_before_restricted_free_agency_end,
  get_teams_for_current_league,
  (
    app,
    restricted_free_agency_players,
    players,
    cutlist,
    league,
    waivers,
    poaches,
    is_before_restricted_free_agency_end,
    teams
  ) => {
    const items = []
    restricted_free_agency_players.forEach((p) => {
      items.push({
        market_salary: p.getIn(['market_salary', '0'], 0),
        pts_added: p.getIn(['pts_added', '0'], 0),
        salary_adj_pts_added: p.getIn(['salary_adj_pts_added', '0'], 0)
      })
    })

    const percentiles = calculatePercentiles({
      items,
      stats: ['market_salary', 'pts_added', 'salary_adj_pts_added']
    })

    // Find the user's teamId for this league
    let is_team_manager = false
    if (teams && app.teamId) {
      // teams is an Immutable.Map keyed by uid
      is_team_manager = teams.has(app.teamId)
    }

    return {
      restricted_free_agency_players,
      teamId: app.teamId,
      leagueId: app.leagueId,
      players,
      cutlist,
      league,
      waivers,
      poaches,
      is_before_restricted_free_agency_end,
      percentiles,
      teams,
      is_team_manager
    }
  }
)

const map_dispatch_to_props = {
  load_teams: team_actions.load_teams,
  load_rosters: roster_actions.load_rosters,
  load_league_players: player_actions.load_league_players,
  load_draft_pick_value: draft_pick_value_actions.load_draft_pick_value,
  load_recent_transactions: transactions_actions.load_recent_transactions
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(LeagueHomePage)
