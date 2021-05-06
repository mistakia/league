import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getStats, statActions } from '@core/stats'

import StatMenu from './stat-menu'

const mapStateToProps = createSelector(getStats, (stats) => ({
  view: stats.view
}))

const mapDispatchToProps = {
  update: statActions.setView
}

export default connect(mapStateToProps, mapDispatchToProps)(StatMenu)
