import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getStats, statActions } from '@core/stats'

import StatPassingMenu from './stat-passing-menu'

const mapStateToProps = createSelector(getStats, (stats) => ({
  passing: stats.passing
}))

const mapDispatchToProps = {
  update: statActions.setPassingView
}

export default connect(mapStateToProps, mapDispatchToProps)(StatPassingMenu)
