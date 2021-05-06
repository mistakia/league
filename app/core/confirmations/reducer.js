import { Record } from 'immutable'

import { confirmationActions } from './actions'

const ConfirmationState = new Record({
  id: null,
  title: null,
  data: null,
  description: null,
  component: null,
  onConfirm: null
})

export function confirmationReducer(
  state = new ConfirmationState(),
  { payload, type }
) {
  switch (type) {
    case confirmationActions.SHOW_CONFIRMATION:
      return state.merge(payload)

    case confirmationActions.CANCEL_CONFIRMATION:
      return ConfirmationState()

    default:
      return state
  }
}
