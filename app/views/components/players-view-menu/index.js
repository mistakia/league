import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getSelectedPlayersView } from '@core/selectors'
import { playerActions } from '@core/players'

import PlayersViewMenu from './players-view-menu'

const mapStateToProps = createSelector(
  (state) => state.getIn(['players', 'views']),
  getSelectedPlayersView,
  (views, selected_players_view) => ({
    selected_players_view,
    views
  })
)

const mapDispatchToProps = {
  select_players_view: playerActions.select_players_view
}

export default connect(mapStateToProps, mapDispatchToProps)(PlayersViewMenu)
