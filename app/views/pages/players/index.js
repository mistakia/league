import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  getFilteredPlayers,
  getStats,
  getSelectedViewGroupedFields,
  getSelectedPlayersView,
  getPlayerFields,
  is_player_filter_options_changed
} from '@core/selectors'
import { playerActions } from '@core/players'
import { rosterActions } from '@core/rosters'

import PlayersPage from './players'

const mapStateToProps = createSelector(
  getFilteredPlayers,
  (state) => state.getIn(['players', 'allPlayersPending']),
  (state) => state.getIn(['players', 'search']),
  (state) => state.getIn(['players', 'order']),
  (state) => state.getIn(['players', 'orderBy']),
  (state) => state.getIn(['app', 'userId']),
  getStats,
  getSelectedPlayersView,
  getSelectedViewGroupedFields,
  getPlayerFields,
  is_player_filter_options_changed,
  (
    players,
    allPlayersPending,
    searchValue,
    order,
    orderBy,
    userId,
    stats,
    selected_players_view,
    selected_view_grouped_fields,
    player_fields,
    is_player_filter_options_changed
  ) => ({
    players,
    selected_view_grouped_fields,
    is_logged_in: Boolean(userId),
    isPending:
      allPlayersPending ||
      (selected_players_view.key.includes('stats_by_play') && stats.isPending), // TODO handle player fields being loaded (stats, etc)
    searchValue,
    order,
    orderBy,
    selected_players_view,
    show_week_filter: Boolean(
      selected_players_view.fields.find((f) => f.includes('.week'))
    ),
    show_play_filters: Boolean(
      selected_players_view.fields.find((f) => f.includes('stats.'))
    ),
    show_qualifier_filter: Boolean(
      stats.qualifiers.get(orderBy.split('.').pop())
    ),
    player_fields,
    is_player_filter_options_changed
  })
)

const mapDispatchToProps = {
  search: playerActions.search,
  reset_player_filter_options: playerActions.reset_player_filter_options,
  loadRosters: rosterActions.loadRosters
}

export default connect(mapStateToProps, mapDispatchToProps)(PlayersPage)
