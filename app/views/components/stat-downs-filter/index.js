import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getStats } from '@core/selectors'

import StatDownsFilter from './stat-downs-filter'

const mapStateToProps = createSelector(getStats, (stats) => ({
  downs: stats.downs
}))

export default connect(mapStateToProps)(StatDownsFilter)
