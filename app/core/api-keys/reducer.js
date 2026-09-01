import { List, Map, fromJS } from 'immutable'

import { app_actions } from '@core/app'
import { api_key_actions } from './actions'

const initial_state = new Map({
  keys: new List(),
  // null means "no ceiling" here exactly as it does in the database column.
  data_view_export_max_rows: null,
  is_loaded: false,
  is_pending: false,
  // The plaintext of a key just generated. Present for one render pass through
  // the settings page and never written anywhere else.
  generated_key: null,
  // A refused rename leaves `keys` byte-identical, so nothing downstream can
  // tell it from a rename that was never attempted. This counter is the only
  // thing that moves, and the name field watches it to put the rejected text
  // back to the stored name.
  rename_rejection_count: 0
})

export function api_keys_reducer(state = initial_state, { payload, type }) {
  switch (type) {
    case api_key_actions.GET_API_KEYS_PENDING:
    case api_key_actions.POST_API_KEY_PENDING:
    case api_key_actions.PUT_API_KEY_PENDING:
    case api_key_actions.DELETE_API_KEY_PENDING:
      return state.set('is_pending', true)

    case api_key_actions.PUT_API_KEY_FAILED:
      return state.merge({
        is_pending: false,
        rename_rejection_count: state.get('rename_rejection_count') + 1
      })

    case api_key_actions.GET_API_KEYS_FAILED:
    case api_key_actions.POST_API_KEY_FAILED:
    case api_key_actions.DELETE_API_KEY_FAILED:
      return state.set('is_pending', false)

    case api_key_actions.GET_API_KEYS_FULFILLED:
      return state.merge({
        keys: fromJS(payload.data.api_keys || []),
        data_view_export_max_rows: payload.data.data_view_export_max_rows,
        is_loaded: true,
        is_pending: false
      })

    case api_key_actions.POST_API_KEY_FULFILLED: {
      const { key, ...api_key } = payload.data
      return state.merge({
        keys: state.get('keys').unshift(fromJS(api_key)),
        generated_key: key,
        is_pending: false
      })
    }

    // The response is the whole row, so the rename lands from the server's copy
    // rather than from what was typed — a name the API trimmed or rejected can
    // never sit in the table looking saved.
    case api_key_actions.PUT_API_KEY_FULFILLED:
      return state.merge({
        keys: state
          .get('keys')
          .map((api_key) =>
            api_key.get('api_key_id') === payload.data.api_key_id
              ? fromJS(payload.data)
              : api_key
          ),
        is_pending: false
      })

    case api_key_actions.DELETE_API_KEY_FULFILLED:
      return state.merge({
        keys: state
          .get('keys')
          .map((api_key) =>
            api_key.get('api_key_id') === payload.data.api_key_id
              ? api_key.set('revoked_at', new Date().toISOString())
              : api_key
          ),
        is_pending: false
      })

    case api_key_actions.DISMISS_GENERATED_API_KEY:
      return state.set('generated_key', null)

    case app_actions.LOGOUT:
      return initial_state

    default:
      return state
  }
}
