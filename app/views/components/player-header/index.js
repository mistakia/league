import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_players_state } from '@core/selectors'
import { player_actions } from '@core/players'

import PlayerHeader from './player-header'

const map_state_to_props = createSelector(get_players_state, (players) => ({
  order: players.get('order'),
  orderBy: players.get('orderBy')
}))

const map_dispatch_to_props = {
  toggle_players_page_order: player_actions.toggle_players_page_order
}

export default connect(map_state_to_props, map_dispatch_to_props)(PlayerHeader)
