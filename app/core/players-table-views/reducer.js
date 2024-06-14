import Immutable, { Map } from 'immutable'

import { appActions } from '@core/app/actions'
import { players_table_views_actions } from './actions'
import { default_players_table_views } from './default-players-table-views'
import { playerActions } from '@core/players/actions'

export function players_table_views_reducer(
  state = new Map(
    Immutable.fromJS(default_players_table_views).map((view) =>
      view.set('saved_table_state', view.get('table_state'))
    )
  ),
  { payload, type }
) {
  switch (type) {
    case players_table_views_actions.GET_PLAYERS_TABLE_VIEWS_FULFILLED:
      return state.withMutations((state) => {
        payload.data.forEach((view) => {
          state.set(
            view.view_id,
            new Map({
              ...view,
              table_state: view.table_state,
              saved_table_state: view.saved_table_state
            })
          )
        })
      })

    case appActions.AUTH_FULFILLED: {
      return state.withMutations((state) => {
        state.forEach((view, key) => {
          const updated_view = view
            .update('view_filters', (filters) =>
              filters.push('player_league_roster_status')
            )
            .updateIn(['table_state', 'prefix_columns'], (columns) =>
              columns.push('player_league_roster_status')
            )
          state.set(key, updated_view)
        })
      })
    }

    case players_table_views_actions.PLAYERS_TABLE_VIEW_CHANGED: {
      const { players_table_view } = payload
      return state.mergeIn([players_table_view.view_id], {
        ...players_table_view,
        table_state: players_table_view.table_state
      })
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
