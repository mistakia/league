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
    userId: app.userId,
    isHosted: Boolean(league.hosted)
  })
)

export default connect(mapStateToProps)(SettingsPage)
