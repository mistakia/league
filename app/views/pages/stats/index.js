import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getCurrentLeague } from '@core/leagues'

import StatsPage from './stats'

const mapStateToProps = createSelector(
  getCurrentLeague,
  (league) => ({ league })
)

export default connect(
  mapStateToProps
)(StatsPage)
