import {
  takeLatest,
  fork,
  call,
  select,
  put,
  debounce,
  race,
  take,
  delay
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
import { send, isOpen, wsActions } from '@core/ws'
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

  yield put(data_view_request_actions.data_view_request(opts))
}

//= ====================================
//  REQUEST WATCHDOG / RECONNECT REPLAY
// -------------------------------------

// How long the server may stay SILENT before we call the request lost. This is
// a silence budget, not a deadline measured from send: every progress message
// resets it. That distinction is the whole design. Queue wait is unbounded and
// is added on top of execution time, so any fixed deadline from send fires on
// requests that were merely queued behind other work.
//
// The server heartbeats every 2s from acceptance through queue wait AND
// execution, which is what makes a silence budget well-defined at all: a
// budget is only meaningful against a guaranteed MAXIMUM silence, and until
// the heartbeat there was none. A queued request used to get exactly two
// messages before its result -- one position on entry, one status when it
// reached the head -- so legitimate silence spanned the whole queue wait and
// was unbounded in queue DEPTH rather than in any query's timeout.
export const DATA_VIEW_HEARTBEAT_INTERVAL = 2 * 1000

// Six missed heartbeats. Derived from the interval rather than chosen, which
// is the point -- it is correct at any queue depth and coupled to no server
// timeout constant. Do NOT re-derive it from the server's 5-minute signed-in
// execution timeout: that constant is a placeholder introduced whole in
// b395a7b3b (2024-08-23) replacing an untimed call and never revisited.
export const DATA_VIEW_SILENCE_TIMEOUT = 6 * DATA_VIEW_HEARTBEAT_INTERVAL

// Used until this request has actually SEEN a heartbeat. The tight budget above
// is only valid against a server that provides the guarantee it is derived
// from, so applying it to a server that does not heartbeat would fail every
// request slower than 12s -- and measured p50 is 5.1s with a 22-34s tail, so
// that is most of them, not an edge case.
//
// This is deliberately not a migration shim to delete once the server ships.
// It removes the deploy-ordering coupling permanently, in a repo whose
// recurring production incident is a PARTIAL deploy (a frontend shipped
// without its backend, or the reverse), and it keeps the client safe if the
// heartbeat later regresses server-side. The client tightens its budget
// exactly when the server has demonstrated the guarantee, and never on the
// assumption of it.
export const DATA_VIEW_SILENCE_TIMEOUT_WITHOUT_HEARTBEAT = 6 * 60 * 1000

const PROGRESS_ACTIONS = [
  data_view_request_actions.DATA_VIEW_HEARTBEAT,
  data_view_request_actions.DATA_VIEW_POSITION,
  data_view_request_actions.DATA_VIEW_STATUS
]

const TERMINAL_ACTIONS = [
  data_view_request_actions.DATA_VIEW_RESULT,
  data_view_request_actions.DATA_VIEW_ERROR
]

// A request that never terminates leaves the page on a bare spinner forever.
// Nothing else in the client bounds it: the reducer reaches a terminal status
// only on a server-sent result or error, so a dropped reply, a crashed API
// process, or a restart mid-flight simply hangs.
export function* handle_data_view_request_watchdog({ payload }) {
  const started_at = Date.now()
  let has_seen_heartbeat = false

  while (true) {
    const { timed_out, progress, settled } = yield race({
      timed_out: delay(
        has_seen_heartbeat
          ? DATA_VIEW_SILENCE_TIMEOUT
          : DATA_VIEW_SILENCE_TIMEOUT_WITHOUT_HEARTBEAT
      ),
      progress: take(PROGRESS_ACTIONS),
      settled: take(TERMINAL_ACTIONS)
    })

    if (settled) {
      yield call(report_client_observed_duration, {
        view_id: payload.view_id,
        execution_id: settled.payload?.execution_id,
        duration_ms: Date.now() - started_at,
        settled_type: settled.type
      })
      return
    }

    // One heartbeat is the server demonstrating the guarantee the tight budget
    // is derived from, so the budget tightens from here on for this request.
    if (progress?.type === data_view_request_actions.DATA_VIEW_HEARTBEAT) {
      has_seen_heartbeat = true
    }

    if (!timed_out) continue

    // A closed socket is not a timeout. The reconnect loop is already working
    // the problem and will replay this request when it lands, so surfacing an
    // error here would replace a recoverable state with a dead end.
    if (!isOpen()) return

    yield put({
      type: data_view_request_actions.DATA_VIEW_ERROR,
      payload: {
        request_id: payload.view_id,
        error: 'Timed out waiting for the server to respond',
        client_timeout: true
      }
    })
    return
  }
}

export function* watch_data_view_request_watchdog() {
  // takeLatest, so a superseding request cancels the previous watchdog rather
  // than leaving it to fire against a request nobody is waiting on.
  yield takeLatest(
    data_view_request_actions.DATA_VIEW_REQUEST,
    handle_data_view_request_watchdog
  )
}

// One measurement, one send. The server owns every threshold and does the
// classification and emission; the client reports only what the server cannot
// observe, which is when the answer actually reached the browser. Sent over
// the socket that is already open -- deliberately not an HTTP endpoint, which
// would be an anonymous write that mints signals.
function* report_client_observed_duration({
  view_id,
  execution_id,
  duration_ms,
  settled_type
}) {
  if (!isOpen()) return

  // execution_id is SERVER-minted and echoed back from the terminal frame. It
  // is what makes the frame attributable at all: request_id is the VIEW id, so
  // two in-flight requests for one view share it -- the same field behind the
  // 2026-07-31 double-render defect. The server drops any timing frame whose
  // execution_id is not live for that socket, so an unattributable frame is
  // better dropped than sent under an ambiguous id.
  //
  // This guard depends on the server minting execution_id at request ENTRY,
  // not at queue admission. A CACHE HIT answers from send_cached_result and
  // never enters the queue, so an id minted in the queue path would leave
  // every cache hit unattributable and silently drop its timing -- which
  // deletes exactly the fast-path denominator that sending on every settled
  // request (no client-side floor) exists to preserve, biasing any percentile
  // toward cache misses with nothing reporting the gap.
  if (!execution_id) return

  yield call(send, {
    type: 'DATA_VIEW_CLIENT_TIMING',
    payload: {
      request_id: view_id,
      execution_id,
      client_duration_ms: duration_ms,
      outcome:
        settled_type === data_view_request_actions.DATA_VIEW_RESULT
          ? 'result'
          : 'error'
    }
  })
}

// The client buffers only messages it could not send; a DATA_VIEW_REQUEST
// already on the wire when the socket dropped is simply lost, and the reducer
// keeps the view id rather than the params, so nothing could retransmit it.
// Re-deriving the request from the selected view is what makes the reconnect
// actually restore the page instead of reconnecting into the same spinner.
export function* replay_in_flight_data_view_request() {
  const status = yield select((state) =>
    state.getIn(['data_view_request', 'status'])
  )

  if (status !== 'pending' && status !== 'processing') return

  const data_view = yield select(get_selected_data_view)
  if (!data_view) return

  yield call(handle_data_view_request, { data_view })
}

export function* watch_websocket_reconnected() {
  yield takeLatest(
    wsActions.WEBSOCKET_RECONNECTED,
    replay_in_flight_data_view_request
  )
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

  // Update in place only when this is the requester's own persisted view.
  // Any other view -- a draft, or one hydrated from a shared /u/<hash> link
  // (no user_id, or a foreign owner) -- is saved as a new view via
  // client_generated_view_id so the server forks it (see api/routes/
  // data-views.mjs) and POST_DATA_VIEW_FULFILLED re-keys local state from the
  // client id to the server-assigned id. Never silently drop the save.
  const is_own_saved_view =
    Boolean(view) &&
    view.get('user_id') === userId &&
    Boolean(view.get('saved_table_state'))

  if (is_own_saved_view) {
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

export function* load_data_views() {
  const { userId } = yield select(get_app)

  // GET /api/data-views requires a user — 216c1a5d0 closed an anonymous leak of
  // every saved view on the platform. An anonymous visitor has no saved views
  // to list, and waiting on a request that can only 401 left the page with NO
  // view ever selected: the bootstrap that ends in the results request hangs
  // off GET_DATA_VIEWS_FULFILLED, so /data-views rendered its headers and an
  // empty body indefinitely, with nothing in the console and no failed request
  // the page reacted to. Restore straight from the browser instead, which is
  // the only place an anonymous visitor's view state lives.
  if (!userId) {
    yield call(restore_browser_state_for_all_views, { data: [] })
    return
  }

  const request_history = yield select(get_request_history)
  if (request_history.has('GET_DATA_VIEWS')) {
    return
  }
  yield call(api_get_data_views)
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
  // set_selected_data_view carries view_state_changed, and the
  // SET_SELECTED_DATA_VIEW watcher runs data_view_changed -> the results
  // request. Issuing one here too put two identical requests on the wire for
  // every direct link to a saved view.
  yield put(data_views_actions.set_selected_data_view(payload.data.view_id))
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
  fork(watch_data_view_request_watchdog),
  fork(watch_websocket_reconnected),
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
