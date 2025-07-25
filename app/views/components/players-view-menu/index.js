import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_selected_players_page_view } from '@core/selectors'
import { player_actions } from '@core/players'

import PlayersViewMenu from './players-view-menu'

const map_state_to_props = createSelector(
  (state) => state.getIn(['players', 'players_page_views']),
  get_selected_players_page_view,
  (players_page_views, selected_players_page_view) => ({
    selected_players_page_view,
    players_page_views
  })
)

const map_dispatch_to_props = {
  select_players_page_view: player_actions.select_players_page_view
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(PlayersViewMenu)
