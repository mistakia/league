import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  get_stats_state,
  get_selected_players_page_view,
  is_player_filter_options_changed
} from '@core/selectors'
import { get_player_fields } from '@core/player-fields'
import { player_actions } from '@core/players'
import { roster_actions } from '@core/rosters'
import { stat_actions } from '@core/stats'
import {
  getSelectedViewGroupedFields,
  getFilteredPlayers
} from '@core/players/selectors'

import PlayersPage from './players'

const map_state_to_props = createSelector(
  getFilteredPlayers,
  (state) => state.getIn(['players', 'allPlayersPending']),
  (state) => state.getIn(['players', 'search']),
  (state) => state.getIn(['players', 'order']),
  (state) => state.getIn(['players', 'orderBy']),
  (state) => state.getIn(['app', 'userId']),
  get_stats_state,
  get_selected_players_page_view,
  getSelectedViewGroupedFields,
  get_player_fields,
  is_player_filter_options_changed,
  (
    players,
    allPlayersPending,
    searchValue,
    order,
    orderBy,
    userId,
    stats,
    selected_players_page_view,
    selected_view_grouped_fields,
    player_fields,
    is_player_filter_options_changed
  ) => ({
    players,
    selected_view_grouped_fields,
    is_logged_in: Boolean(userId),
    isPending:
      allPlayersPending ||
      (selected_players_page_view.key.includes('stats_by_play') &&
        stats.isPending), // TODO handle player fields being loaded (stats, etc)
    searchValue,
    order,
    orderBy,
    selected_players_page_view,
    show_week_filter: Boolean(
      selected_players_page_view.fields.find((f) => f.includes('.week'))
    ),
    show_play_filters: Boolean(
      selected_players_page_view.fields.find((f) => f.includes('stats.'))
    ),
    show_qualifier_filter: Boolean(
      stats.qualifiers.get(orderBy.split('.').pop())
    ),
    player_fields,
    is_player_filter_options_changed
  })
)

const map_dispatch_to_props = {
  search: player_actions.search,
  reset_player_filter_options: player_actions.reset_player_filter_options,
  load_rosters: roster_actions.load_rosters,
  load_all_players: player_actions.load_all_players,
  init_charted_plays: stat_actions.init_charted_plays
}

export default connect(map_state_to_props, map_dispatch_to_props)(PlayersPage)
