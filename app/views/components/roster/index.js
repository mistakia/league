import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_app, getCurrentLeague } from '@core/selectors'

import Roster from './roster'

const mapStateToProps = createSelector(
  getCurrentLeague,
  get_app,
  (league, app) => ({
    league,
    teamId: app.teamId
  })
)

export default connect(mapStateToProps)(Roster)
