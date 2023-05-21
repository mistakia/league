import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { scoreboardActions } from '@core/scoreboard'
import { getScoreboard, getWeeksForSelectedYearMatchups } from '@core/selectors'

import ScoreboardSelectWeek from './scoreboard-select-week'

const mapStateToProps = createSelector(
  getScoreboard,
  getWeeksForSelectedYearMatchups,
  (scoreboard, weeks) => ({
    week: scoreboard.get('week'),
    weeks
  })
)

const mapDispatchToProps = {
  selectWeek: scoreboardActions.selectWeek
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(ScoreboardSelectWeek)
