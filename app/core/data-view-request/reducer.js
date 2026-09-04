import { fromJS, List, Map } from 'immutable'
// The actions module directly rather than the domain index: the index also
// re-exports the sagas, which reach @core/store and therefore `window`, and that
// puts this reducer out of reach of a spec for no benefit. Only the action types
// are wanted here.
import { data_views_actions } from '#app/core/data-views/actions.js'
import { data_view_request_actions } from './actions'

const initial_state = fromJS({
  current_request: null,
  position: null,
  execution_id: null,
  status: null,
  result: List(),
  metadata: null,
  error: null,
  client_timeout: false,
  param_option_counts: Map(),
  param_option_counts_signatures: Map()
})

export function data_view_request_reducer(
  state = initial_state,
  { payload, type }
) {
  switch (type) {
    case data_view_request_actions.DATA_VIEW_REQUEST:
      return state.merge({
        current_request: payload.view_id,
        position: null,
        execution_id: null,
        status: 'pending',
        result: payload.append_results ? state.get('result') : List(),
        metadata: payload.append_results ? state.get('metadata') : null
      })

    case data_views_actions.SET_SELECTED_DATA_VIEW: {
      if (payload.view_change_params.view_state_changed) {
        return state.merge({
          current_request: payload.data_view_id,
          position: null,
          execution_id: null,
          status: 'pending',
          result: payload.view_change_params.append_results
            ? state.get('result')
            : List(),
          metadata: payload.view_change_params.append_results
            ? state.get('metadata')
            : null
        })
      }

      return state
    }

    case data_views_actions.DATA_VIEW_CHANGED: {
      if (payload.view_change_params.view_state_changed) {
        return state.merge({
          current_request: payload.data_view.view_id,
          position: null,
          execution_id: null,
          status: 'pending',
          result: payload.view_change_params.append_results
            ? state.get('result')
            : List(),
          metadata: payload.view_change_params.append_results
            ? state.get('metadata')
            : null
        })
      }

      return state
    }

    // A view change optimistically enters `pending` above, because the reducer
    // runs before the saga and cannot see whether the request will actually be
    // sent. When the saga declines to send one -- a view with no columns has
    // nothing to ask for -- nothing else would ever move the slice off
    // `pending`, so the page sat under a progress bar and a "Request queued..."
    // banner forever. That is the state a brand-new view starts in, so the
    // first thing a user saw after creating one was a load that never ended.
    case data_view_request_actions.DATA_VIEW_REQUEST_SKIPPED:
      return state.merge({
        current_request: null,
        position: null,
        execution_id: null,
        status: null,
        result: List(),
        metadata: null,
        error: null,
        is_invalid_request: false,
        client_timeout: false
      })

    case data_view_request_actions.DATA_VIEW_POSITION:
      return state.set('position', payload.position)

    case data_view_request_actions.DATA_VIEW_HEARTBEAT: {
      // The heartbeat carries the authoritative phase, and it is what the UI
      // renders "waiting" from once DATA_VIEW_POSITION retires server-side --
      // that message carried no ordering guarantee under concurrent admission,
      // and the heartbeat carries no number to replace it with.
      //
      // Guarded against a terminal status so a heartbeat racing the result
      // cannot put a completed table back under a spinner.
      const status = state.get('status')
      if (status === 'completed' || status === 'error') return state

      return state.merge({
        execution_id: payload.execution_id,
        status: payload.state === 'executing' ? 'processing' : 'pending'
      })
    }

    case data_view_request_actions.DATA_VIEW_STATUS:
      return state.set('status', payload.status)

    case data_view_request_actions.DATA_VIEW_RESULT: {
      // Append only when the request asked to append. request_id is the
      // VIEW id, not a per-request identity, so an "already have rows for
      // this view" heuristic cannot tell a second concurrent load of the
      // same view from a pagination page -- it concatenated the two, and a
      // direct link to any saved view rendered every row twice.
      const is_append = Boolean(payload.append_results)

      const current_metadata = state.get('metadata')
      const new_metadata = payload.metadata || {}
      // When appending results, keep existing total_count if new response doesn't have one
      // This handles pagination requests which don't calculate total_count
      const merged_metadata =
        is_append && current_metadata
          ? {
              ...new_metadata,
              total_count:
                new_metadata.total_count || current_metadata.total_count
            }
          : new_metadata

      return state.merge({
        status: 'completed',
        result: is_append
          ? state.get('result').concat(List(payload.result))
          : List(payload.result),
        metadata: merged_metadata
      })
    }

    case data_view_request_actions.DATA_VIEW_ERROR:
      return state.merge({
        status: 'error',
        error: payload.error,
        // Whether `error` may be SHOWN. The server classifies it; the client
        // must not try to re-derive it from the message text, which is exactly
        // the judgement it cannot make. Absent on the client watchdog path,
        // which has no server message at all.
        is_invalid_request: Boolean(payload.is_invalid_request),
        // Distinguishes a server-reported failure from the client watchdog
        // giving up on a server that never answered. The two need different
        // wording -- only one of them is something the server knows about.
        client_timeout: Boolean(payload.client_timeout)
      })

    case data_view_request_actions.DATA_VIEW_PARAM_OPTION_COUNTS_FULFILLED:
      return state.setIn(
        ['param_option_counts', payload.target_param_name],
        fromJS(payload.counts || {})
      )

    case data_view_request_actions.DATA_VIEW_PARAM_OPTION_COUNTS_SIGNATURE_SET:
      return state.setIn(
        ['param_option_counts_signatures', payload.view_id],
        payload.signature
      )

    case data_views_actions.DELETE_DATA_VIEW_FULFILLED: {
      const view_id = payload?.opts?.view_id
      if (!view_id) return state
      return state.deleteIn(['param_option_counts_signatures', view_id])
    }

    default:
      return state
  }
}
