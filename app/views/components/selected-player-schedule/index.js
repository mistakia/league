import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  get_schedule_state,
  get_seasonlogs,
  getSelectedPlayer,
  getSelectedPlayerGames
} from '@core/selectors'
import { seasonlogs_actions } from '@core/seasonlogs'
import { percentile_actions } from '@core/percentiles'

import SelectedPlayerSchedule from './selected-player-schedule'

const map_state_to_props = createSelector(
  getSelectedPlayer,
  getSelectedPlayerGames,
  get_seasonlogs,
  get_schedule_state,
  (player_map, games, seasonlogs, schedule) => ({
    player_map,
    games,
    seasonlogs,
    schedule
  })
)

const map_dispatch_to_props = {
  load_nfl_team_seasonlogs: seasonlogs_actions.load_nfl_team_seasonlogs,
  load_percentiles: percentile_actions.load_percentiles
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(SelectedPlayerSchedule)
