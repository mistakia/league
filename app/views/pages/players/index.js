import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getApp } from '@core/app'
import { getStats } from '@core/stats'
import { getFilteredPlayers, getPlayers, playerActions } from '@core/players'

import PlayersPage from './players'

const mapStateToProps = createSelector(
  getFilteredPlayers,
  getPlayers,
  getApp,
  getStats,
  (players, pState, app, stats) => ({
    players,
    week: pState.get('view') === 'ros' ? 'ros' : pState.get('week').get(0),
    isLoggedIn: !!app.userId,
    isPending:
      pState.get('isPending') ||
      (pState.get('view') === 'stats' && stats.isPending),
    searchValue: pState.get('search'),
    selected: pState.get('selected'),
    order: pState.get('order'),
    orderBy: pState.get('orderBy'),
    showQualifier: !!stats.qualifiers.get(
      pState.get('orderBy').split('.').pop()
    ),
    isSeasonView: pState.get('view') === 'season',
    isRestOfSeasonView: pState.get('view') === 'ros',
    isWeekView: pState.get('view') === 'week',
    isStatsView: pState.get('view') === 'stats',
    isStatsPassingView:
      pState.get('view') === 'stats' && stats.view === 'passing',
    isStatsRushingView:
      pState.get('view') === 'stats' && stats.view === 'rushing',
    isStatsReceivingView:
      pState.get('view') === 'stats' && stats.view === 'receiving',
    isStatsPassingAdvancedView:
      pState.get('view') === 'stats' &&
      stats.view === 'passing' &&
      stats.passing === 'advanced',
    isStatsPassingPressureView:
      pState.get('view') === 'stats' &&
      stats.view === 'passing' &&
      stats.passing === 'pressure'
  })
)

const mapDispatchToProps = {
  search: playerActions.search
}

export default connect(mapStateToProps, mapDispatchToProps)(PlayersPage)
