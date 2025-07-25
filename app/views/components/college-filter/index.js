import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_players_state } from '@core/selectors'

import CollegeFilter from './college-filter'

const map_state_to_props = createSelector(get_players_state, (players) => ({
  colleges: players.get('colleges')
}))

export default connect(map_state_to_props)(CollegeFilter)
