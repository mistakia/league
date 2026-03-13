import { fromJS, List } from 'immutable'
import { plays_view_request_actions } from '../plays-view-request/actions'

const initial_state = fromJS({
  current_request: null,
  position: null,
  status: null,
  result: List(),
  metadata: null,
  error: null
})

export function selected_player_plays_request_reducer(
  state = initial_state,
  { payload, type }
) {
  switch (type) {
    case plays_view_request_actions.PLAYS_VIEW_POSITION:
      if (payload.source !== 'selected_player') {
        return state
      }
      return state.set('position', payload.position)

    case plays_view_request_actions.PLAYS_VIEW_STATUS:
      if (payload.source !== 'selected_player') {
        return state
      }
      return state.set('status', payload.status)

    case plays_view_request_actions.PLAYS_VIEW_RESULT: {
      if (payload.source !== 'selected_player') {
        return state
      }

      const is_append = payload.append_results

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
      if (payload.source !== 'selected_player') {
        return state
      }
      return state.merge({
        status: 'error',
        error: payload.error
      })

    case plays_view_request_actions.PLAYS_VIEW_REQUEST:
      if (payload.source !== 'selected_player') {
        return state
      }
      return state.merge({
        current_request: payload.request_id,
        position: null,
        status: 'pending',
        result: payload.append_results ? state.get('result') : List(),
        metadata: payload.append_results ? state.get('metadata') : null
      })

    default:
      return state
  }
}
