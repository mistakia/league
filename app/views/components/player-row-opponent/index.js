import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_game_by_team } from '@core/selectors'

import PlayerRowOpponent from './player-row-opponent'

const map_state_to_props = createSelector(get_game_by_team, (game) => ({
  game
}))

export default connect(map_state_to_props)(PlayerRowOpponent)
