import React from 'react'
import PropTypes from 'prop-types'
import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import { getCurrentTeam } from '@core/teams'
import { getCurrentPlayers, getCurrentTeamRoster } from '@core/rosters'
import { getCurrentLeague } from '@core/leagues'
import { getWaiverPlayersForCurrentTeam } from '@core/waivers'
import { getPoachPlayersForCurrentLeague } from '@core/poaches'
import { playerActions, getCutlistPlayers } from '@core/players'

import render from './dashboard'

class DashboardPage extends React.Component {
  componentDidMount() {
    this.props.loadCutlist()
  }

  render() {
    return render.call(this)
  }
}

DashboardPage.propTypes = {
  loadCutlist: PropTypes.func
}

const mapStateToProps = createSelector(
  getApp,
  getCurrentPlayers,
  getCutlistPlayers,
  getCurrentTeam,
  getCurrentLeague,
  getCurrentTeamRoster,
  getWaiverPlayersForCurrentTeam,
  getPoachPlayersForCurrentLeague,
  (app, players, cutlist, team, league, roster, waivers, poaches) => ({
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

const mapDispatchToProps = {
  loadCutlist: playerActions.getCutlist
}

export default connect(mapStateToProps, mapDispatchToProps)(DashboardPage)
