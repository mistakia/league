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
  ) => ({
    transitionPlayers,
    teamId: app.teamId,
    players,
    cutlist,
    league,
    waivers,
    poaches,
    isBeforeTransitionEnd
  })
)

const mapDispatchToProps = {
  loadLeaguePlayers: playerActions.loadLeaguePlayers,
  loadDraftPickValue: draftPickValueActions.loadDraftPickValue,
  loadRecentTransactions: transactionsActions.loadRecentTransactions
}

export default connect(mapStateToProps, mapDispatchToProps)(LeagueHomePage)
