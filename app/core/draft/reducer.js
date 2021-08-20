import { List, Record } from 'immutable'

import { getDraftWindow } from '@common'
import { draftActions } from './actions'
import { appActions } from '@core/app'

const initialState = new Record({
  ddate: null,
  isPending: false,
  selected: null,
  drafted: new List(),
  picks: new List()
})

export function draftReducer(state = initialState(), { payload, type }) {
  switch (type) {
    case draftActions.DRAFT_SELECT_PLAYER:
      return state.merge({ selected: payload.player })

    case appActions.AUTH_FULFILLED:
      return state.merge({
        ddate: payload.data.leagues.length
          ? payload.data.leagues[0].ddate
          : undefined
      })

    case draftActions.LOAD_DRAFT:
      return state.merge({ picks: new List() })

    case draftActions.POST_DRAFT_PENDING:
    case draftActions.GET_DRAFT_PENDING:
      return state.merge({ isPending: true })

    case draftActions.POST_DRAFT_FAILED:
    case draftActions.GET_DRAFT_FAILED:
      return state.merge({ isPending: false })

    case draftActions.GET_DRAFT_FULFILLED: {
      const drafted = payload.data.picks
        .filter((p) => p.player)
        .map((p) => p.player)

      for (const pick of payload.data.picks) {
        pick.draftWindow = getDraftWindow({
          start: state.ddate,
          pickNum: pick.pick
        })
      }

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
          [state.picks.findIndex((i) => i.uid === data.uid), 'player'],
          data.player
        ),
        drafted: state.drafted.push(data.player)
      })
    }

    default:
      return state
  }
}
