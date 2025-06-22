import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getSelectedPlayersPageView } from '@core/selectors'
import { player_actions } from '@core/players'

import PlayersViewMenu from './players-view-menu'

const mapStateToProps = createSelector(
  (state) => state.getIn(['players', 'players_page_views']),
  getSelectedPlayersPageView,
  (players_page_views, selected_players_page_view) => ({
    selected_players_page_view,
    players_page_views
  })
)

const mapDispatchToProps = {
  select_players_page_view: player_actions.select_players_page_view
}

export default connect(mapStateToProps, mapDispatchToProps)(PlayersViewMenu)
