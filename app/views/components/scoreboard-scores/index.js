import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getMatchupsForCurrentWeek } from '@core/matchups'

import ScoreboardScores from './scoreboard-scores'

const mapStateToProps = createSelector(
  getMatchupsForCurrentWeek,
  (matchups) => ({ matchups })
)

export default connect(
  mapStateToProps
)(ScoreboardScores)
