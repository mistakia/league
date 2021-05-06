import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getTeamsForCurrentLeague } from '@core/teams'

import StandingsPage from './standings'

const mapStateToProps = createSelector(getTeamsForCurrentLeague, (teams) => ({
  teams
}))

export default connect(mapStateToProps)(StandingsPage)
