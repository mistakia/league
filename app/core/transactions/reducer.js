import { List, Record } from 'immutable'

import { constants } from '@common'
import { transactionsActions } from './actions'
import { teamActions } from '@core/teams'
import { TRANSACTIONS_PER_LOAD } from '@core/constants'

const initialState = new Record({
  isPending: false,
  hasMore: true,
  items: new List(),
  types: new List(Object.values(constants.transactions)),
  teams: new List()
})

export function transactionsReducer (state = initialState(), { payload, type }) {
  switch (type) {
    case transactionsActions.LOAD_TRANSACTIONS:
      return state.merge({ items: new List(), hasMore: true })

    case transactionsActions.GET_TRANSACTIONS_PENDING:
      return state.merge({ isPending: true })

    case transactionsActions.GET_TRANSACTIONS_FAILED:
      return state.merge({ isPending: false })

    case transactionsActions.GET_TRANSACTIONS_FULFILLED: {
      if (!payload.data.length) {
        return state.merge({ hasMore: false, isPending: false })
      }

      return state.merge({
        isPending: false,
        items: state.items.push(...payload.data),
        hasMore: payload.data.length === TRANSACTIONS_PER_LOAD
      })
    }

    case transactionsActions.FILTER_TRANSACTIONS:
      return state.merge({
        hasMore: true,
        items: new List(),
        [payload.type]: new List(payload.values)
      })

    case teamActions.GET_TEAMS_FULFILLED:
      return state.merge({
        teams: new List(payload.data.teams.map(t => t.uid))
      })

    default:
      return state
  }
}
