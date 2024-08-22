import { List } from 'immutable'

import { playerActions } from '@core/players/actions'
import { data_views_actions } from '@core/data-views/actions'

export function data_view_items_reducer(state = new List(), { payload, type }) {
  switch (type) {
    case data_views_actions.SET_SELECTED_DATA_VIEW:
    case data_views_actions.DATA_VIEW_CHANGED: {
      if (payload.view_change_params.view_state_changed) {
        return new List()
      }

      return state
    }

    case playerActions.POST_DATA_VIEW_SEARCH_FULFILLED:
      return new List(payload.data)
    default:
      return state
  }
}
