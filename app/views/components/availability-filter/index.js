import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_players_state } from '@core/selectors'

import AvailabilityFilter from './availability-filter'

const map_state_to_props = createSelector(get_players_state, (players) => ({
  availability: players.get('availability')
}))

export default connect(map_state_to_props)(AvailabilityFilter)
