import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getTeamsForCurrentLeague } from '@core/teams'

import Matchup from './matchup'

const mapDispatchToProps = createSelector(
  getTeamsForCurrentLeague,
  (teams) => ({ teams })
)

export default connect(
  mapDispatchToProps
)(Matchup)
