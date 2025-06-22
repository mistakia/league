import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_app, get_player_maps, getCurrentLeague } from '@core/selectors'
import { player_actions } from '@core/players'
import { contextMenuActions } from '@core/context-menu'

import PlayerRowNameColumn from './player-row-name-column'

const mapStateToProps = createSelector(
  get_app,
  get_player_maps,
  getCurrentLeague,
  (app, player_maps, league) => ({
    player_maps,
    is_logged_in: Boolean(app.userId),
    is_league_hosted: Boolean(league.hosted)
  })
)

const mapDispatchToProps = {
  select_player: player_actions.select_player,
  show_context_menu: contextMenuActions.show
}

export default connect(mapStateToProps, mapDispatchToProps)(PlayerRowNameColumn)
