import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_app, getCurrentLeague } from '@core/selectors'

import SettingsPage from './settings'

const mapStateToProps = createSelector(
  get_app,
  getCurrentLeague,
  (app, league) => ({
    teamId: app.teamId,
    userId: app.userId,
    isHosted: Boolean(league.hosted)
  })
)

export default connect(mapStateToProps)(SettingsPage)
