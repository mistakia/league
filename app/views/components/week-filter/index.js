import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_players_state } from '@core/selectors'

import WeekFilter from './week-filter'

const map_state_to_props = createSelector(get_players_state, (players) => ({
  week: players.get('week')
}))

export default connect(map_state_to_props)(WeekFilter)
