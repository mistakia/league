import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getStandings } from '@core/standings'

import StandingsPage from './standings'

const mapStateToProps = createSelector(
  getStandings,
  (standings) => ({ standings })
)

export default connect(
  mapStateToProps
)(StandingsPage)
