import { Record } from 'immutable'

import { notification_actions } from './actions'

const NotificationState = new Record({
  message: null,
  severity: null,
  key: null
})

export function notification_reducer(
  state = new NotificationState(),
  { payload, type }
) {
  switch (type) {
    case notification_actions.SHOW_NOTIFICATION:
      return state.merge({ key: new Date().getTime(), ...payload })

    default:
      return state
  }
}
