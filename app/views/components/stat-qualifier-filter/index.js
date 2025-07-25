import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { stat_actions } from '@core/stats'
import { get_stats_state, get_players_state } from '@core/selectors'

import StatQualifierFilter from './stat-qualifier-filter'

const map_state_to_props = createSelector(
  get_stats_state,
  get_players_state,
  (stats, players) => ({
    stat: players.get('orderBy').split('.').pop(),
    qualifier: stats.qualifiers.get(players.get('orderBy').split('.').pop())
  })
)

const map_dispatch_to_props = {
  update: stat_actions.updateQualifier
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(StatQualifierFilter)
