import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_stats_state } from '@core/selectors'

import StatYearsFilter from './stat-years-filter'

const map_state_to_props = createSelector(get_stats_state, (stats) => ({
  years: stats.years
}))

export default connect(map_state_to_props)(StatYearsFilter)
