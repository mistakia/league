import { fromJS, List } from 'immutable'
import { data_views_actions } from '../data-views/actions'
import { data_view_request_actions } from './actions'

const initial_state = fromJS({
  current_request: null,
  position: null,
  status: null,
  result: List(),
  metadata: null,
  error: null
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
        status: 'pending',
        result: payload.append_results ? state.get('result') : List(),
        metadata: payload.append_results ? state.get('metadata') : null
      })

    case data_views_actions.SET_SELECTED_DATA_VIEW: {
      if (payload.view_change_params.view_state_changed) {
        return state.merge({
          current_request: payload.data_view_id,
          position: null,
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

    case data_view_request_actions.DATA_VIEW_POSITION:
      return state.set('position', payload.position)

    case data_view_request_actions.DATA_VIEW_STATUS:
      return state.set('status', payload.status)

    case data_view_request_actions.DATA_VIEW_RESULT: {
      const current_request = state.get('current_request')
      const is_append =
        payload.append_results ||
        (payload.request_id === current_request &&
          state.get('result') &&
          state.get('result').size > 0)

      const current_metadata = state.get('metadata')
      console.log('current_metadata', current_metadata)
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
        error: payload.error
      })

    default:
      return state
  }
}
