import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  get_players_state,
  get_positions_for_current_league
} from '@core/selectors'

import PositionFilter from './position-filter'

const map_state_to_props = createSelector(
  get_players_state,
  get_positions_for_current_league,
  (players, league_positions) => ({
    positions: players.get('positions'),
    league_positions
  })
)

export default connect(map_state_to_props)(PositionFilter)
