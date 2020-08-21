import React from 'react'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import { getCurrentTeam } from '@core/teams'
import { rosterActions, getCurrentPlayers } from '@core/rosters'
import { getCurrentLeague } from '@core/leagues'
import { getWaiverPlayersForCurrentTeam, waiverActions } from '@core/waivers'
import { getPoachPlayersForCurrentLeague } from '@core/poaches'

import render from './dashboard'

class DashboardPage extends React.Component {
  componentDidMount () {
    this.props.loadRoster(this.props.teamId)
  }

  render () {
    return render.call(this)
  }
}

const mapStateToProps = createSelector(
  getApp,
  getCurrentPlayers,
  getCurrentTeam,
  getCurrentLeague,
  getWaiverPlayersForCurrentTeam,
  getPoachPlayersForCurrentLeague,
  (app, players, team, league, waivers, poaches) => ({
    teamId: app.teamId,
    players,
    picks: team.picks,
    league,
    waivers,
    poaches
  })
)

const mapDispatchToProps = {
  loadRoster: rosterActions.loadRoster,
  reorderWaivers: waiverActions.reorderWaivers
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(DashboardPage)
