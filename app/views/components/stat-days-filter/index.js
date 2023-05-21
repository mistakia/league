import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getStats } from '@core/selectors'

import StatDaysFilter from './stat-days-filter'

const mapStateToProps = createSelector(getStats, (stats) => ({
  days: stats.days
}))

export default connect(mapStateToProps)(StatDaysFilter)
