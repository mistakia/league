import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getScoreboard, scoreboardActions } from '@core/scoreboard'

import ScoreboardSelectWeek from './scoreboard-select-week'

const mapStateToProps = createSelector(getScoreboard, (scoreboard) => ({
  week: scoreboard.get('week')
}))

const mapDispatchToProps = {
  select: scoreboardActions.select
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(ScoreboardSelectWeek)
