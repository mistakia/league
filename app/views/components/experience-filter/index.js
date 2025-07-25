import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_players_state } from '@core/selectors'

import ExperienceFilter from './experience-filter'

const map_state_to_props = createSelector(get_players_state, (players) => ({
  experience: players.get('experience')
}))

export default connect(map_state_to_props)(ExperienceFilter)
