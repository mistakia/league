import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getRostersForCurrentLeague } from '@core/rosters'
import { getTeamsForCurrentLeague } from '@core/teams'
import { getApp } from '@core/app'
import { getCurrentLeague } from '@core/leagues'

import AuctionTeamRosters from './auction-team-rosters'

const mapStateToProps = createSelector(
  getRostersForCurrentLeague,
  getTeamsForCurrentLeague,
  getApp,
  getCurrentLeague,
  (rosters, teams, app, league) => ({
    rosters,
    teams,
    teamId: app.teamId,
    league
  })
)

export default connect(mapStateToProps)(AuctionTeamRosters)
