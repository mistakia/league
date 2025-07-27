import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayerById } from '@core/selectors'

import TradeSelectPlayer from './trade-select-player'

const map_state_to_props = createSelector(getPlayerById, (player_map) => ({
  player_map
}))

export default connect(map_state_to_props)(TradeSelectPlayer)
