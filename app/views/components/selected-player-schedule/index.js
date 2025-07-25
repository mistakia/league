import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  get_schedule_state,
  get_seasonlogs,
  getSelectedPlayer,
  getSelectedPlayerGames
} from '@core/selectors'
import { seasonlogs_actions } from '@core/seasonlogs'

import SelectedPlayerSchedule from './selected-player-schedule'

const map_state_to_props = createSelector(
  getSelectedPlayer,
  getSelectedPlayerGames,
  get_seasonlogs,
  get_schedule_state,
  (playerMap, games, seasonlogs, schedule) => ({
    playerMap,
    games,
    seasonlogs,
    schedule
  })
)

const map_dispatch_to_props = {
  load_nfl_team_seasonlogs: seasonlogs_actions.load_nfl_team_seasonlogs
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(SelectedPlayerSchedule)
