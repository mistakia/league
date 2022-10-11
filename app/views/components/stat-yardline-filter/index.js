import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getStats, statActions } from '@core/stats'

import StatYardlineFilter from './stat-yardline-filter'

const mapStateToProps = createSelector(getStats, (stats) => ({
  yardline_start: stats.yardline_start,
  yardline_end: stats.yardline_end
}))

const mapDispatchToProps = {
  filter_yardline: statActions.filter_yardline
}

export default connect(mapStateToProps, mapDispatchToProps)(StatYardlineFilter)
