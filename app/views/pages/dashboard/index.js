import React from 'react'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import { getCurrentTeam } from '@core/teams'
import { rosterActions, getCurrentPlayers } from '@core/rosters'
import { getCurrentLeague } from '@core/leagues'
import { getWaiverPlayersForCurrentTeam, waiverActions } from '@core/waivers'

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
  (app, players, team, league, waivers) => ({
    teamId: app.teamId,
    players,
    picks: team.picks,
    league,
    waivers
  })
)

const mapDispatchToProps = {
  loadRoster: rosterActions.loadRoster,
  reorderPoach: waiverActions.reorderPoach
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(DashboardPage)
