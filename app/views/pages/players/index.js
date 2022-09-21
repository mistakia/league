import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getStats } from '@core/stats'
import {
  getFilteredPlayers,
  playerActions,
  getSelectedViewGroupedFields,
  getSelectedPlayersView,
  getPlayerFields
} from '@core/players'

import PlayersPage from './players'

const mapStateToProps = createSelector(
  getFilteredPlayers,
  (state) => state.getIn(['players', 'allPlayersPending']),
  (state) => state.getIn(['players', 'search']),
  (state) => state.getIn(['players', 'selected']),
  (state) => state.getIn(['players', 'order']),
  (state) => state.getIn(['players', 'orderBy']),
  (state) => state.getIn(['app', 'userId']),
  getStats,
  getSelectedPlayersView,
  getSelectedViewGroupedFields,
  getPlayerFields,
  (
    players,
    allPlayersPending,
    searchValue,
    selected,
    order,
    orderBy,
    userId,
    stats,
    selected_players_view,
    selected_view_grouped_fields,
    player_fields
  ) => ({
    players,
    selected_view_grouped_fields,
    isLoggedIn: Boolean(userId),
    isPending:
      allPlayersPending ||
      (selected_players_view.key.includes('stats_by_play') && stats.isPending), // TODO handle player fields being loaded (stats, etc)
    searchValue,
    selected,
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
    player_fields
  })
)

const mapDispatchToProps = {
  search: playerActions.search,
  loadAllPlayers: playerActions.loadAllPlayers
}

export default connect(mapStateToProps, mapDispatchToProps)(PlayersPage)
