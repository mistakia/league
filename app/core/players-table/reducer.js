import { List } from 'immutable'

import { playerActions } from '@core/players/actions'
import { players_table_views_actions } from '@core/players-table-views/actions'

export function players_table_reducer(state = new List(), { payload, type }) {
  switch (type) {
    case players_table_views_actions.PLAYERS_TABLE_VIEW_CHANGED:
      return new List()

    case playerActions.POST_PLAYERS_TABLE_VIEW_SEARCH_FULFILLED:
      return new List(payload.data)
    default:
      return state
  }
}
