import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'

import LeagueSettingsPage from './league-settings'

const mapStateToProps = createSelector(getApp, (app) => ({
  leagueId: app.leagueId
}))

export default connect(mapStateToProps)(LeagueSettingsPage)
