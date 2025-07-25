import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { stat_actions } from '@core/stats'
import { get_stats_state } from '@core/selectors'

import StatYardlineFilter from './stat-yardline-filter'

const map_state_to_props = createSelector(get_stats_state, (stats) => ({
  yardline_start: stats.yardline_start,
  yardline_end: stats.yardline_end
}))

const map_dispatch_to_props = {
  filter_yardline: stat_actions.filter_yardline
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(StatYardlineFilter)
