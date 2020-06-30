import React from 'react'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import { getCurrentTeam } from '@core/teams'
import { rosterActions, getCurrentPlayers } from '@core/rosters'
import { getCurrentLeague } from '@core/leagues'
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
  (app, players, team, league) => ({ teamId: app.teamId, players, picks: team.picks, league })
)

const mapDispatchToProps = {
  loadRoster: rosterActions.loadRoster
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(DashboardPage)
