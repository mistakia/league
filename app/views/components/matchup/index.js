import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  getTeamsForCurrentLeague,
  getScoreboardByMatchupId
} from '@core/selectors'

import Matchup from './matchup'

const mapDispatchToProps = createSelector(
  getTeamsForCurrentLeague,
  getScoreboardByMatchupId,
  (teams, scoreboard) => ({ teams, scoreboard })
)

export default connect(mapDispatchToProps)(Matchup)
