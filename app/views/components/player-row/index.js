import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import { getStats } from '@core/stats'
import { getPlayers, playerActions, getGamesByYearForPlayer } from '@core/players'

import PlayerRow from './player-row'

const mapStateToProps = createSelector(
  getPlayers,
  getApp,
  getGamesByYearForPlayer,
  getStats,
  (players, app, stats, statsState) => ({
    selected: players.get('selected'),
    stats,
    vbaseline: app.vbaseline,
    isSeasonProjectionView: players.get('view') === 'seasproj',
    isStatsRushingView: players.get('view') === 'stats' && statsState.view === 'rushing',
    isStatsReceivingView: players.get('view') === 'stats' && statsState.view === 'receiving',
    isStatsPassingAdvancedView: players.get('view') === 'stats' &&
      statsState.view === 'passing' &&
      statsState.passing === 'advanced',
    isStatsPassingPressureView: players.get('view') === 'stats' &&
      statsState.view === 'passing' &&
      statsState.passing === 'pressure'

  })
)

const mapDispatchToProps = {
  select: playerActions.selectPlayer,
  deselect: playerActions.deselectPlayer,
  delete: playerActions.deleteProjection
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(PlayerRow)
