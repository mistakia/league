import { connect } from 'react-redux'
import { createSelector } from 'reselect'
import { all } from 'redux-saga/effects'

import { inject_reducer, inject_saga } from '@core/store'
import {
  plays_views_actions,
  plays_views_reducer,
  plays_views_sagas
} from '@core/plays-view'
import { plays_view_request_reducer } from '@core/plays-view-request/reducer'
import plays_view_fields from '@core/plays-view-fields'
import derive_plays_percentile_stats from '@core/plays-view/derive-plays-percentile-stats.mjs'
import { calculatePercentiles } from '#libs-shared'

import PlaysPage from './plays'

inject_reducer('plays_views', plays_views_reducer)
inject_reducer('plays_view_request', plays_view_request_reducer)
inject_saga('plays_views', function* root_plays_views_saga() {
  yield all(plays_views_sagas)
})

const get_plays_views = (state) => state.get('plays_views')

const get_selected_plays_view_id = (state) =>
  state.getIn(['app', 'selected_plays_view_id'])

const get_selected_plays_view = createSelector(
  get_selected_plays_view_id,
  get_plays_views,
  (view_id, views) => {
    const default_view_id = 'DEFAULT_PLAYS_VIEW'
    const selected_id = view_id || default_view_id
    const view = views.get(selected_id)
    return view ? view.toJS() : views.get(default_view_id).toJS()
  }
)

// The result rows, converted ONCE per result. `toJS` on a full result is the
// most expensive thing this page does, and both the table and the percentiles
// below want the same rows -- doing it in the combiner would convert them again
// on every unrelated store change, and a second time for the percentiles.
const get_plays_result_rows = createSelector(
  (state) => state.getIn(['plays_view_request', 'result']),
  (result) => result.toJS()
)

// The request slice MINUS its rows. The page reads current_request, status,
// position and metadata off this and never the rows, which it takes from
// `plays` -- so converting the whole slice meant a second full copy of the same
// result on every render.
const get_plays_view_request_props = createSelector(
  (state) => state.get('plays_view_request'),
  (plays_view_request) => plays_view_request.delete('result').toJS()
)

const get_plays_percentiles = createSelector(
  get_plays_result_rows,
  get_selected_plays_view,
  (plays, selected_plays_view) => {
    const { percentile_stat_keys, reverse_percentile_stats } =
      derive_plays_percentile_stats({
        table_state_columns: selected_plays_view.table_state.columns,
        plays_view_fields
      })

    return calculatePercentiles({
      items: plays,
      stats: percentile_stat_keys,
      reverse_percentile_stats
    })
  }
)

const map_state_to_props = createSelector(
  (state) => state.getIn(['app', 'userId']),
  get_selected_plays_view,
  get_plays_views,
  (state) => state.getIn(['app', 'user', 'username']),
  get_plays_view_request_props,
  get_plays_result_rows,
  get_plays_percentiles,
  (
    userId,
    selected_plays_view,
    plays_views,
    user_username,
    plays_view_request,
    plays,
    percentiles
  ) => ({
    user_id: userId,
    plays,
    isLoggedIn: Boolean(userId),
    selected_plays_view,
    plays_view_fields,
    plays_views: plays_views.toList().toJS(),
    user_username,
    plays_view_request,
    percentiles
  })
)

const map_dispatch_to_props = {
  plays_view_changed: plays_views_actions.plays_view_changed,
  set_selected_plays_view: plays_views_actions.set_selected_plays_view,
  delete_plays_view: plays_views_actions.delete_plays_view,
  save_plays_view: plays_views_actions.save_plays_view,
  load_plays_views: plays_views_actions.load_plays_views,
  reset_plays_view_cache: plays_views_actions.reset_plays_view_cache,
  load_plays_view: plays_views_actions.load_plays_view
}

export default connect(map_state_to_props, map_dispatch_to_props)(PlaysPage)
