import { Record } from 'immutable'

import { confirmation_actions } from './actions'

const ConfirmationState = new Record({
  id: null,
  title: null,
  data: null,
  description: null,
  component: null,
  on_confirm_func: null
})

export function confirmation_reducer(
  state = new ConfirmationState(),
  { payload, type }
) {
  switch (type) {
    case confirmation_actions.SHOW_CONFIRMATION:
      return state.merge(payload)

    case confirmation_actions.CANCEL_CONFIRMATION:
      return ConfirmationState()

    default:
      return state
  }
}
