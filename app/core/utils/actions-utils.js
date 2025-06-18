export const create_api_action_types = (base_type) => ({
  [`${base_type}_PENDING`]: `${base_type}_PENDING`,
  [`${base_type}_FULFILLED`]: `${base_type}_FULFILLED`,
  [`${base_type}_FAILED`]: `${base_type}_FAILED`
})

export const create_api_action =
  (type) =>
  (payload = {}) => ({
    type,
    payload
  })

export const create_api_actions = (base_type) => ({
  pending: create_api_action(`${base_type}_PENDING`),
  fulfilled: create_api_action(`${base_type}_FULFILLED`),
  failed: create_api_action(`${base_type}_FAILED`)
})

export const create_toggle_action = (action_type) => () => ({
  type: action_type
})

export const create_select_action = (action_type) => (id) => ({
  type: action_type,
  payload: { id }
})

export const create_set_action = (action_type) => (value) => ({
  type: action_type,
  payload: { value }
})

export const create_load_action = (action_type) => (params = {}) => ({
  type: action_type,
  payload: params
})
