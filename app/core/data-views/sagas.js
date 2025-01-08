import { takeLatest, fork, call, select, put } from 'redux-saga/effects'

import { data_views_actions } from './actions'
import {
  default_data_view_view_id
} from './default-data-views'
import {
  post_data_view,
  get_data_views,
  delete_data_view,
  get_data_view
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
import { notificationActions } from '@core/notifications/actions'

function* handle_data_view_request({ data_view, ignore_cache = false }) {
  const { columns } = data_view.table_state

  if (!columns.length) {
    return
  }

  const opts = {
    view_id: data_view.view_id,
    ...data_view.table_state
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
  const { view_state_changed, view_metadata_changed } = view_change_params

  if (view_metadata_changed) {
    yield fork(save_data_view, { payload })
  }

  if (view_state_changed) {
    const data_view = yield select(get_selected_data_view)
    yield call(handle_data_view_request, { data_view })
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

  yield call(post_data_view, params)
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

  yield call(delete_data_view, { view_id })
}

export function* load_data_views({ payload }) {
  const request_history = yield select(get_request_history)
  const { user_id, username } = payload
  const key = `GET_DATA_VIEWS${user_id ? `_USER_ID_${user_id}` : username ? `_USERNAME_${username}` : ''}`
  if (request_history[key]) {
    return
  }
  yield call(get_data_views, { user_id, username })
}

export function* load_data_view({ payload }) {
  const { data_view_id } = payload
  yield call(get_data_view, { data_view_id })
}

export function* post_data_view_fulfilled_notification() {
  yield put(
    notificationActions.show({
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
    notificationActions.show({
      message: 'Deleted Players Table View',
      severity: 'success'
    })
  )
}

export function* handle_get_data_view_fulfilled({ payload }) {
  yield put(data_views_actions.set_selected_data_view(payload.data.view_id))
  yield call(handle_data_view_request, { data_view: payload.data })
}

//= ====================================
//  WATCHERS
// -------------------------------------

export function* watchPlayersTableViewChanged() {
  yield takeLatest(data_views_actions.DATA_VIEW_CHANGED, data_view_changed)
}

export function* watchSetSelectedPlayersTableView() {
  yield takeLatest(data_views_actions.SET_SELECTED_DATA_VIEW, data_view_changed)
}

export function* watchSavePlayersTableView() {
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

//= ====================================
//  ROOT
// -------------------------------------

export const data_views_sagas = [
  fork(watchPlayersTableViewChanged),
  fork(watchSetSelectedPlayersTableView),
  fork(watchSavePlayersTableView),
  fork(watch_load_data_views),
  fork(watch_post_data_view_fulfilled),
  fork(watch_delete_data_view),
  fork(watch_delete_data_view_fulfilled),
  fork(watch_reset_data_view_cache),
  fork(watch_load_data_view),
  fork(watch_get_data_view_fulfilled)
]
