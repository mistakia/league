import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getStats } from '@core/stats'

import PlayerRowMetric from './player-row-metric'

const mapStateToProps = createSelector(
  getStats,
  (stats) => ({ overall: stats.overall })
)

export default connect(
  mapStateToProps
)(PlayerRowMetric)
