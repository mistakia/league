import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getStats } from '@core/selectors'

import StatYearsFilter from './stat-years-filter'

const mapStateToProps = createSelector(getStats, (stats) => ({
  years: stats.years
}))

export default connect(mapStateToProps)(StatYearsFilter)
