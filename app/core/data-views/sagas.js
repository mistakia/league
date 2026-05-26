import {
  takeLatest,
  fork,
  call,
  select,
  put,
  debounce
} from 'redux-saga/effects'

import { data_views_actions } from './index'
import {
  default_data_view_view_id,
  default_data_views
} from './default-data-views'
import {
  api_post_data_view,
  api_get_data_views,
  api_delete_data_view,
  api_get_data_view,
  api_get_data_view_organization,
  api_post_data_view_favorite,
  api_delete_data_view_favorite,
  api_post_data_view_tag,
  api_delete_data_view_tag
} from '@core/api'
import { api, api_request } from '@core/api/service'
import { send } from '@core/ws'

// nfl_plays_column_params is 51 KiB of static metadata used only inside the
// collect_object_preset_params helper below. Defer it to its own chunk so it
// doesn't ride in the main bundle for users who never hit the data-views
// param-option-counts path.
let _nfl_plays_column_params_cache = null
function* load_nfl_plays_column_params() {
  if (_nfl_plays_column_params_cache) return _nfl_plays_column_params_cache
  const mod = yield call(
    () =>
      import(
        /* webpackChunkName: "nfl-plays-column-params" */ '#libs-shared/nfl-plays-column-params.mjs'
      )
  )
  _nfl_plays_column_params_cache = mod.default
  return _nfl_plays_column_params_cache
}
import {
  get_app,
  get_selected_data_view,
  get_data_view_by_id,
  get_request_history,
  get_selected_data_view_id
} from '@core/selectors'
import { data_view_request_actions } from '@core/data-view-request/actions'
import { notification_actions } from '@core/notifications/actions'
import store_registry from '@core/store-registry'

import {
  init_storage,
  save_snapshot,
  load_latest_snapshot,
  save_last_active_view,
  load_last_active_view,
  clear_view,
  clear_all,
  reconcile_server_views,
  get_all_stored_view_ids
} from '#libs-shared/data-view-storage/storage.mjs'
import { is_valid_table_state } from '#libs-shared/data-view-storage/validate.mjs'
import deep_equal from '@core/utils/deep_equal'

const DEFAULT_VIEW_IDS = new Set(Object.keys(default_data_views))

// Install quota-exceeded callback at module load (before any saga runs) so
// a DATA_VIEW_CHANGED arriving before the root saga reaches this line is still
// covered. store_registry.getStore() is the saga-side dispatch escape hatch.
init_storage({
  on_quota_exceeded: () => {
    const store = store_registry.getStore()
    if (!store) return
    store.dispatch(
      notification_actions.show({
        message: 'Could not save local view changes -- storage is full',
        severity: 'error'
      })
    )
  }
})

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
  yield call(restore_browser_state_for_all_views, payload)
  yield call(handle_reconcile_server_views, payload)
}

//= ====================================
//  BROWSER PERSISTENCE
// -------------------------------------

export function* persist_table_state_to_browser({ payload }) {
  try {
    const { data_view, view_change_params = {} } = payload
    const { view_state_changed, is_new_view, change_type } = view_change_params

    if (view_state_changed === false) return
    if (!data_view) return

    const { view_id, table_state } = data_view
    if (!view_id) return

    yield call(save_snapshot, {
      view_id,
      table_state,
      change_type: change_type || 'user_edit',
      is_new_view: Boolean(is_new_view)
    })

    if (is_new_view) {
      yield call(save_last_active_view, view_id)
    }
  } catch (error) {
    console.error('Error persisting table state to browser:', error)
  }
}

export function* persist_selected_view_to_browser({ payload }) {
  try {
    const { data_view_id } = payload
    if (!data_view_id) return
    if (DEFAULT_VIEW_IDS.has(data_view_id)) return
    yield call(save_last_active_view, data_view_id)
  } catch (error) {
    console.error('Error persisting selected view to browser:', error)
  }
}

function* collect_all_view_ids(server_data) {
  const all_views = yield select((state) => state.get('data_views'))
  const browser_view_ids = yield call(get_all_stored_view_ids)

  return new Set([
    ...(server_data ? server_data.map((v) => v.view_id) : []),
    ...all_views.keySeq().toArray(),
    ...browser_view_ids
  ])
}

function* restore_view_states_from_browser(view_ids) {
  for (const view_id of view_ids) {
    if (DEFAULT_VIEW_IDS.has(view_id)) continue

    const snapshot = yield call(load_latest_snapshot, view_id)
    if (!snapshot || !is_valid_table_state(snapshot.table_state)) continue

    // Skip dispatch when the browser snapshot matches the server-saved state
    // for this view - no user edits to restore, avoids startup write
    // amplification from the debounce watcher.
    const view = yield select(get_data_view_by_id, { view_id })
    const saved = view?.get('saved_table_state')
    if (saved != null) {
      const saved_js = saved.toJS ? saved.toJS() : saved
      if (deep_equal(snapshot.table_state, saved_js)) continue
    }

    yield put(
      data_views_actions.restore_data_view_table_state({
        view_id,
        table_state: snapshot.table_state
      })
    )
  }
}

function* restore_last_active_view_if_default(all_view_ids) {
  const current_selected_id = yield select(get_selected_data_view_id)
  if (current_selected_id !== default_data_view_view_id) return

  const last_active = yield call(load_last_active_view)

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

export function* restore_browser_state_for_all_views({ data }) {
  try {
    const all_view_ids = yield call(collect_all_view_ids, data)
    yield call(restore_view_states_from_browser, all_view_ids)
    yield call(restore_last_active_view_if_default, all_view_ids)
  } catch (error) {
    console.error('Error restoring browser state for all views:', error)
  }
}

export function* handle_reconcile_server_views({ data }) {
  try {
    const server_view_ids = Array.isArray(data)
      ? data.map((v) => v.view_id)
      : []
    const all_views = yield select((state) => state.get('data_views'))
    const redux_view_ids = all_views.keySeq().toArray()
    yield call(reconcile_server_views, { server_view_ids, redux_view_ids })
  } catch (error) {
    console.error('Error reconciling server views:', error)
  }
}

export function* mark_server_save_in_history({ payload }) {
  try {
    const { data } = payload
    const { view_id, table_state } = data

    if (!view_id || !table_state) return

    yield call(save_snapshot, {
      view_id,
      table_state,
      change_type: 'server_save',
      is_new_view: false
    })
  } catch (error) {
    console.error('Error marking server save in browser history:', error)
  }
}

export function* cleanup_browser_state_on_delete({ payload }) {
  try {
    const { opts } = payload
    const { view_id } = opts
    if (!view_id) return
    yield call(clear_view, view_id)
  } catch (error) {
    console.error('Error cleaning up browser state on delete:', error)
  }
}

export function* handle_revert_data_view({ payload }) {
  try {
    const { view_id } = payload
    if (!view_id) return
    yield call(clear_view, view_id)
  } catch (error) {
    console.error('Error handling revert data view:', error)
  }
}

export function* handle_clear_local_view_cache() {
  try {
    yield call(clear_all)
  } catch (error) {
    console.error('Error clearing local view cache:', error)
  }
}

//= ====================================
//  PARAM OPTION COUNTS
// -------------------------------------

// DATA_VIEW_RESULT is handled only by the reducer, never dispatching
// DATA_VIEW_CHANGED -- the debounce watcher below is therefore safe from a
// fetch -> result -> fetch feedback loop.

const TABLE_DATA_TYPES_OBJECT_PRESET = 9

const collect_object_preset_params = (table_state, column_params) => {
  const where = Array.isArray(table_state?.where) ? table_state.where : []
  const param_names = new Set()
  const signature_parts = []
  for (let i = 0; i < where.length; i++) {
    const where_params = where[i]?.params
    if (!where_params || typeof where_params !== 'object') continue
    const keys = Object.keys(where_params)
      .filter((k) => {
        const def = column_params[k]
        return def && def.data_type === TABLE_DATA_TYPES_OBJECT_PRESET
      })
      .sort()
    for (const k of keys) {
      param_names.add(k)
      signature_parts.push(`${i}:${k}:${JSON.stringify(where_params[k])}`)
    }
  }
  return {
    param_names: Array.from(param_names),
    signature: signature_parts.join('|')
  }
}

function* fetch_param_option_counts({ table_state, target_param_name }) {
  try {
    const { token } = yield select(get_app)
    const { request } = api_request(
      api.post_data_view_param_option_counts,
      { table_state, target_param_name },
      token
    )
    const data = yield call(request)
    yield put(
      data_view_request_actions.param_option_counts_fulfilled({
        target_param_name,
        counts: data?.counts || {}
      })
    )
  } catch (err) {
    console.error('param-option-counts fetch failed', target_param_name, err)
  }
}

export function* maybe_fetch_param_option_counts() {
  const data_view = yield select(get_selected_data_view)
  const table_state = data_view?.table_state
  if (!table_state) return

  const view_id = data_view.view_id
  const column_params = yield call(load_nfl_plays_column_params)
  const { param_names, signature } = collect_object_preset_params(
    table_state,
    column_params
  )

  const last_signatures = yield select((state) =>
    state.getIn(['data_view_request', 'param_option_counts_signatures'])
  )
  const last_signature = last_signatures ? last_signatures.get(view_id) : null
  if (last_signature === signature) return

  yield put(
    data_view_request_actions.param_option_counts_signature_set({
      view_id,
      signature
    })
  )

  for (const target_param_name of param_names) {
    yield call(fetch_param_option_counts, { table_state, target_param_name })
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

export function* watch_revert_data_view() {
  yield takeLatest(data_views_actions.REVERT_DATA_VIEW, handle_revert_data_view)
}

export function* watch_clear_local_view_cache() {
  yield takeLatest(
    data_views_actions.CLEAR_LOCAL_VIEW_CACHE,
    handle_clear_local_view_cache
  )
}

// ======================================
// View organization sagas (B11)
// ======================================

// Load organization data after views are fetched (hydrate favorites + tags)
export function* handle_get_views_fulfilled_load_organization() {
  const { token } = yield select(get_app)
  if (!token) return
  yield call(api_get_data_view_organization)
}

export function* watch_get_data_views_fulfilled_load_organization() {
  yield takeLatest(
    data_views_actions.GET_DATA_VIEWS_FULFILLED,
    handle_get_views_fulfilled_load_organization
  )
}

// Saga handlers for page-dispatched trigger actions
export function* handle_toggle_data_view_favorite({ payload }) {
  const { view_id, is_favorited } = payload
  if (is_favorited) {
    yield call(api_delete_data_view_favorite, { view_id })
  } else {
    yield call(api_post_data_view_favorite, { view_id })
  }
}

export function* watch_toggle_data_view_favorite() {
  yield takeLatest(
    data_views_actions.TOGGLE_DATA_VIEW_FAVORITE,
    handle_toggle_data_view_favorite
  )
}

export function* handle_add_data_view_tag({ payload }) {
  const { view_id, tag_name } = payload
  yield call(api_post_data_view_tag, { view_id, tag_name })
}

export function* watch_add_data_view_tag() {
  yield takeLatest(
    data_views_actions.ADD_DATA_VIEW_TAG,
    handle_add_data_view_tag
  )
}

export function* handle_remove_data_view_tag({ payload }) {
  const { view_id, tag_name } = payload
  yield call(api_delete_data_view_tag, { view_id, tag_name })
}

export function* watch_remove_data_view_tag() {
  yield takeLatest(
    data_views_actions.REMOVE_DATA_VIEW_TAG,
    handle_remove_data_view_tag
  )
}

// Favorite toggle sagas
export function* handle_post_data_view_favorite_failed() {
  yield put(
    notification_actions.show({
      message: 'Failed to add favorite',
      severity: 'error'
    })
  )
}

export function* watch_post_data_view_favorite_failed() {
  yield takeLatest(
    data_views_actions.POST_DATA_VIEW_FAVORITE_FAILED,
    handle_post_data_view_favorite_failed
  )
}

export function* handle_delete_data_view_favorite_failed() {
  yield put(
    notification_actions.show({
      message: 'Failed to remove favorite',
      severity: 'error'
    })
  )
}

export function* watch_delete_data_view_favorite_failed() {
  yield takeLatest(
    data_views_actions.DELETE_DATA_VIEW_FAVORITE_FAILED,
    handle_delete_data_view_favorite_failed
  )
}

// Tag mutation sagas
export function* handle_post_data_view_tag_failed() {
  yield put(
    notification_actions.show({
      message: 'Failed to add tag',
      severity: 'error'
    })
  )
}

export function* watch_post_data_view_tag_failed() {
  yield takeLatest(
    data_views_actions.POST_DATA_VIEW_TAG_FAILED,
    handle_post_data_view_tag_failed
  )
}

export function* handle_delete_data_view_tag_failed() {
  yield put(
    notification_actions.show({
      message: 'Failed to remove tag',
      severity: 'error'
    })
  )
}

export function* watch_delete_data_view_tag_failed() {
  yield takeLatest(
    data_views_actions.DELETE_DATA_VIEW_TAG_FAILED,
    handle_delete_data_view_tag_failed
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
  fork(watch_set_selected_data_view_for_browser_persist),
  fork(watch_revert_data_view),
  fork(watch_clear_local_view_cache),
  fork(watch_get_data_views_fulfilled_load_organization),
  fork(watch_post_data_view_favorite_failed),
  fork(watch_delete_data_view_favorite_failed),
  fork(watch_post_data_view_tag_failed),
  fork(watch_delete_data_view_tag_failed),
  fork(watch_toggle_data_view_favorite),
  fork(watch_add_data_view_tag),
  fork(watch_remove_data_view_tag),
  debounce(
    250,
    data_views_actions.DATA_VIEW_CHANGED,
    persist_table_state_to_browser
  ),
  debounce(
    250,
    data_views_actions.DATA_VIEW_CHANGED,
    maybe_fetch_param_option_counts
  )
]
