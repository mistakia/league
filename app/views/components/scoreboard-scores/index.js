import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getMatchups, getMatchupsForCurrentWeek, matchupsActions } from '@core/matchups'

import ScoreboardScores from './scoreboard-scores'

const mapStateToProps = createSelector(
  getMatchups,
  getMatchupsForCurrentWeek,
  (state, matchups) => ({ selected: state.get('selected'), matchups })
)

const mapDispatchToProps = {
  select: matchupsActions.select
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(ScoreboardScores)
