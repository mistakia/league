import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getMatchups } from '@core/selectors'

import ScheduleWeeksFilter from './schedule-weeks-filter'

const mapStateToProps = createSelector(getMatchups, (matchups) => ({
  weeks: matchups.get('weeks')
}))

export default connect(mapStateToProps)(ScheduleWeeksFilter)
