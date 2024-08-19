import { takeLatest, fork, call, select, put } from 'redux-saga/effects'

import { players_table_views_actions } from './actions'
import { default_players_table_views } from './default-players-table-views'
import {
  post_players_table_view_search,
  post_players_table_view,
  get_players_table_views,
  delete_players_table_view
} from '@core/api'
import {
  get_app,
  get_selected_players_table_view,
  get_players_table_view_by_id,
  get_request_history,
  get_selected_players_table_view_id
} from '@core/selectors'
import { notificationActions } from '@core/notifications/actions'

export function* players_table_view_changed({ payload }) {
  const { view_change_params = {} } = payload
  const { view_state_changed, view_metadata_changed } = view_change_params

  if (view_metadata_changed) {
    yield fork(save_players_table_view, { payload })
  }

  if (!view_state_changed) {
    return
  }

  const players_table_view = yield select(get_selected_players_table_view)
  const { columns } = players_table_view.table_state

  if (!columns.length) {
    return
  }

  const opts = {
    view_id: players_table_view.view_id,
    ...players_table_view.table_state
  }

  yield call(post_players_table_view_search, opts)
}

export function* save_players_table_view({ payload }) {
  const { players_table_view } = payload
  const { view_id, view_name, view_description, table_state } =
    players_table_view

  const params = {
    view_name,
    view_description,
    table_state
  }

  const { userId } = yield select(get_app)
  const view = yield select(get_players_table_view_by_id, { view_id })
  if (userId !== view.get('user_id')) {
    console.warn('User does not have permission to save this view')
    return
  }

  // if the view already exists use the view_id, otherwise the server will create a new one
  if (view.get('saved_table_state')) {
    params.view_id = view_id
  } else {
    params.client_generated_view_id = view_id
  }

  yield call(post_players_table_view, params)
}

export function* handle_delete_players_table_view({ payload }) {
  const { players_table_view_id: view_id } = payload
  const view = yield select(get_players_table_view_by_id, { view_id })
  const { userId } = yield select(get_app)

  console.log('view', view.toJS())
  console.log('userId', userId)

  if (view.get('user_id') !== userId) {
    console.warn('User does not have permission to delete this view')
    return
  }

  yield call(delete_players_table_view, { view_id })
}

export function* load_players_table_views({ payload }) {
  const request_history = yield select(get_request_history)
  const { user_id, username } = payload
  const key = `GET_PLAYERS_TABLE_VIEWS${user_id ? `_USER_ID_${user_id}` : username ? `_USERNAME_${username}` : ''}`
  if (request_history[key]) {
    return
  }
  yield call(get_players_table_views, { user_id, username })
}

export function* post_players_table_view_fulfilled_notification() {
  yield put(
    notificationActions.show({
      message: 'Saved Players Table View',
      severity: 'success'
    })
  )
}

export function* handle_delete_players_table_view_fulfilled({ payload }) {
  const selected_view_id = yield select(get_selected_players_table_view_id)
  if (payload.opts.view_id === selected_view_id) {
    yield put(
      players_table_views_actions.set_selected_players_table_view(
        default_players_table_views.SEASON_PROJECTIONS.view_id
      )
    )
  }

  yield put(
    notificationActions.show({
      message: 'Deleted Players Table View',
      severity: 'success'
    })
  )
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchPlayersTableViewChanged() {
  yield takeLatest(
    players_table_views_actions.PLAYERS_TABLE_VIEW_CHANGED,
    players_table_view_changed
  )
}

export function* watchSetSelectedPlayersTableView() {
  yield takeLatest(
    players_table_views_actions.SET_SELECTED_PLAYERS_TABLE_VIEW,
    players_table_view_changed
  )
}

export function* watchSavePlayersTableView() {
  yield takeLatest(
    players_table_views_actions.SAVE_PLAYERS_TABLE_VIEW,
    save_players_table_view
  )
}

export function* watch_load_players_table_views() {
  yield takeLatest(
    players_table_views_actions.LOAD_PLAYERS_TABLE_VIEWS,
    load_players_table_views
  )
}

export function* watch_post_players_table_view_fulfilled() {
  yield takeLatest(
    players_table_views_actions.POST_PLAYERS_TABLE_VIEW_FULFILLED,
    post_players_table_view_fulfilled_notification
  )
}

export function* watch_delete_players_table_view_fulfilled() {
  yield takeLatest(
    players_table_views_actions.DELETE_PLAYERS_TABLE_VIEW_FULFILLED,
    handle_delete_players_table_view_fulfilled
  )
}

export function* watch_delete_players_table_view() {
  yield takeLatest(
    players_table_views_actions.DELETE_PLAYERS_TABLE_VIEW,
    handle_delete_players_table_view
  )
}

//= ====================================
//  ROOT
// -------------------------------------

export const players_table_views_sagas = [
  fork(watchPlayersTableViewChanged),
  fork(watchSetSelectedPlayersTableView),
  fork(watchSavePlayersTableView),
  fork(watch_load_players_table_views),
  fork(watch_post_players_table_view_fulfilled),
  fork(watch_delete_players_table_view),
  fork(watch_delete_players_table_view_fulfilled)
]
