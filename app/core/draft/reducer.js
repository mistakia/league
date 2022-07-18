import { List, Record } from 'immutable'

import { draftActions } from './actions'
import { appActions } from '@core/app'

const initialState = new Record({
  draft_start: null,
  draft_type: null,
  draft_hour_min: null,
  draft_hour_max: null,
  isPending: false,
  selected: null,
  drafted: new List(),
  picks: new List()
})

export function draftReducer(state = initialState(), { payload, type }) {
  switch (type) {
    case draftActions.DRAFT_SELECT_PLAYER:
      return state.merge({ selected: payload.pid })

    case appActions.AUTH_FULFILLED: {
      if (!payload.data.leagues.length) {
        return state
      }

      const league = payload.data.leagues[0]

      return state.merge({
        draft_start: league.draft_start,
        draft_type: league.draft_type,
        draft_hour_min: league.draft_hour_min,
        draft_hour_max: league.draft_hour_max
      })
    }

    case draftActions.LOAD_DRAFT:
      return state.merge({ picks: new List() })

    case draftActions.POST_DRAFT_PENDING:
    case draftActions.GET_DRAFT_PENDING:
      return state.merge({ isPending: true })

    case draftActions.POST_DRAFT_FAILED:
    case draftActions.GET_DRAFT_FAILED:
      return state.merge({ isPending: false })

    case draftActions.GET_DRAFT_FULFILLED: {
      const drafted = payload.data.picks.filter((p) => p.pid).map((p) => p.pid)

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
          [state.picks.findIndex((i) => i.uid === data.uid), 'pid'],
          data.pid
        ),
        drafted: state.drafted.push(data.pid)
      })
    }

    default:
      return state
  }
}
