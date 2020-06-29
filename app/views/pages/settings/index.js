import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import { getSources } from '@core/sources'

import SettingsPage from './settings'

const mapStateToProps = createSelector(
  getApp,
  getSources,
  (app, sources) => ({
    teamIds: app.teamIds,
    leagueIds: app.leagueIds,
    sourceIds: sources.toList().map(s => s.uid)
  })
)

export default connect(
  mapStateToProps
)(SettingsPage)
