import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getCurrentLeague } from '@core/leagues'

import Lineup from './lineup'

const mapStateToProps = createSelector(
  getCurrentLeague,
  (league) => ({ league })
)

export default connect(
  mapStateToProps
)(Lineup)
