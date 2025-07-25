import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayerById } from '@core/selectors'

import PlayerRosterRow from './player-roster-row'

const map_state_to_props = createSelector(getPlayerById, (player_map) => ({
  player_map
}))

export default connect(map_state_to_props)(PlayerRosterRow)
