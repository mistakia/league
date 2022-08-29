import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import { getCurrentTeam } from '@core/teams'
import { getCurrentPlayers, getCurrentTeamRoster } from '@core/rosters'
import { getCurrentLeague, isBeforeTransitionEnd } from '@core/leagues'
import { getWaiverPlayersForCurrentTeam } from '@core/waivers'
import { getPoachPlayersForCurrentLeague } from '@core/poaches'
import {
  playerActions,
  getTransitionPlayers,
  getCutlistPlayers
} from '@core/players'
import { draftPickValueActions } from '@core/draft-pick-value'

import LeagueHomePage from './league-home'

const mapStateToProps = createSelector(
  getApp,
  getTransitionPlayers,
  getCurrentPlayers,
  getCutlistPlayers,
  getCurrentTeam,
  getCurrentLeague,
  getCurrentTeamRoster,
  getWaiverPlayersForCurrentTeam,
  getPoachPlayersForCurrentLeague,
  isBeforeTransitionEnd,
  (
    app,
    transitionPlayers,
    players,
    cutlist,
    team,
    league,
    roster,
    waivers,
    poaches,
    isBeforeTransitionEnd
  ) => ({
    transitionPlayers,
    teamId: app.teamId,
    players,
    cutlist,
    picks: team.picks,
    league,
    roster,
    waivers,
    poaches,
    isBeforeTransitionEnd
  })
)

const mapDispatchToProps = {
  loadLeaguePlayers: playerActions.loadLeaguePlayers,
  loadDraftPickValue: draftPickValueActions.loadDraftPickValue
}

export default connect(mapStateToProps, mapDispatchToProps)(LeagueHomePage)