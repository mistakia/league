import { Record } from 'immutable'

import { appActions } from './actions'

const initialState = new Record({
  userId: null,
  isPending: true
})

export function appReducer (state = initialState(), { payload, type }) {
  switch (type) {
    default:
      return state
  }
}
