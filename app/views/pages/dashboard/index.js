import React from 'react'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import { getCurrentTeam } from '@core/teams'
import { getCurrentPlayers, getCurrentTeamRoster } from '@core/rosters'
import { getCurrentLeague } from '@core/leagues'
import { getWaiverPlayersForCurrentTeam } from '@core/waivers'
import { getPoachPlayersForCurrentLeague } from '@core/poaches'

import render from './dashboard'

class DashboardPage extends React.Component {
  render() {
    return render.call(this)
  }
}

const mapStateToProps = createSelector(
  getApp,
  getCurrentPlayers,
  getCurrentTeam,
  getCurrentLeague,
  getCurrentTeamRoster,
  getWaiverPlayersForCurrentTeam,
  getPoachPlayersForCurrentLeague,
  (app, players, team, league, roster, waivers, poaches) => ({
    teamId: app.teamId,
    players,
    picks: team.picks,
    league,
    roster,
    waivers,
    poaches
  })
)

export default connect(mapStateToProps)(DashboardPage)
