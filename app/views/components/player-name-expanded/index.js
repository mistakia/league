import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { player_actions } from '@core/players'
import { getPlayerById, getGameStatusByPlayerId } from '@core/selectors'
import { constants } from '#libs-shared'

import PlayerNameExpanded from './player-name-expanded'

const map_state_to_props = createSelector(
  getPlayerById,
  getGameStatusByPlayerId,
  (state) => state.getIn(['app', 'year'], constants.year),
  (playerMap, status, selected_year) => ({ playerMap, status, selected_year })
)

const map_dispatch_to_props = {
  select: player_actions.select_player
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(PlayerNameExpanded)
