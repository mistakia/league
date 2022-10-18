import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getSelectedPlayer, getSelectedPlayerGames } from '@core/players'
import { getSeasonlogs, seasonlogsActions } from '@core/seasonlogs'
import { getSchedule } from '@core/schedule'

import SelectedPlayerSchedule from './selected-player-schedule'

const mapStateToProps = createSelector(
  getSelectedPlayer,
  getSelectedPlayerGames,
  getSeasonlogs,
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
