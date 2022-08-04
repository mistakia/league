import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getTeamsForCurrentLeague } from '@core/teams'
import { getRosters } from '@core/rosters'

import Matchup from './matchup'

const mapDispatchToProps = createSelector(
  getTeamsForCurrentLeague,
  getRosters,
  (teams, rosters) => ({ teams, rosters })
)

export default connect(mapDispatchToProps)(Matchup)
