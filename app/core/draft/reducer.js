import { List, Record } from 'immutable'

import { draftActions } from './actions'

const initialState = new Record({
  isPending: false,
  selected: null,
  picks: new List()
})

export function draftReducer (state = initialState(), { payload, type }) {
  switch (type) {
    case draftActions.DRAFT_SELECT_PLAYER:
      return state.merge({ selected: payload.player })

    case draftActions.LOAD_DRAFT:
      return state.merge({ picks: new List() })

    case draftActions.GET_DRAFT_PENDING:
      return state.merge({ isPending: true })

    case draftActions.GET_DRAFT_FAILED:
      return state.merge({ isPending: false })

    case draftActions.GET_DRAFT_FULFILLED:
      return state.merge({ isPending: false, picks: new List(payload.data.picks) })

    default:
      return state
  }
}
