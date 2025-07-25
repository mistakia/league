import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  get_matchups_state,
  get_matchups_for_selected_week
} from '@core/selectors'
import { matchups_actions } from '@core/matchups'

import ScoreboardScores from './scoreboard-scores'

const map_state_to_props = createSelector(
  get_matchups_state,
  get_matchups_for_selected_week,
  (state, matchups) => ({ selected: state.get('selected'), matchups })
)

const map_dispatch_to_props = {
  select_matchup: matchups_actions.select_matchup
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(ScoreboardScores)
