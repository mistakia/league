import { call, fork, put, select, takeLatest } from 'redux-saga/effects'

import { send, wsActions } from '@core/ws'
import { data_views_actions } from '@core/data-views'
import { get_selected_data_view } from '@core/selectors'
import {
  save_pending_generation,
  load_pending_generation,
  clear_pending_generation
} from '#libs-shared/data-view-storage/storage.mjs'

import { data_view_generation_actions } from './actions'

// The client half of the generation transport.
//
// It sends exactly two frames -- DATA_VIEW_GENERATION_REQUEST and
// DATA_VIEW_GENERATION_COLLECT -- and everything else it does is a consequence
// of a frame the server sent back. The inbound frames need no saga at all: the
// websocket service dispatches them into the store directly and the reducer
// handles them. What needs a saga is the two side effects the reducer must not
// have: writing the id to localStorage, and applying a finished view to the
// page.

// Job statuses that are still moving. Mirrors LIVE_STATUSES in
// libs-server/data-views/generation/generation-job-queue.mjs; a status outside
// this set is terminal and there is nothing left to collect.
const LIVE_STATUSES = ['queued', 'dispatched', 'running']

export function* submit_generation({ payload }) {
  yield call(send, {
    type: 'DATA_VIEW_GENERATION_REQUEST',
    payload: {
      instruction: payload.instruction,
      table_state: payload.table_state
    }
  })
}

// Persisted on ACCEPTED rather than on submit, because until the server answers
// there is no id -- the queue can refuse, and a refusal carries none.
export function* persist_accepted_generation({ payload }) {
  if (!payload.generation_id) return
  const data_view = yield select(get_selected_data_view)
  yield call(save_pending_generation, {
    generation_id: payload.generation_id,
    view_id: data_view?.view_id ?? null
  })
}

/**
 * Apply a finished run, and drop the stored id once there is nothing to collect.
 *
 * ONLY the registry branch applies a table_state. A query-branch answer is a
 * saved statement rather than a display contract and a refusal is an
 * explanation, so both are rendered by the control and neither replaces the
 * user's view.
 */
export function* handle_generation_update({ payload }) {
  if (LIVE_STATUSES.includes(payload.status)) return

  yield call(clear_pending_generation)

  if (payload.status !== 'completed') return
  if (payload.generation_branch !== 'registry') return

  const table_state = payload.result?.table_state
  if (!table_state) return

  const data_view = yield select(get_selected_data_view)
  if (!data_view) return

  // Through data_view_changed rather than restore_data_view_table_state: the
  // restore action updates the store and fires NO request, so it would leave
  // the page rendering the previous result's rows under the generated view's
  // columns. view_state_changed is what runs the query.
  yield put(
    data_views_actions.data_view_changed(
      { ...data_view, table_state },
      { view_state_changed: true }
    )
  )
}

export function* handle_generation_error({ payload }) {
  // An admission refusal carries no generation_id and there is nothing stored
  // for it; a run that failed has a stored id that can no longer be collected.
  if (payload.generation_id) yield call(clear_pending_generation)
}

export function* collect_generation({ payload }) {
  if (!payload.generation_id) return
  yield call(send, {
    type: 'DATA_VIEW_GENERATION_COLLECT',
    payload: { generation_id: payload.generation_id }
  })
}

export function* dismiss_generation() {
  yield call(clear_pending_generation)
}

/**
 * Re-collect on reconnect.
 *
 * The server stops POLLING when a socket closes but the run continues, so after
 * a reconnect nothing is watching this client's job and no further frame would
 * ever arrive. Re-sending COLLECT re-attaches the watcher. Read from storage
 * rather than from the store so this covers a reload too, where the store is
 * empty and localStorage is the only thing that remembers.
 */
export function* recollect_pending_generation() {
  const pending = yield call(load_pending_generation)
  if (!pending) return
  yield call(collect_generation, {
    payload: { generation_id: pending.generation_id }
  })
}

export function* watch_submit_generation() {
  yield takeLatest(
    data_view_generation_actions.DATA_VIEW_GENERATION_SUBMIT,
    submit_generation
  )
}

export function* watch_generation_accepted() {
  yield takeLatest(
    data_view_generation_actions.DATA_VIEW_GENERATION_ACCEPTED,
    persist_accepted_generation
  )
}

export function* watch_generation_update() {
  yield takeLatest(
    data_view_generation_actions.DATA_VIEW_GENERATION_UPDATE,
    handle_generation_update
  )
}

export function* watch_generation_error() {
  yield takeLatest(
    data_view_generation_actions.DATA_VIEW_GENERATION_ERROR,
    handle_generation_error
  )
}

export function* watch_resume_generation() {
  yield takeLatest(
    data_view_generation_actions.DATA_VIEW_GENERATION_RESUME,
    collect_generation
  )
}

export function* watch_dismiss_generation() {
  yield takeLatest(
    data_view_generation_actions.DATA_VIEW_GENERATION_DISMISS,
    dismiss_generation
  )
}

export function* watch_websocket_reconnected_for_generation() {
  yield takeLatest(
    wsActions.WEBSOCKET_RECONNECTED,
    recollect_pending_generation
  )
}

export const data_view_generation_sagas = [
  fork(watch_submit_generation),
  fork(watch_generation_accepted),
  fork(watch_generation_update),
  fork(watch_generation_error),
  fork(watch_resume_generation),
  fork(watch_dismiss_generation),
  fork(watch_websocket_reconnected_for_generation)
]
