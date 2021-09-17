import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getOverallStandings } from '@core/teams'

import StandingsPage from './standings'

const mapStateToProps = createSelector(getOverallStandings, (standings) => ({
  standings
}))

export default connect(mapStateToProps)(StandingsPage)
