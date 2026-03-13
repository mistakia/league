import { fromJS, List } from 'immutable'
import { plays_views_actions } from '../plays-view'
import { plays_view_request_actions } from './actions'

const initial_state = fromJS({
  current_request: null,
  position: null,
  status: null,
  result: List(),
  metadata: null,
  error: null
})

export function plays_view_request_reducer(
  state = initial_state,
  { payload, type }
) {
  switch (type) {
    case plays_view_request_actions.PLAYS_VIEW_REQUEST:
      return state.merge({
        current_request: payload.view_id,
        position: null,
        status: 'pending',
        result: payload.append_results ? state.get('result') : List(),
        metadata: payload.append_results ? state.get('metadata') : null
      })

    case plays_views_actions.SET_SELECTED_PLAYS_VIEW: {
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

    case plays_views_actions.PLAYS_VIEW_CHANGED: {
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

    case plays_view_request_actions.PLAYS_VIEW_POSITION:
      if (payload.source && payload.source !== 'plays_page') {
        return state
      }
      return state.set('position', payload.position)

    case plays_view_request_actions.PLAYS_VIEW_STATUS:
      if (payload.source && payload.source !== 'plays_page') {
        return state
      }
      return state.set('status', payload.status)

    case plays_view_request_actions.PLAYS_VIEW_RESULT: {
      if (payload.source && payload.source !== 'plays_page') {
        return state
      }

      const current_request = state.get('current_request')
      const is_append =
        payload.append_results ||
        (payload.request_id === current_request &&
          state.get('result') &&
          state.get('result').size > 0)

      const current_metadata = state.get('metadata')
      const new_metadata = payload.metadata || {}
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

    case plays_view_request_actions.PLAYS_VIEW_ERROR:
      if (payload.source && payload.source !== 'plays_page') {
        return state
      }
      return state.merge({
        status: 'error',
        error: payload.error
      })

    default:
      return state
  }
}
