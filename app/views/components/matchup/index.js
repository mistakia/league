import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getRosters, getTeamsForCurrentLeague } from '@core/selectors'

import Matchup from './matchup'

const mapDispatchToProps = createSelector(
  getTeamsForCurrentLeague,
  getRosters,
  (teams, rosters) => ({ teams, rosters })
)

export default connect(mapDispatchToProps)(Matchup)
