import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_percentiles } from '@core/selectors'

import PercentileMetric from './percentile-metric'

const map_state_to_props = createSelector(get_percentiles, (percentiles) => ({
  percentiles
}))

export default connect(map_state_to_props)(PercentileMetric)
