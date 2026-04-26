import { connect } from 'react-redux'
import { createSelector } from 'reselect'
import Bugsnag from '@bugsnag/js'

import {
  get_stats_state,
  get_selected_data_view,
  get_teams_for_current_year,
  get_data_views,
  get_has_unsaved_local_edits_map
} from '@core/selectors'
import { data_views_actions } from '@core/data-views'
import { get_data_views_fields } from '@core/data-views-fields'
import { calculatePercentiles } from '@libs-shared'
import * as table_constants from 'react-table/src/constants.mjs'

import DataViewsPage from './data-views'

const get_players_percentiles = createSelector(
  (state) => state.getIn(['data_view_request', 'result']),
  get_selected_data_view,
  get_data_views_fields,
  (data_view_items, selected_data_view, data_views_fields) => {
    const percentile_stat_keys = []
    const reverse_percentile_stats = {}
    const table_state_columns = []
    for (const [
      index,
      column
    ] of selected_data_view.table_state.columns.entries()) {
      const column_id = typeof column === 'string' ? column : column.column_id
      const column_params =
        typeof column === 'string' ? {} : column.params || {}
      table_state_columns.push({
        index,
        column_id,
        column_params
      })
    }

    for (const { index, column_id, column_params } of table_state_columns) {
      const field = data_views_fields[column_id]

      if (!field) {
        console.log(`Field not found for column_id: ${column_id}`)
        Bugsnag.notify(
          new Error(`Field not found for column_id: ${column_id}`),
          (event) => {
            event.addMetadata('field_info', {
              column_id,
              index,
              data_view: selected_data_view
            })
          }
        )
        continue
      }

      const columns_with_same_id = table_state_columns.filter(
        ({ column_id: c_id }) => c_id === column_id
      )
      const column_index = columns_with_same_id.findIndex(
        ({ index: i }) => i === index
      )

      if (field.data_type === table_constants.TABLE_DATA_TYPES.NUMBER) {
        const stat_key = `${field.player_value_path}_${column_index}`
        percentile_stat_keys.push(stat_key)
        const is_reversed =
          typeof field.reverse_percentiles === 'function'
            ? field.reverse_percentiles(column_params)
            : field.reverse_percentiles
        if (is_reversed) {
          reverse_percentile_stats[stat_key] = true
        }
      }
    }

    const percentiles = calculatePercentiles({
      items: data_view_items.toJS(),
      stats: percentile_stat_keys,
      reverse_percentile_stats
    })

    return percentiles
  }
)

const map_state_to_props = createSelector(
  (state) => state.getIn(['players', 'allPlayersPending']),
  (state) => state.getIn(['app', 'userId']),
  get_stats_state,
  get_data_views_fields,
  get_selected_data_view,
  get_data_views,
  (state) => state.getIn(['players', 'selected']),
  (state) => state.getIn(['app', 'teamId']),
  (state) => state.getIn(['app', 'leagueId']),
  (state) => state.getIn(['players', 'highlight_teamIds']),
  get_teams_for_current_year,
  get_players_percentiles,
  (state) => state.getIn(['app', 'user', 'username']),
  (state) => state.get('data_view_request'),
  get_has_unsaved_local_edits_map,
  (
    allPlayersPending,
    userId,
    stats,
    data_views_fields,
    selected_data_view,
    data_views,
    selected_player_pid,
    teamId,
    leagueId,
    highlight_team_ids,
    teams,
    players_percentiles,
    user_username,
    data_view_request,
    has_unsaved_local_edits_map
  ) => ({
    user_id: userId,
    players: data_view_request.get('result').toJS(),
    isLoggedIn: Boolean(userId),
    isPending:
      allPlayersPending ||
      (selected_data_view.view_id.includes('STATS_BY_PLAY') && stats.isPending), // TODO handle player fields being loaded (stats, etc)
    selected_data_view,
    data_views_fields,
    data_views: data_views
      .toList()
      .toJS()
      .map((view) => ({
        ...view,
        has_unsaved_local_edits: Boolean(
          has_unsaved_local_edits_map[view.view_id]
        )
      })),
    selected_player_pid,
    teamId,
    leagueId,
    highlight_team_ids,
    teams,
    players_percentiles,
    user_username,
    data_view_request: data_view_request.toJS()
  })
)

const map_dispatch_to_props = {
  data_view_changed: data_views_actions.data_view_changed,
  set_selected_data_view: data_views_actions.set_selected_data_view,
  delete_data_view: data_views_actions.delete_data_view,
  save_data_view: data_views_actions.save_data_view,
  load_data_views: data_views_actions.load_data_views,
  reset_data_view_cache: data_views_actions.reset_data_view_cache,
  load_data_view: data_views_actions.load_data_view,
  revert_data_view: data_views_actions.revert_data_view,
  clear_local_view_cache: data_views_actions.clear_local_view_cache
}

export default connect(map_state_to_props, map_dispatch_to_props)(DataViewsPage)
