import { actions_utils } from '@core/utils'
const { create_api_actions, create_api_action_types } = actions_utils

export const api_key_actions = {
  ...create_api_action_types('GET_API_KEYS'),
  ...create_api_action_types('POST_API_KEY'),
  ...create_api_action_types('PUT_API_KEY'),
  ...create_api_action_types('DELETE_API_KEY'),

  LOAD_API_KEYS: 'LOAD_API_KEYS',
  load: () => ({
    type: api_key_actions.LOAD_API_KEYS
  }),

  CREATE_API_KEY: 'CREATE_API_KEY',
  create: ({ name }) => ({
    type: api_key_actions.CREATE_API_KEY,
    payload: { name }
  }),

  // The name is a label the user keeps for their own benefit; it carries no
  // authorization meaning, so renaming is an ordinary edit rather than a
  // re-issue of the key.
  RENAME_API_KEY: 'RENAME_API_KEY',
  rename: ({ api_key_id, name }) => ({
    type: api_key_actions.RENAME_API_KEY,
    payload: { api_key_id, name }
  }),

  REVOKE_API_KEY: 'REVOKE_API_KEY',
  revoke: ({ api_key_id }) => ({
    type: api_key_actions.REVOKE_API_KEY,
    payload: { api_key_id }
  }),

  // The plaintext key is held in store state only until the user dismisses it.
  // It is shown once and cannot be retrieved again, so nothing persists it.
  DISMISS_GENERATED_API_KEY: 'DISMISS_GENERATED_API_KEY',
  dismiss_generated_key: () => ({
    type: api_key_actions.DISMISS_GENERATED_API_KEY
  })
}

export const get_api_keys_actions = create_api_actions('GET_API_KEYS')
export const post_api_key_actions = create_api_actions('POST_API_KEY')
export const put_api_key_actions = create_api_actions('PUT_API_KEY')
export const delete_api_key_actions = create_api_actions('DELETE_API_KEY')
