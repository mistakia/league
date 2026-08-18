import { List, Record, Map } from 'immutable'

import { draft_actions } from './actions'

const initialState = new Record({
  isPending: false,
  selected: null,
  drafted: new List(),
  picks: new List(),
  expanded_pick_id: null,
  pick_details: new Map() // stores individual pick data by pick_id
})

export function draft_reducer(state = initialState(), { payload, type }) {
  switch (type) {
    case draft_actions.DRAFT_SELECT_PLAYER:
      return state.merge({ selected: payload.pid })

    case draft_actions.LOAD_DRAFT:
      return state.merge({ picks: new List() })

    case draft_actions.POST_DRAFT_PENDING:
    case draft_actions.GET_DRAFT_PENDING:
      return state.merge({ isPending: true })

    case draft_actions.POST_DRAFT_FAILED:
    case draft_actions.GET_DRAFT_FAILED:
      return state.merge({ isPending: false })

    case draft_actions.GET_DRAFT_FULFILLED: {
      const drafted = payload.data.picks.filter((p) => p.pid).map((p) => p.pid)

      return state.merge({
        isPending: false,
        picks: new List(payload.data.picks),
        drafted: new List(drafted)
      })
    }

    case draft_actions.DRAFTED_PLAYER:
    case draft_actions.POST_DRAFT_FULFILLED: {
      const { data } = payload
      // Immutable resolves a negative index to the LAST element, so an
      // unrecognised pick would write the drafted player onto whichever pick
      // happens to be last rather than being ignored.
      const index = state.picks.findIndex(
        (i) => i.draft_pick_id === data.draft_pick_id
      )
      return state.merge({
        picks:
          index === -1
            ? state.picks
            : state.picks.setIn([index, 'pid'], data.pid),
        drafted: state.drafted.push(data.pid)
      })
    }

    case draft_actions.SET_EXPANDED_PICK_ID:
      return state.merge({ expanded_pick_id: payload.pick_id })

    case draft_actions.GET_DRAFT_PICK_DETAILS_FULFILLED: {
      const { pickId } = payload.opts
      const { trade_history, historical_picks } = payload.data

      return state.setIn(
        ['pick_details', pickId],
        new Map({
          trade_history: new List(
            trade_history?.map((trade) => new Map(trade)) || []
          ),
          historical_picks: new List(
            historical_picks?.map((pick) => new Map(pick)) || []
          ),
          loaded: true
        })
      )
    }

    default:
      return state
  }
}
