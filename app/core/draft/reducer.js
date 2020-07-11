import { List, Record } from 'immutable'

import { draftActions } from './actions'

const initialState = new Record({
  isPending: false,
  selected: null,
  drafted: new List(),
  picks: new List()
})

export function draftReducer (state = initialState(), { payload, type }) {
  switch (type) {
    case draftActions.DRAFT_SELECT_PLAYER:
      return state.merge({ selected: payload.player })

    case draftActions.LOAD_DRAFT:
      return state.merge({ picks: new List() })

    case draftActions.POST_DRAFT_PENDING:
    case draftActions.GET_DRAFT_PENDING:
      return state.merge({ isPending: true })

    case draftActions.POST_DRAFT_FAILED:
    case draftActions.GET_DRAFT_FAILED:
      return state.merge({ isPending: false })

    case draftActions.GET_DRAFT_FULFILLED: {
      const drafted = payload.data.picks.filter(p => p.player).map(p => p.player)
      return state.merge({
        isPending: false,
        picks: new List(payload.data.picks),
        drafted: new List(drafted)
      })
    }

    case draftActions.DRAFTED_PLAYER:
    case draftActions.POST_DRAFT_FULFILLED: {
      const { data } = payload
      return state.merge({
        picks: state.picks.setIn(
          [state.picks.findIndex(i => i.uid === data.uid), 'player'], data.player),
        drafted: state.drafted.push(data.player)
      })
    }

    default:
      return state
  }
}
