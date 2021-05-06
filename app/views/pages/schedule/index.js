import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getFilteredMatchups } from '@core/matchups'

import SchedulePage from './schedule'

const mapStateToProps = createSelector(getFilteredMatchups, (matchups) => ({
  matchups
}))

export default connect(mapStateToProps)(SchedulePage)
