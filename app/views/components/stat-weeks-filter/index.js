import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getStats } from '@core/selectors'

import StatWeeksFilter from './stat-weeks-filter'

const mapStateToProps = createSelector(getStats, (stats) => ({
  week: stats.weeks
}))

export default connect(mapStateToProps)(StatWeeksFilter)
