import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_app, get_player_maps, get_current_league } from '@core/selectors'
import { player_actions } from '@core/players'
import { context_menu_actions } from '@core/context-menu'

import PlayerRowNameColumn from './player-row-name-column'

const map_state_to_props = createSelector(
  get_app,
  get_player_maps,
  get_current_league,
  (app, player_maps, league) => ({
    player_maps,
    is_logged_in: Boolean(app.userId),
    is_league_hosted: Boolean(league.hosted)
  })
)

const map_dispatch_to_props = {
  select_player: player_actions.select_player,
  show_context_menu: context_menu_actions.show
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(PlayerRowNameColumn)
