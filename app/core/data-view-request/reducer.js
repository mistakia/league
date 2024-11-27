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
        result: List(),
        metadata: null
      })

    case data_views_actions.SET_SELECTED_DATA_VIEW: {
      if (payload.view_change_params.view_state_changed) {
        return state.merge({
          current_request: payload.data_view_id,
          position: null,
          status: 'pending',
          result: List(),
          metadata: null
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
          result: List(),
          metadata: null
        })
      }

      return state
    }

    case data_view_request_actions.DATA_VIEW_POSITION:
      return state.set('position', payload.position)

    case data_view_request_actions.DATA_VIEW_STATUS:
      return state.set('status', payload.status)

    case data_view_request_actions.DATA_VIEW_RESULT:
      return state.merge({
        status: 'completed',
        result: List(payload.result),
        metadata: payload.metadata
      })

    case data_view_request_actions.DATA_VIEW_ERROR:
      return state.merge({
        status: 'error',
        error: payload.error
      })

    default:
      return state
  }
}
