import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  get_app,
  getTransitionPlayers,
  getCutlistPlayers,
  getCurrentLeague,
  getCurrentPlayers,
  isBeforeTransitionEnd,
  getWaiverPlayersForCurrentTeam,
  getPoachPlayersForCurrentLeague
} from '@core/selectors'
import { playerActions } from '@core/players'
import { draftPickValueActions } from '@core/draft-pick-value'
import { transactionsActions } from '@core/transactions'
import { teamActions } from '@core/teams'
import { rosterActions } from '@core/rosters'
import { calculatePercentiles } from '@libs-shared'
import { confirmationActions } from '@core/confirmations'
import { poachActions } from '@core/poaches'

import LeagueHomePage from './league-home'

const mapStateToProps = createSelector(
  get_app,
  getTransitionPlayers,
  getCurrentPlayers,
  getCutlistPlayers,
  getCurrentLeague,
  getWaiverPlayersForCurrentTeam,
  getPoachPlayersForCurrentLeague,
  isBeforeTransitionEnd,
  (
    app,
    transitionPlayers,
    players,
    cutlist,
    league,
    waivers,
    poaches,
    isBeforeTransitionEnd
  ) => {
    const items = []
    transitionPlayers.forEach((p) => {
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

    return {
      transitionPlayers,
      teamId: app.teamId,
      leagueId: app.leagueId,
      players,
      cutlist,
      league,
      waivers,
      poaches,
      isBeforeTransitionEnd,
      percentiles
    }
  }
)

const mapDispatchToProps = {
  loadTeams: teamActions.loadTeams,
  loadRosters: rosterActions.loadRosters,
  loadLeaguePlayers: playerActions.loadLeaguePlayers,
  loadDraftPickValue: draftPickValueActions.loadDraftPickValue,
  loadRecentTransactions: transactionsActions.loadRecentTransactions,
  confirmationActions: confirmationActions.show,
  process_poach: poachActions.process_poach
}

export default connect(mapStateToProps, mapDispatchToProps)(LeagueHomePage)
