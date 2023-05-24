import Immutable, { Map } from 'immutable'

import { players_table_views_actions } from './actions'
import { default_players_table_views } from './default-players-table-views'
import { playerActions } from '@core/players/actions'

export function players_table_views_reducer(
  state = new Map(Immutable.fromJS(default_players_table_views)),
  { payload, type }
) {
  switch (type) {
    case players_table_views_actions.GET_PLAYERS_TABLE_VIEWS_FULFILLED:
      return state.withMutations((state) => {
        payload.data.forEach((view) => {
          state.set(view.view_id, new Map(view))
        })
      })

    case players_table_views_actions.PLAYERS_TABLE_VIEW_CHANGED: {
      const { players_table_view } = payload
      return state.set(players_table_view.view_id, new Map(players_table_view))
    }

    case playerActions.POST_PLAYERS_TABLE_VIEW_SEARCH_PENDING: {
      const { view_id } = payload.opts
      return state.setIn([view_id, 'is_fetching'], true)
    }

    case playerActions.POST_PLAYERS_TABLE_VIEW_SEARCH_FAILED:
    case playerActions.POST_PLAYERS_TABLE_VIEW_SEARCH_FULFILLED: {
      const { view_id } = payload.opts
      return state.setIn([view_id, 'is_fetching'], false)
    }

    default:
      return state
  }
}
