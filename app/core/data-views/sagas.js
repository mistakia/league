import { takeLatest, fork, call, select, put } from 'redux-saga/effects'

import { data_views_actions } from './index'
import { default_data_view_view_id } from './default-data-views'
import {
  api_post_data_view,
  api_get_data_views,
  api_delete_data_view,
  api_get_data_view
} from '@core/api'
import { send } from '@core/ws'
import {
  get_app,
  get_selected_data_view,
  get_data_view_by_id,
  get_request_history,
  get_selected_data_view_id
} from '@core/selectors'
import { data_view_request_actions } from '@core/data-view-request/actions'
import { notification_actions } from '@core/notifications/actions'

import {
  data_view_browser_storage_save_snapshot,
  data_view_browser_storage_get_latest_snapshot,
  data_view_browser_storage_clear_view_history,
  data_view_browser_storage_set_last_active_view,
  data_view_browser_storage_get_last_active_view,
  data_view_browser_storage_cleanup_old_views,
  data_view_browser_storage_get_all_view_ids,
  data_view_browser_storage_load_metadata
} from './browser-storage.mjs'

function* handle_data_view_request({
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
    append_results
  }

  yield call(send, {
    type: 'DATA_VIEW_REQUEST',
    payload: {
      request_id: data_view.view_id,
      params: opts,
      ignore_cache
    }
  })

  console.log(`Sending data view request: ${opts.view_id}`)

  yield put(data_view_request_actions.data_view_request(opts))
}

export function* data_view_changed({ payload }) {
  const { view_change_params = {} } = payload
  const { view_state_changed, view_metadata_changed, append_results } =
    view_change_params

  // Handle browser persistence first
  yield call(persist_table_state_to_browser, { payload })

  if (view_metadata_changed) {
    yield fork(save_data_view, { payload })
  }

  if (view_state_changed) {
    const data_view = yield select(get_selected_data_view)
    yield call(handle_data_view_request, { data_view, append_results })
  }
}

export function* reset_data_view_cache() {
  const data_view = yield select(get_selected_data_view)
  yield call(handle_data_view_request, { data_view, ignore_cache: true })
}

export function* save_data_view({ payload }) {
  const { data_view } = payload
  const { view_id, view_name, view_description, table_state } = data_view

  const params = {
    view_name,
    view_description,
    table_state
  }

  const { userId } = yield select(get_app)
  const view = yield select(get_data_view_by_id, { view_id })
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

  yield call(api_post_data_view, params)
}

export function* handle_delete_data_view({ payload }) {
  const { data_view_id: view_id } = payload
  const view = yield select(get_data_view_by_id, { view_id })
  const { userId } = yield select(get_app)

  console.log('view', view.toJS())
  console.log('userId', userId)

  if (view.get('user_id') !== userId) {
    console.warn('User does not have permission to delete this view')
    return
  }

  yield call(api_delete_data_view, { view_id })
}

export function* load_data_views({ payload }) {
  const request_history = yield select(get_request_history)
  const { user_id, username } = payload
  const key = `GET_DATA_VIEWS${user_id ? `_USER_ID_${user_id}` : username ? `_USERNAME_${username}` : ''}`
  if (request_history[key]) {
    return
  }
  yield call(api_get_data_views, { user_id, username })
}

export function* load_data_view({ payload }) {
  const { data_view_id } = payload
  yield call(api_get_data_view, { data_view_id })
}

export function* post_data_view_fulfilled_notification() {
  yield put(
    notification_actions.show({
      message: 'Saved Players Table View',
      severity: 'success'
    })
  )
}

export function* handle_delete_data_view_fulfilled({ payload }) {
  const selected_view_id = yield select(get_selected_data_view_id)
  if (payload.opts.view_id === selected_view_id) {
    yield put(
      data_views_actions.set_selected_data_view(default_data_view_view_id)
    )
  }

  yield put(
    notification_actions.show({
      message: 'Deleted Players Table View',
      severity: 'success'
    })
  )
}

export function* handle_get_data_view_fulfilled({ payload }) {
  yield put(data_views_actions.set_selected_data_view(payload.data.view_id))
  yield call(handle_data_view_request, { data_view: payload.data })
}

export function* handle_get_data_views_fulfilled({ payload }) {
  // After views are loaded from server, restore browser state if available
  yield call(restore_browser_state_for_all_views, payload)
}

//= ====================================
//  BROWSER PERSISTENCE
// -------------------------------------

// Cleanup interval: 10 minutes
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000

/**
 * Check if cleanup is needed based on time elapsed since last cleanup
 */
function* cleanup_if_needed() {
  try {
    const metadata = yield call(data_view_browser_storage_load_metadata)
    const now = Date.now()
    const last_cleanup = metadata.last_cleanup || 0

    if (now - last_cleanup > CLEANUP_INTERVAL_MS) {
      yield call(data_view_browser_storage_cleanup_old_views)
    }
  } catch (error) {
    console.error('Error checking cleanup:', error)
  }
}

/**
 * Persist table state to browser localStorage on every change
 * Triggered by DATA_VIEW_CHANGED action
 */
export function* persist_table_state_to_browser({ payload }) {
  try {
    const { data_view, view_change_params = {} } = payload
    const { view_state_changed } = view_change_params

    // Skip persistence if this is a restoration operation (not a user edit)
    // This prevents circular persistence when restore_view_states_from_browser runs
    if (view_state_changed === false) {
      return
    }

    // Skip if data_view is not provided (e.g., from SET_SELECTED_DATA_VIEW)
    if (!data_view) {
      return
    }

    const { view_id, table_state } = data_view
    const { is_new_view } = view_change_params

    if (!view_id || !table_state) {
      return
    }

    // Detect if we're resetting to saved state by comparing with saved_table_state
    // If the incoming table_state matches saved_table_state, skip browser persistence
    // This prevents creating browser snapshots when user clicks "Reset"
    const view = yield select(get_data_view_by_id, { view_id })
    const saved_table_state = view?.get('saved_table_state')

    if (saved_table_state) {
      // Convert to plain JS if it's an Immutable object, otherwise use as is
      const saved_state_js = saved_table_state.toJS
        ? saved_table_state.toJS()
        : saved_table_state

      const is_resetting_to_saved =
        JSON.stringify(table_state) === JSON.stringify(saved_state_js)

      if (is_resetting_to_saved) {
        // Don't persist to browser when resetting to saved state
        return
      }
    }

    // Save snapshot to browser storage
    yield call(data_view_browser_storage_save_snapshot, {
      view_id,
      table_state,
      change_type: 'user_edit'
    })

    // Track last active view if this is a new view
    // (for existing views, SET_SELECTED_DATA_VIEW handles this)
    if (is_new_view) {
      yield call(data_view_browser_storage_set_last_active_view, view_id)
    }

    // Time-based periodic cleanup
    yield call(cleanup_if_needed)
  } catch (error) {
    // Log errors but don't fail the action
    console.error('Error persisting table state to browser:', error)
  }
}

/**
 * Persist last active view when view selection changes
 * Triggered by SET_SELECTED_DATA_VIEW action
 */
export function* persist_selected_view_to_browser({ payload }) {
  try {
    const { data_view_id } = payload

    if (!data_view_id) {
      return
    }

    // Track last active view
    yield call(data_view_browser_storage_set_last_active_view, data_view_id)
  } catch (error) {
    // Log errors but don't fail the action
    console.error('Error persisting selected view to browser:', error)
  }
}

/**
 * Collect all view IDs from server, Redux, and browser storage
 */
function* collect_all_view_ids(server_data) {
  const all_views = yield select((state) => state.get('data_views'))
  const browser_view_ids = yield call(
    data_view_browser_storage_get_all_view_ids
  )

  return new Set([
    ...(server_data ? server_data.map((v) => v.view_id) : []),
    ...all_views.keySeq().toArray(),
    ...browser_view_ids
  ])
}

/**
 * Restore browser state for each view
 */
function* restore_view_states_from_browser(view_ids) {
  for (const view_id of view_ids) {
    const snapshot = yield call(
      data_view_browser_storage_get_latest_snapshot,
      view_id
    )

    if (snapshot && snapshot.table_state) {
      yield put(
        data_views_actions.data_view_changed(
          {
            view_id,
            table_state: snapshot.table_state
          },
          {
            view_state_changed: false // Don't trigger data request yet
          }
        )
      )
    }
  }
}

/**
 * Restore last active view if no URL override
 */
function* restore_last_active_view_if_default(all_view_ids) {
  const current_selected_id = yield select(get_selected_data_view_id)

  // Only restore if current selection is default (not overridden by URL)
  if (current_selected_id !== default_data_view_view_id) {
    return
  }

  const last_active = yield call(data_view_browser_storage_get_last_active_view)

  if (!last_active || !last_active.view_id) {
    yield put(
      data_views_actions.set_selected_data_view(default_data_view_view_id)
    )
    return
  }

  const view_exists = all_view_ids.has(last_active.view_id)
  const view_id_to_select = view_exists
    ? last_active.view_id
    : default_data_view_view_id

  yield put(data_views_actions.set_selected_data_view(view_id_to_select))
}

/**
 * Restore browser state for all views after server load
 * Merges browser-saved table_state with server-saved views and includes unsaved views
 */
export function* restore_browser_state_for_all_views({ data }) {
  try {
    // 1. Collect all view IDs from server, Redux, and browser storage
    const all_view_ids = yield call(collect_all_view_ids, data)

    // 2. Restore browser state for all views
    yield call(restore_view_states_from_browser, all_view_ids)

    // 3. Restore last active view if appropriate
    yield call(restore_last_active_view_if_default, all_view_ids)
  } catch (error) {
    // Log errors and fall through to normal init
    console.error('Error restoring browser state for all views:', error)
  }
}

/**
 * Mark server save in browser history
 * Triggered by POST_DATA_VIEW_FULFILLED action
 */
export function* mark_server_save_in_history({ payload }) {
  try {
    const { data } = payload
    const { view_id, table_state } = data

    if (!view_id || !table_state) {
      return
    }

    // Save snapshot with server_save type for potential future history UI
    yield call(data_view_browser_storage_save_snapshot, {
      view_id,
      table_state,
      change_type: 'server_save'
    })
  } catch (error) {
    // Log errors but don't fail the action
    console.error('Error marking server save in browser history:', error)
  }
}

/**
 * Clean up browser storage when view is deleted
 * Triggered by DELETE_DATA_VIEW_FULFILLED action
 */
export function* cleanup_browser_state_on_delete({ payload }) {
  try {
    const { opts } = payload
    const { view_id } = opts

    if (!view_id) {
      return
    }

    // Clear browser storage for this view
    yield call(data_view_browser_storage_clear_view_history, view_id)
  } catch (error) {
    // Log errors but don't fail the action
    console.error('Error cleaning up browser state on delete:', error)
  }
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watch_players_table_view_changed() {
  yield takeLatest(data_views_actions.DATA_VIEW_CHANGED, data_view_changed)
}

export function* watch_set_selected_players_table_view() {
  yield takeLatest(data_views_actions.SET_SELECTED_DATA_VIEW, data_view_changed)
}

export function* watch_save_players_table_view() {
  yield takeLatest(data_views_actions.SAVE_DATA_VIEW, save_data_view)
}

export function* watch_load_data_views() {
  yield takeLatest(data_views_actions.LOAD_DATA_VIEWS, load_data_views)
}

export function* watch_post_data_view_fulfilled() {
  yield takeLatest(
    data_views_actions.POST_DATA_VIEW_FULFILLED,
    post_data_view_fulfilled_notification
  )
}

export function* watch_delete_data_view_fulfilled() {
  yield takeLatest(
    data_views_actions.DELETE_DATA_VIEW_FULFILLED,
    handle_delete_data_view_fulfilled
  )
}

export function* watch_delete_data_view() {
  yield takeLatest(data_views_actions.DELETE_DATA_VIEW, handle_delete_data_view)
}

export function* watch_reset_data_view_cache() {
  yield takeLatest(
    data_views_actions.RESET_DATA_VIEW_CACHE,
    reset_data_view_cache
  )
}

export function* watch_load_data_view() {
  yield takeLatest(data_views_actions.LOAD_DATA_VIEW, load_data_view)
}

export function* watch_get_data_view_fulfilled() {
  yield takeLatest(
    data_views_actions.GET_DATA_VIEW_FULFILLED,
    handle_get_data_view_fulfilled
  )
}

export function* watch_get_data_views_fulfilled() {
  yield takeLatest(
    data_views_actions.GET_DATA_VIEWS_FULFILLED,
    handle_get_data_views_fulfilled
  )
}

export function* watch_post_data_view_fulfilled_for_browser_mark() {
  yield takeLatest(
    data_views_actions.POST_DATA_VIEW_FULFILLED,
    mark_server_save_in_history
  )
}

export function* watch_delete_data_view_fulfilled_for_browser_cleanup() {
  yield takeLatest(
    data_views_actions.DELETE_DATA_VIEW_FULFILLED,
    cleanup_browser_state_on_delete
  )
}

export function* watch_set_selected_data_view_for_browser_persist() {
  yield takeLatest(
    data_views_actions.SET_SELECTED_DATA_VIEW,
    persist_selected_view_to_browser
  )
}

//= ====================================
//  ROOT
// -------------------------------------

export const data_views_sagas = [
  fork(watch_players_table_view_changed),
  fork(watch_set_selected_players_table_view),
  fork(watch_save_players_table_view),
  fork(watch_load_data_views),
  fork(watch_post_data_view_fulfilled),
  fork(watch_delete_data_view),
  fork(watch_delete_data_view_fulfilled),
  fork(watch_reset_data_view_cache),
  fork(watch_load_data_view),
  fork(watch_get_data_view_fulfilled),
  fork(watch_get_data_views_fulfilled),
  fork(watch_post_data_view_fulfilled_for_browser_mark),
  fork(watch_delete_data_view_fulfilled_for_browser_cleanup),
  fork(watch_set_selected_data_view_for_browser_persist)
]
