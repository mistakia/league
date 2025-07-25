import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_players_state } from '@core/players'

import AgeFilter from './age-filter'

const map_state_to_props = createSelector(get_players_state, (players) => ({
  age: players.get('age'),
  allAges: players.get('allAges')
}))

export default connect(map_state_to_props)(AgeFilter)
