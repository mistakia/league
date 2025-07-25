import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_stats_state } from '@core/selectors'

import StatWeeksFilter from './stat-weeks-filter'

const map_state_to_props = createSelector(get_stats_state, (stats) => ({
  week: stats.weeks
}))

export default connect(map_state_to_props)(StatWeeksFilter)
