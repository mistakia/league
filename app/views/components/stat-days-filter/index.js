import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_stats_state } from '@core/selectors'

import StatDaysFilter from './stat-days-filter'

const map_state_to_props = createSelector(get_stats_state, (stats) => ({
  days: stats.days
}))

export default connect(map_state_to_props)(StatDaysFilter)
