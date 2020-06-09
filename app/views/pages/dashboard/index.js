import React from 'react'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import { rosterActions, getCurrentPlayers } from '@core/rosters'
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
  (app, players) => ({ teamId: app.teamId, players })
)

const mapDispatchToProps = {
  loadRoster: rosterActions.loadRoster
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(DashboardPage)
