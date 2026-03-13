import { takeLatest, fork, call, select, put } from 'redux-saga/effects'

import { plays_views_actions } from './index'
import { default_plays_view_view_id } from './default-plays-views'
import {
  api_post_plays_view,
  api_get_plays_views,
  api_delete_plays_view,
  api_get_plays_view
} from '@core/api'
import { send } from '@core/ws'
import { get_app, get_request_history } from '@core/selectors'
import { plays_view_request_actions } from '@core/plays-view-request/actions'
import { notification_actions } from '@core/notifications/actions'

import {
  plays_view_browser_storage_save_snapshot,
  plays_view_browser_storage_get_latest_snapshot,
  plays_view_browser_storage_clear_view_history,
  plays_view_browser_storage_set_last_active_view,
  plays_view_browser_storage_get_last_active_view,
  plays_view_browser_storage_cleanup_old_views,
  plays_view_browser_storage_get_all_view_ids,
  plays_view_browser_storage_load_metadata
} from './browser-storage.mjs'

const get_selected_plays_view_id = (state) =>
  state.getIn(['app', 'selected_plays_view_id'])

const get_plays_views = (state) => state.get('plays_views')

const get_selected_plays_view = (state) => {
  const view_id = get_selected_plays_view_id(state)
  return get_plays_views(state)
    .get(view_id || default_plays_view_view_id)
    .toJS()
}

const get_plays_view_by_id = (state, { view_id }) => {
  return state.get('plays_views').get(view_id)
}

function* handle_plays_view_request({
  data_view,
  ignore_cache = false,
  append_results = false
}) {
  const { columns } = data_view.table_state

  if (!columns.length) {
    return
  }

  const opts = {
    view_id: data_view.view_id,
    ...data_view.table_state,
    append_results,
    source: 'plays_page'
  }

  yield call(send, {
    type: 'PLAYS_VIEW_REQUEST',
    payload: {
      request_id: data_view.view_id,
      params: opts,
      ignore_cache
    }
  })

  yield put(plays_view_request_actions.plays_view_request(opts))
}

function* handle_selected_player_plays_request({ payload }) {
  const { columns, where, sort, params, group_by, offset, limit } = payload

  if (!columns || !columns.length) {
    return
  }

  const request_id = `selected_player_${where?.[0]?.value || 'unknown'}`

  const opts = {
    columns,
    where,
    sort,
    params,
    group_by,
    offset,
    limit,
    append_results: false,
    source: 'selected_player'
  }

  yield call(send, {
    type: 'PLAYS_VIEW_REQUEST',
    payload: {
      request_id,
      params: opts,
      ignore_cache: false
    }
  })

  yield put(
    plays_view_request_actions.plays_view_request({
      request_id,
      source: 'selected_player',
      ...opts
    })
  )
}

export function* plays_view_changed({ payload }) {
  const { view_change_params = {} } = payload
  const { view_state_changed, view_metadata_changed, append_results } =
    view_change_params

  yield call(persist_table_state_to_browser, { payload })

  if (view_metadata_changed) {
    yield fork(save_plays_view, { payload })
  }

  if (view_state_changed) {
    const data_view = yield select(get_selected_plays_view)
    yield call(handle_plays_view_request, { data_view, append_results })
  }
}

export function* reset_plays_view_cache() {
  const data_view = yield select(get_selected_plays_view)
  yield call(handle_plays_view_request, { data_view, ignore_cache: true })
}

export function* save_plays_view({ payload }) {
  const { data_view } = payload
  const { view_id, view_name, view_description, table_state } = data_view

  const params = {
    view_name,
    view_description,
    table_state
  }

  const { userId } = yield select(get_app)
  const view = yield select(get_plays_view_by_id, { view_id })
  if (userId !== view.get('user_id')) {
    console.warn('User does not have permission to save this view')
    return
  }

  if (view.get('user_id')) {
    params.view_id = view_id
  } else {
    params.client_generated_view_id = view_id
  }

  yield call(api_post_plays_view, params)
}

export function* handle_delete_plays_view({ payload }) {
  const { data_view_id: view_id } = payload
  const view = yield select(get_plays_view_by_id, { view_id })
  const { userId } = yield select(get_app)

  if (view.get('user_id') !== userId) {
    console.warn('User does not have permission to delete this view')
    return
  }

  yield call(api_delete_plays_view, { view_id })
}

export function* load_plays_views({ payload }) {
  const request_history = yield select(get_request_history)
  const { user_id, username } = payload
  const key = `GET_PLAYS_VIEWS${user_id ? `_USER_ID_${user_id}` : username ? `_USERNAME_${username}` : ''}`
  if (request_history[key]) {
    return
  }
  yield call(api_get_plays_views, { user_id, username })
}

export function* load_plays_view({ payload }) {
  const { data_view_id } = payload
  yield call(api_get_plays_view, { data_view_id })
}

export function* post_plays_view_fulfilled_notification() {
  yield put(
    notification_actions.show({
      message: 'Saved Plays View',
      severity: 'success'
    })
  )
}

export function* handle_delete_plays_view_fulfilled({ payload }) {
  const selected_view_id = yield select(get_selected_plays_view_id)
  if (payload.opts.view_id === selected_view_id) {
    yield put(
      plays_views_actions.set_selected_plays_view(default_plays_view_view_id)
    )
  }

  yield put(
    notification_actions.show({
      message: 'Deleted Plays View',
      severity: 'success'
    })
  )
}

export function* handle_get_plays_view_fulfilled({ payload }) {
  const data = { ...payload.data }
  if (typeof data.table_state === 'string') {
    data.table_state = JSON.parse(data.table_state)
  }
  yield put(plays_views_actions.set_selected_plays_view(data.view_id))
  yield call(handle_plays_view_request, { data_view: data })
}

export function* handle_get_plays_views_fulfilled({ payload }) {
  yield call(restore_browser_state_for_all_views, payload)
}

//= ====================================
//  BROWSER PERSISTENCE
// -------------------------------------

const CLEANUP_INTERVAL_MS = 10 * 60 * 1000

function* cleanup_if_needed() {
  try {
    const metadata = yield call(plays_view_browser_storage_load_metadata)
    const now = Date.now()
    const last_cleanup = metadata.last_cleanup || 0

    if (now - last_cleanup > CLEANUP_INTERVAL_MS) {
      yield call(plays_view_browser_storage_cleanup_old_views)
    }
  } catch (error) {
    console.error('Error checking cleanup:', error)
  }
}

export function* persist_table_state_to_browser({ payload }) {
  try {
    const { data_view, view_change_params = {} } = payload
    const { view_state_changed } = view_change_params

    if (view_state_changed === false) {
      return
    }

    if (!data_view) {
      return
    }

    const { view_id, table_state } = data_view
    const { is_new_view } = view_change_params

    if (!view_id || !table_state) {
      return
    }

    const view = yield select(get_plays_view_by_id, { view_id })
    const saved_table_state = view?.get('saved_table_state')

    if (saved_table_state) {
      const saved_state_js = saved_table_state.toJS
        ? saved_table_state.toJS()
        : saved_table_state

      const is_resetting_to_saved =
        JSON.stringify(table_state) === JSON.stringify(saved_state_js)

      if (is_resetting_to_saved) {
        return
      }
    }

    yield call(plays_view_browser_storage_save_snapshot, {
      view_id,
      table_state,
      change_type: 'user_edit'
    })

    if (is_new_view) {
      yield call(plays_view_browser_storage_set_last_active_view, view_id)
    }

    yield call(cleanup_if_needed)
  } catch (error) {
    console.error('Error persisting table state to browser:', error)
  }
}

export function* persist_selected_view_to_browser({ payload }) {
  try {
    const { data_view_id } = payload

    if (!data_view_id) {
      return
    }

    yield call(plays_view_browser_storage_set_last_active_view, data_view_id)
  } catch (error) {
    console.error('Error persisting selected view to browser:', error)
  }
}

function* collect_all_view_ids(server_data) {
  const all_views = yield select((state) => state.get('plays_views'))
  const browser_view_ids = yield call(
    plays_view_browser_storage_get_all_view_ids
  )

  return new Set([
    ...(server_data ? server_data.map((v) => v.view_id) : []),
    ...all_views.keySeq().toArray(),
    ...browser_view_ids
  ])
}

function* restore_view_states_from_browser(view_ids) {
  for (const view_id of view_ids) {
    const snapshot = yield call(
      plays_view_browser_storage_get_latest_snapshot,
      view_id
    )

    if (snapshot && snapshot.table_state) {
      yield put(
        plays_views_actions.plays_view_changed(
          {
            view_id,
            table_state: snapshot.table_state
          },
          {
            view_state_changed: false
          }
        )
      )
    }
  }
}

function* restore_last_active_view_if_default(all_view_ids) {
  const current_selected_id = yield select(get_selected_plays_view_id)

  if (current_selected_id !== default_plays_view_view_id) {
    return
  }

  const last_active = yield call(
    plays_view_browser_storage_get_last_active_view
  )

  if (!last_active || !last_active.view_id) {
    yield put(
      plays_views_actions.set_selected_plays_view(default_plays_view_view_id)
    )
    return
  }

  const view_exists = all_view_ids.has(last_active.view_id)
  const view_id_to_select = view_exists
    ? last_active.view_id
    : default_plays_view_view_id

  yield put(plays_views_actions.set_selected_plays_view(view_id_to_select))
}

export function* restore_browser_state_for_all_views({ data }) {
  try {
    const all_view_ids = yield call(collect_all_view_ids, data)
    yield call(restore_view_states_from_browser, all_view_ids)
    yield call(restore_last_active_view_if_default, all_view_ids)
  } catch (error) {
    console.error('Error restoring browser state for all views:', error)
  }
}

export function* mark_server_save_in_history({ payload }) {
  try {
    const { data } = payload
    const { view_id, table_state } = data

    if (!view_id || !table_state) {
      return
    }

    yield call(plays_view_browser_storage_save_snapshot, {
      view_id,
      table_state,
      change_type: 'server_save'
    })
  } catch (error) {
    console.error('Error marking server save in browser history:', error)
  }
}

export function* cleanup_browser_state_on_delete({ payload }) {
  try {
    const { opts } = payload
    const { view_id } = opts

    if (!view_id) {
      return
    }

    yield call(plays_view_browser_storage_clear_view_history, view_id)
  } catch (error) {
    console.error('Error cleaning up browser state on delete:', error)
  }
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watch_plays_view_changed() {
  yield takeLatest(plays_views_actions.PLAYS_VIEW_CHANGED, plays_view_changed)
}

export function* watch_set_selected_plays_view() {
  yield takeLatest(
    plays_views_actions.SET_SELECTED_PLAYS_VIEW,
    plays_view_changed
  )
}

export function* watch_save_plays_view() {
  yield takeLatest(plays_views_actions.SAVE_PLAYS_VIEW, save_plays_view)
}

export function* watch_load_plays_views() {
  yield takeLatest(plays_views_actions.LOAD_PLAYS_VIEWS, load_plays_views)
}

export function* watch_post_plays_view_fulfilled() {
  yield takeLatest(
    plays_views_actions.POST_PLAYS_VIEW_FULFILLED,
    post_plays_view_fulfilled_notification
  )
}

export function* watch_delete_plays_view_fulfilled() {
  yield takeLatest(
    plays_views_actions.DELETE_PLAYS_VIEW_FULFILLED,
    handle_delete_plays_view_fulfilled
  )
}

export function* watch_delete_plays_view() {
  yield takeLatest(
    plays_views_actions.DELETE_PLAYS_VIEW,
    handle_delete_plays_view
  )
}

export function* watch_reset_plays_view_cache() {
  yield takeLatest(
    plays_views_actions.RESET_PLAYS_VIEW_CACHE,
    reset_plays_view_cache
  )
}

export function* watch_load_plays_view() {
  yield takeLatest(plays_views_actions.LOAD_PLAYS_VIEW, load_plays_view)
}

export function* watch_get_plays_view_fulfilled() {
  yield takeLatest(
    plays_views_actions.GET_PLAYS_VIEW_FULFILLED,
    handle_get_plays_view_fulfilled
  )
}

export function* watch_get_plays_views_fulfilled() {
  yield takeLatest(
    plays_views_actions.GET_PLAYS_VIEWS_FULFILLED,
    handle_get_plays_views_fulfilled
  )
}

export function* watch_post_plays_view_fulfilled_for_browser_mark() {
  yield takeLatest(
    plays_views_actions.POST_PLAYS_VIEW_FULFILLED,
    mark_server_save_in_history
  )
}

export function* watch_delete_plays_view_fulfilled_for_browser_cleanup() {
  yield takeLatest(
    plays_views_actions.DELETE_PLAYS_VIEW_FULFILLED,
    cleanup_browser_state_on_delete
  )
}

export function* watch_selected_player_plays_request() {
  yield takeLatest(
    plays_views_actions.SELECTED_PLAYER_PLAYS_REQUEST,
    handle_selected_player_plays_request
  )
}

export function* watch_set_selected_plays_view_for_browser_persist() {
  yield takeLatest(
    plays_views_actions.SET_SELECTED_PLAYS_VIEW,
    persist_selected_view_to_browser
  )
}

//= ====================================
//  ROOT
// -------------------------------------

export const plays_views_sagas = [
  fork(watch_plays_view_changed),
  fork(watch_set_selected_plays_view),
  fork(watch_save_plays_view),
  fork(watch_load_plays_views),
  fork(watch_post_plays_view_fulfilled),
  fork(watch_delete_plays_view),
  fork(watch_delete_plays_view_fulfilled),
  fork(watch_reset_plays_view_cache),
  fork(watch_load_plays_view),
  fork(watch_get_plays_view_fulfilled),
  fork(watch_get_plays_views_fulfilled),
  fork(watch_post_plays_view_fulfilled_for_browser_mark),
  fork(watch_delete_plays_view_fulfilled_for_browser_cleanup),
  fork(watch_set_selected_plays_view_for_browser_persist),
  fork(watch_selected_player_plays_request)
]
