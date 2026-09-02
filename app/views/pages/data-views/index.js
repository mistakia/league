import { connect } from 'react-redux'
import { createSelector } from 'reselect'
import { all } from 'redux-saga/effects'
import { notify as report_error } from '@core/bugsnag'

import { inject_reducer, inject_saga } from '@core/store'
import {
  get_stats_state,
  get_selected_data_view,
  get_teams_for_current_year,
  get_data_views,
  get_has_unsaved_local_edits_map
} from '@core/selectors'
import {
  data_views_actions,
  data_views_reducer,
  data_view_organization_reducer,
  data_views_sagas
} from '@core/data-views'
import { data_view_request_reducer } from '@core/data-view-request/reducer'
import {
  get_enriched_data_views_fields,
  get_data_view_organization_props_for_table_view_controller
} from '@core/data-views/selectors'
import { get_data_views_fields } from '@core/data-views-fields'
import { apply_column_id_rename } from '#libs-shared/data-views-saved-view-migration.mjs'
import { calculatePercentiles } from '#libs-shared'
import * as table_constants from 'react-table/src/constants.mjs'

import DataViewsPage from './data-views'

inject_reducer('data_views', data_views_reducer)
inject_reducer('data_view_organization', data_view_organization_reducer)
inject_reducer('data_view_request', data_view_request_reducer)
inject_saga('data_views', function* root_data_views_saga() {
  yield all(data_views_sagas)
})

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
        // This branch is the ONLY alarm for a rename that stranded a real
        // user's saved view -- the 2026-08-17 counting-stat conform blanked
        // SEASON_PROJECTIONS for every user this way (signals 125880/125881,
        // then 127159/127160 for the persisted views). So it must keep
        // reporting. What it could not previously say is WHICH of two very
        // different conditions it caught, and both triage passes to date spent
        // their effort re-deriving that by hand:
        //
        //   a rename we failed to declare -- `apply_column_id_rename` has no
        //   record for the id, but the id was one WE emitted, and the repair
        //   is a COLUMN_ID entry in the rename registry; or
        //
        //   an id the app never emitted at all, hand-supplied by someone
        //   probing the API (signals 127510/127512-127514/127525-127527 came
        //   from one client, in views named "TEST col id probe" and "PROBE
        //   touches ids"), which is user input error and not our defect.
        //
        // Since dafd34743 the saved-view read path already applies
        // migrate_table_state, so any id reaching here has ALREADY been
        // through the registry. Reporting whether a rename record exists for
        // it separates the two populations at the point of emission instead of
        // leaving it to be measured per signal.
        const renamed_to = apply_column_id_rename(column_id)
        report_error(new Error(`Field not found for column_id: ${column_id}`), {
          field_info: {
            column_id,
            index,
            // A rename record exists but the id still did not resolve: the
            // registry entry points somewhere dead. Absent one, the id is not
            // a name this app ever emitted.
            has_rename_record: renamed_to !== column_id,
            renamed_to: renamed_to !== column_id ? renamed_to : null,
            // Identity only. The whole table_state was shipped here until
            // 2026-09-01; on a wide saved view that is kilobytes of columns
            // and params per occurrence, durable and full-text indexed in the
            // signal queue, and triage has only ever needed the view to look
            // up. Deliberately mirrors the payload restraint set_user applies.
            view_id: selected_data_view?.view_id ?? null,
            view_name: selected_data_view?.view_name ?? null,
            column_count: table_state_columns.length
          }
        })
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
  get_enriched_data_views_fields,
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
  (state) => state.getIn(['websocket', 'is_connected']),
  get_has_unsaved_local_edits_map,
  get_data_view_organization_props_for_table_view_controller,
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
    is_socket_connected,
    has_unsaved_local_edits_map,
    view_organization_props
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
    data_view_request: data_view_request.toJS(),
    is_socket_connected,
    ...view_organization_props
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
  clear_local_view_cache: data_views_actions.clear_local_view_cache,
  // View organization dispatchers (B14)
  on_toggle_favorite: data_views_actions.toggle_data_view_favorite,
  on_add_user_tag: data_views_actions.add_data_view_tag,
  on_remove_user_tag: data_views_actions.remove_data_view_tag
}

export default connect(map_state_to_props, map_dispatch_to_props)(DataViewsPage)
