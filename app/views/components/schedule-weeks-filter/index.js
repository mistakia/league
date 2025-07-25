import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_matchups_state } from '@core/selectors'

import ScheduleWeeksFilter from './schedule-weeks-filter'

const map_state_to_props = createSelector(get_matchups_state, (matchups) => ({
  weeks: matchups.get('weeks')
}))

export default connect(map_state_to_props)(ScheduleWeeksFilter)
