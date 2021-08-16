import React from 'react'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import { getCurrentTeam } from '@core/teams'
import { getCurrentPlayers, getCurrentTeamRoster } from '@core/rosters'
import { getCurrentLeague } from '@core/leagues'
import { getWaiverPlayersForCurrentTeam } from '@core/waivers'
import { getPoachPlayersForCurrentLeague } from '@core/poaches'
import { getTransitionPlayers, getCutlistPlayers } from '@core/players'

import render from './dashboard'

class DashboardPage extends React.Component {
  render() {
    return render.call(this)
  }
}

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
  (
    app,
    transitionPlayers,
    players,
    cutlist,
    team,
    league,
    roster,
    waivers,
    poaches
  ) => ({
    transitionPlayers,
    teamId: app.teamId,
    players,
    cutlist,
    picks: team.picks,
    league,
    roster,
    waivers,
    poaches
  })
)

export default connect(mapStateToProps)(DashboardPage)
