import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getTeamsForCurrentLeague } from '@core/teams'
import { getApp } from '@core/app'
import { getCurrentLeague } from '@core/leagues'
import { getStandingsYear } from '@core/standings'

import StatsPage from './stats'

const mapStateToProps = createSelector(
  getCurrentLeague,
  getTeamsForCurrentLeague,
  getApp,
  getStandingsYear,
  (league, teams, app, year) => ({
    league,
    teams,
    percentiles: app.teamPercentiles,
    year
  })
)

export default connect(mapStateToProps)(StatsPage)
