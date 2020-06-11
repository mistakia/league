import { List, Record } from 'immutable'

import { draftActions } from './actions'

const initialState = new Record({
  isPending: false,
  picks: new List()
})

export function draftReducer (state = initialState(), { payload, type }) {
  switch (type) {
    case draftActions.LOAD_DRAFT:
      return state.merge({ picks: new List() })

    case draftActions.GET_DRAFT_PENDING:
      return state.merge({ isPending: true })

    case draftActions.GET_DRAFT_FAILED:
      return state.merge({ isPending: false })

    case draftActions.GET_DRAFT_FULFILLED:
      return state.merge({ picks: new List(payload.data.picks) })

    default:
      return state
  }
}
