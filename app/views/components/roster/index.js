import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getCurrentLeague } from '@core/leagues'
import { getApp } from '@core/app'

import Roster from './roster'

const mapStateToProps = createSelector(
  getCurrentLeague,
  getApp,
  (league, app) => ({
    league,
    teamId: app.teamId
  })
)

export default connect(mapStateToProps)(Roster)
