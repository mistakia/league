import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_filtered_matchups } from '@core/selectors'
import { matchups_actions } from '@core/matchups'

import SchedulePage from './schedule'

const map_state_to_props = createSelector(
  get_filtered_matchups,
  (matchups) => ({
    matchups
  })
)

const map_dispatch_to_props = {
  load: matchups_actions.loadMatchups
}

export default connect(map_state_to_props, map_dispatch_to_props)(SchedulePage)
