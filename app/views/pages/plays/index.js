import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { plays_views_actions } from '@core/plays-view'
import plays_view_fields from '@core/plays-view-fields'

import PlaysPage from './plays'

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

const map_state_to_props = createSelector(
  (state) => state.getIn(['app', 'userId']),
  get_selected_plays_view,
  get_plays_views,
  (state) => state.getIn(['app', 'user', 'username']),
  (state) => state.get('plays_view_request'),
  (userId, selected_plays_view, plays_views, user_username, plays_view_request) => ({
    user_id: userId,
    plays: plays_view_request.get('result').toJS(),
    isLoggedIn: Boolean(userId),
    selected_plays_view,
    plays_view_fields,
    plays_views: plays_views.toList().toJS(),
    user_username,
    plays_view_request: plays_view_request.toJS()
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
