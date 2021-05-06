import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getStats } from '@core/stats'

import StatQuartersFilter from './stat-quarters-filter'

const mapStateToProps = createSelector(getStats, (stats) => ({
  quarters: stats.quarters
}))

export default connect(mapStateToProps)(StatQuartersFilter)
