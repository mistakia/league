import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getStats, statActions } from '@core/stats'
import { getPlayers } from '@core/players'

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

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(StatQualifierFilter)
