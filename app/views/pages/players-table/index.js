import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import {
  getStats,
  get_selected_players_table_view,
  getTeams
} from '@core/selectors'
import { players_table_views_actions } from '@core/players-table-views'
import { getPlayerTableFields } from '@core/player-table-fields'
import { calculatePercentiles } from '@libs-shared'
import * as table_constants from 'react-table/src/constants.mjs'

import PlayersTablePage from './players-table'

const get_players_table_views = createSelector(
  (state) => state.get('players_table_views'),
  (players_table_views) => players_table_views.toList().toJS()
)

const get_players_percentiles = createSelector(
  (state) => state.getIn(['players', 'items']),
  (state) => state.getIn(['players', 'players_table_view_result_pids']),
  get_selected_players_table_view,
  getPlayerTableFields,
  (
    player_maps,
    players_table_view_result_pids,
    selected_players_table_view,
    player_fields
  ) => {
    const players = players_table_view_result_pids
      .map((pid) => player_maps.get(pid))
      .toJS()

    const percentile_stat_keys = []
    for (const column of selected_players_table_view.table_state.columns) {
      const column_id = typeof column === 'string' ? column : column.column_id
      const field = player_fields[column_id]

      if (field.data_type === table_constants.TABLE_DATA_TYPES.NUMBER) {
        percentile_stat_keys.push(field.player_value_path)
      }
    }

    const percentiles = calculatePercentiles({
      items: players,
      stats: percentile_stat_keys
    })

    return percentiles
  }
)

const mapStateToProps = createSelector(
  (state) => state.getIn(['players', 'items']),
  (state) => state.getIn(['players', 'players_table_view_result_pids']),
  (state) => state.getIn(['players', 'allPlayersPending']),
  (state) => state.getIn(['app', 'userId']),
  getStats,
  getPlayerTableFields,
  get_selected_players_table_view,
  get_players_table_views,
  (state) => state.getIn(['players', 'selected']),
  (state) => state.getIn(['app', 'teamId']),
  (state) => state.getIn(['players', 'highlight_teamIds']),
  getTeams,
  get_players_percentiles,
  (
    player_maps,
    players_table_view_result_pids,
    allPlayersPending,
    userId,
    stats,
    player_fields,
    selected_players_table_view,
    players_table_views,
    selected_player_pid,
    teamId,
    highlight_team_ids,
    teams,
    players_percentiles
  ) => ({
    players: players_table_view_result_pids
      .map((pid) => player_maps.get(pid))
      .toJS(),
    isLoggedIn: Boolean(userId),
    isPending:
      allPlayersPending ||
      (selected_players_table_view.view_id.includes('STATS_BY_PLAY') &&
        stats.isPending), // TODO handle player fields being loaded (stats, etc)
    selected_players_table_view,
    player_fields,
    players_table_views,
    selected_player_pid,
    teamId,
    highlight_team_ids,
    teams,
    players_percentiles
  })
)

const mapDispatchToProps = {
  players_table_view_changed:
    players_table_views_actions.players_table_view_changed,
  set_selected_players_table_view:
    players_table_views_actions.set_selected_players_table_view,
  delete_players_table_view:
    players_table_views_actions.delete_players_table_view
}

export default connect(mapStateToProps, mapDispatchToProps)(PlayersTablePage)
