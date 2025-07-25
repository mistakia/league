import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_stats_state } from '@core/selectors'

import StatQuartersFilter from './stat-quarters-filter'

const map_state_to_props = createSelector(get_stats_state, (stats) => ({
  quarters: stats.quarters
}))

export default connect(map_state_to_props)(StatQuartersFilter)
