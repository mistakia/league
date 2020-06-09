import React from 'react'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import { rosterActions, getCurrentTeamRoster } from '@core/rosters'
import render from './lineups'

class LineupsPage extends React.Component {
  componentDidMount () {
    this.props.loadRoster(this.props.teamId)
  }

  render () {
    return render.call(this)
  }
}

const mapStateToProps = createSelector(
  getApp,
  getCurrentTeamRoster,
  (app, roster) => ({ teamId: app.teamId, roster })
)

const mapDispatchToProps = {
  loadRoster: rosterActions.loadRoster
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(LineupsPage)
