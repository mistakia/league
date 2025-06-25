import Immutable, { Map } from 'immutable'

import { appActions } from '@core/app/actions'
import { data_views_actions } from './index'
import { default_data_views } from './default-data-views'
import { data_view_request_actions } from '@core/data-view-request/actions'

export function data_views_reducer(
  state = new Map(
    Immutable.fromJS(default_data_views).map((view) =>
      view.set('saved_table_state', view.get('table_state'))
    )
  ),
  { payload, type }
) {
  switch (type) {
    case data_views_actions.GET_DATA_VIEWS_FULFILLED:
      return state.withMutations((state) => {
        payload.data.forEach((view) => {
          state.set(
            view.view_id,
            new Map({
              ...view,
              table_state: view.table_state,
              saved_table_state: view.table_state
            })
          )
        })
      })

    case data_views_actions.GET_DATA_VIEW_FULFILLED:
      return state.withMutations((state) => {
        state.set(
          payload.data.view_id,
          new Map({
            ...payload.data,
            table_state: payload.data.table_state,
            saved_table_state: payload.data.table_state
          })
        )
      })

    case data_views_actions.POST_DATA_VIEW_FULFILLED:
      return state.withMutations((state) => {
        state.set(
          payload.data.view_id,
          new Map({
            view_id: payload.data.view_id,
            view_name: payload.data.view_name,
            view_description: payload.data.view_description,
            user_id: payload.data.user_id,
            table_state: payload.data.table_state,
            saved_table_state: payload.data.table_state
          })
        )
        if (
          payload.opts.client_generated_view_id &&
          payload.opts.client_generated_view_id !== payload.data.view_id
        ) {
          state.delete(payload.opts.client_generated_view_id)
        }
      })

    case data_views_actions.DELETE_DATA_VIEW_FULFILLED: {
      const { view_id } = payload.opts
      return state.delete(view_id)
    }

    case appActions.AUTH_FULFILLED: {
      const leagueId = payload.data.leagues.length
        ? payload.data.leagues[0].uid
        : undefined
      if (leagueId) {
        return state.withMutations((state) => {
          state.forEach((view, key) => {
            const updated_view = view
              .updateIn(['table_state', 'prefix_columns'], (columns) =>
                columns.push('player_league_roster_status')
              )
              .updateIn(['saved_table_state', 'prefix_columns'], (columns) =>
                columns.push('player_league_roster_status')
              )
            state.set(key, updated_view)
          })
        })
      }
      return state
    }

    case data_views_actions.DATA_VIEW_CHANGED: {
      const { data_view } = payload
      return state.mergeIn([data_view.view_id], {
        ...data_view,
        table_state: data_view.table_state
      })
    }

    case data_view_request_actions.DATA_VIEW_REQUEST:
      return state.setIn([payload.view_id, 'is_fetching'], true)

    case data_view_request_actions.DATA_VIEW_RESULT:
    case data_view_request_actions.DATA_VIEW_ERROR:
      return state.setIn([payload.request_id, 'is_fetching'], false)

    default:
      return state
  }
}
