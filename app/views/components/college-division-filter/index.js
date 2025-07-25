import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_players_state } from '@core/selectors'

import CollegeDivisionFilter from './college-division-filter'

const map_state_to_props = createSelector(get_players_state, (players) => ({
  collegeDivisions: players.get('collegeDivisions')
}))

export default connect(map_state_to_props)(CollegeDivisionFilter)
