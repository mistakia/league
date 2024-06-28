import { List } from 'immutable'

import { playerActions } from '@core/players/actions'

export function players_table_reducer(state = new List(), { payload, type }) {
  switch (type) {
    case playerActions.POST_PLAYERS_TABLE_VIEW_SEARCH_FULFILLED:
      return new List(payload.data)
    default:
      return state
  }
}
