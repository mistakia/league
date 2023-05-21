import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { statActions } from '@core/stats'
import { getStats, getPlayers } from '@core/selectors'

import StatQualifierFilter from './stat-qualifier-filter'

const mapStateToProps = createSelector(
  getStats,
  getPlayers,
  (stats, players) => ({
    stat: players.get('orderBy').split('.').pop(),
    qualifier: stats.qualifiers.get(players.get('orderBy').split('.').pop())
  })
)

const mapDispatchToProps = {
  update: statActions.updateQualifier
}

export default connect(mapStateToProps, mapDispatchToProps)(StatQualifierFilter)
