import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getMatchups, getMatchupsForSelectedWeek } from '@core/selectors'
import { matchupsActions } from '@core/matchups'

import ScoreboardScores from './scoreboard-scores'

const mapStateToProps = createSelector(
  getMatchups,
  getMatchupsForSelectedWeek,
  (state, matchups) => ({ selected: state.get('selected'), matchups })
)

const mapDispatchToProps = {
  select: matchupsActions.select
}

export default connect(mapStateToProps, mapDispatchToProps)(ScoreboardScores)
