import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_stats_state } from '@core/selectors'

import StatDownsFilter from './stat-downs-filter'

const map_state_to_props = createSelector(get_stats_state, (stats) => ({
  downs: stats.downs
}))

export default connect(map_state_to_props)(StatDownsFilter)
