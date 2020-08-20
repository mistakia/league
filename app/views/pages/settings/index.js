import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import { getCurrentLeague } from '@core/leagues'

import SettingsPage from './settings'

const mapStateToProps = createSelector(
  getApp,
  getCurrentLeague,
  (app, league) => ({
    teamId: app.teamId,
    leagueId: app.leagueId,
    userId: app.userId,
    isHosted: !!league.hosted
  })
)

export default connect(
  mapStateToProps
)(SettingsPage)
