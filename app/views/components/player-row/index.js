import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import { getStats } from '@core/stats'
import { getPlayers, playerActions } from '@core/players'

import PlayerRow from './player-row'

const mapStateToProps = createSelector(
  getPlayers,
  getApp,
  getStats,
  (players, app, statsState) => ({
    isLoggedIn: !!app.userId,
    selectedPlayer: players.get('selected'),
    vbaseline: app.vbaseline,
    overall: statsState.overallPlays,
    isRestOfSeasonView: players.get('view') === 'ros',
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
  delete: playerActions.deleteProjection
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(PlayerRow)
