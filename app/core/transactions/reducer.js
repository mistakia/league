import { List, Record } from 'immutable'

import { constants } from '@libs-shared'
import { transactions_actions } from './actions'
import { team_actions } from '@core/teams'
import { roster_actions } from '@core/rosters'
import { TRANSACTIONS_PER_LOAD } from '@core/constants'

const initialState = new Record({
  isPending: false,
  hasMore: true,
  release: new List(),
  reserve: new List(),
  items: new List(),
  types: new List(Object.values(constants.transactions)),
  teams: new List()
})

export function transactions_reducer(
  state = initialState(),
  { payload, type }
) {
  switch (type) {
    case transactions_actions.LOAD_TRANSACTIONS:
    case transactions_actions.LOAD_RECENT_TRANSACTIONS:
      return state.merge({ items: new List(), hasMore: true })

    case transactions_actions.GET_RELEASE_TRANSACTIONS_FULFILLED:
      return state.merge({ release: new List(payload.data) })

    case transactions_actions.GET_RESERVE_TRANSACTIONS_FULFILLED:
      return state.merge({ reserve: new List(payload.data) })

    case transactions_actions.GET_TRANSACTIONS_PENDING:
      return state.merge({ isPending: true })

    case transactions_actions.GET_TRANSACTIONS_FAILED:
      return state.merge({ isPending: false })

    case transactions_actions.GET_TRANSACTIONS_FULFILLED: {
      if (!payload.data.length) {
        return state.merge({ hasMore: false, isPending: false })
      }

      return state.merge({
        isPending: false,
        items: state.items.push(...payload.data),
        hasMore: payload.data.length === TRANSACTIONS_PER_LOAD
      })
    }

    case transactions_actions.FILTER_TRANSACTIONS:
      return state.merge({
        hasMore: true,
        items: new List(),
        [payload.type]: new List(payload.values)
      })

    case team_actions.GET_TEAMS_FULFILLED:
      return state.merge({
        teams: new List(payload.data.teams.map((t) => t.uid))
      })

    case team_actions.DELETE_TEAMS_FULFILLED:
      return state.updateIn(['release'], (list) =>
        list.filter((t) => t.tid !== payload.opts.teamId)
      )

    case team_actions.POST_ROSTERS_FULFILLED:
      return state.updateIn(['release'], (list) =>
        list.push(payload.data.transaction)
      )

    case team_actions.DELETE_ROSTERS_FULFILLED:
      return state.updateIn(['release'], (list) =>
        list.filter(
          (t) => t.tid !== payload.opts.teamId && t.pid !== payload.opts.pid
        )
      )

    case roster_actions.ROSTER_TRANSACTIONS:
      return state.updateIn(['release'], (list) =>
        list.push(...payload.data.map((p) => p.transaction))
      )

    default:
      return state
  }
}
