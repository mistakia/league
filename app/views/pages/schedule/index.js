import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getFilteredMatchups } from '@core/selectors'
import { matchupsActions } from '@core/matchups'

import SchedulePage from './schedule'

const mapStateToProps = createSelector(getFilteredMatchups, (matchups) => ({
  matchups
}))

const mapDispatchToProps = {
  load: matchupsActions.loadMatchups
}

export default connect(mapStateToProps, mapDispatchToProps)(SchedulePage)
