import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import { getStats } from '@core/stats'
import { getPlayers, playerActions, getPlayerStatus } from '@core/players'
import { getTeams } from '@core/teams'

import PlayerRow from './player-row'

const mapStateToProps = createSelector(
  getPlayers,
  getApp,
  getStats,
  getPlayerStatus,
  getTeams,
  (players, app, statsState, status, teams) => ({
    status,
    teams,
    teamId: app.teamId,
    isLoggedIn: Boolean(app.userId),
    highlight_teamIds: players.get('highlight_teamIds'),
    selectedPlayer: players.get('selected'),
    baselines: players.get('baselines'),
    percentiles: statsState.playsPercentiles,
    week: players.get('view') === 'ros' ? 'ros' : players.get('week').get(0),
    isRestOfSeasonView: players.get('view') === 'ros',
    isWeekView: players.get('view') === 'week',
    isSeasonView: players.get('view') === 'season',
    isStatsView: players.get('view') === 'stats',
    isStatsRushingView:
      players.get('view') === 'stats' && statsState.view === 'rushing',
    isStatsReceivingView:
      players.get('view') === 'stats' && statsState.view === 'receiving',
    isStatsPassingAdvancedView:
      players.get('view') === 'stats' &&
      statsState.view === 'passing' &&
      statsState.passing === 'advanced',
    isStatsPassingPressureView:
      players.get('view') === 'stats' &&
      statsState.view === 'passing' &&
      statsState.passing === 'pressure'
  })
)

const mapDispatchToProps = {
  select: playerActions.selectPlayer
}

export default connect(mapStateToProps, mapDispatchToProps)(PlayerRow)
