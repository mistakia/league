import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { scoreboard_actions } from '@core/scoreboard'
import {
  get_scoreboard,
  get_weeks_for_selected_year_matchups
} from '@core/selectors'

import ScoreboardSelectWeek from './scoreboard-select-week'

const map_state_to_props = createSelector(
  get_scoreboard,
  get_weeks_for_selected_year_matchups,
  (scoreboard, weeks) => ({
    week: scoreboard.get('week'),
    weeks
  })
)

const map_dispatch_to_props = {
  select_week: scoreboard_actions.select_week
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(ScoreboardSelectWeek)
