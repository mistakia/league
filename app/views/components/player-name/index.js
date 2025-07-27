import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayerById, get_players_state } from '@core/selectors'
import { player_actions } from '@core/players'

import PlayerName from './player-name'

const map_state_to_props = createSelector(
  getPlayerById,
  get_players_state,
  (player_map, players) => ({
    player_map,
    isOnCutlist: players.get('cutlist').includes(player_map.get('pid'))
  })
)

const map_dispatch_to_props = {
  select: player_actions.select_player
}

export default connect(map_state_to_props, map_dispatch_to_props)(PlayerName)
