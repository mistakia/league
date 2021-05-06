import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getTeamsForCurrentLeague } from '@core/teams'
import { getApp } from '@core/app'
import { getCurrentLeague } from '@core/leagues'

import StatsPage from './stats'

const mapStateToProps = createSelector(
  getCurrentLeague,
  getTeamsForCurrentLeague,
  getApp,
  (league, teams, app) => ({ league, teams, percentiles: app.teamPercentiles })
)

export default connect(mapStateToProps)(StatsPage)
