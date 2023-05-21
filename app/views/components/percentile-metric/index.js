import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPercentiles } from '@core/selectors'

import PercentileMetric from './percentile-metric'

const mapStateToProps = createSelector(getPercentiles, (percentiles) => ({
  percentiles
}))

export default connect(mapStateToProps)(PercentileMetric)
