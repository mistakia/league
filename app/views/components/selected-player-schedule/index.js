import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  getSchedule,
  get_seasonlogs,
  getSelectedPlayer,
  getSelectedPlayerGames
} from '@core/selectors'
import { seasonlogsActions } from '@core/seasonlogs'

import SelectedPlayerSchedule from './selected-player-schedule'

const mapStateToProps = createSelector(
  getSelectedPlayer,
  getSelectedPlayerGames,
  get_seasonlogs,
  getSchedule,
  (playerMap, games, seasonlogs, schedule) => ({
    playerMap,
    games,
    seasonlogs,
    schedule
  })
)

const mapDispatchToProps = {
  load_nfl_team_seasonlogs: seasonlogsActions.load_nfl_team_seasonlogs
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(SelectedPlayerSchedule)
