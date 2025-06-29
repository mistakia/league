import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  get_app,
  getRestrictedFreeAgencyPlayers,
  getCutlistPlayers,
  getCurrentLeague,
  getCurrentPlayers,
  isBeforeRestrictedFreeAgencyEnd,
  getWaiverPlayersForCurrentTeam,
  getPoachPlayersForCurrentLeague,
  getTeamsForCurrentLeague
} from '@core/selectors'
import { player_actions } from '@core/players'
import { draftPickValueActions } from '@core/draft-pick-value'
import { transactionsActions } from '@core/transactions'
import { teamActions } from '@core/teams'
import { roster_actions } from '@core/rosters'
import { calculatePercentiles } from '@libs-shared'

import LeagueHomePage from './league-home'

const mapStateToProps = createSelector(
  get_app,
  getRestrictedFreeAgencyPlayers,
  getCurrentPlayers,
  getCutlistPlayers,
  getCurrentLeague,
  getWaiverPlayersForCurrentTeam,
  getPoachPlayersForCurrentLeague,
  isBeforeRestrictedFreeAgencyEnd,
  getTeamsForCurrentLeague,
  (
    app,
    restrictedFreeAgencyPlayers,
    players,
    cutlist,
    league,
    waivers,
    poaches,
    isBeforeRestrictedFreeAgencyEnd,
    teams
  ) => {
    const items = []
    restrictedFreeAgencyPlayers.forEach((p) => {
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
      restrictedFreeAgencyPlayers,
      teamId: app.teamId,
      leagueId: app.leagueId,
      players,
      cutlist,
      league,
      waivers,
      poaches,
      isBeforeRestrictedFreeAgencyEnd,
      percentiles,
      teams,
      is_team_manager
    }
  }
)

const mapDispatchToProps = {
  loadTeams: teamActions.loadTeams,
  load_rosters: roster_actions.load_rosters,
  load_league_players: player_actions.load_league_players,
  loadDraftPickValue: draftPickValueActions.loadDraftPickValue,
  loadRecentTransactions: transactionsActions.loadRecentTransactions
}

export default connect(mapStateToProps, mapDispatchToProps)(LeagueHomePage)
