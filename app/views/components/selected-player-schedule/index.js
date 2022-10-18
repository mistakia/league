import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getSelectedPlayer, getSelectedPlayerGames } from '@core/players'
import { getSeasonlogs } from '@core/seasonlogs'
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

export default connect(mapStateToProps)(SelectedPlayerSchedule)
