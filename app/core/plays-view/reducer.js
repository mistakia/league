import Immutable, { Map } from 'immutable'

import { plays_views_actions } from './index'
import { default_plays_views } from './default-plays-views'
export function plays_views_reducer(
  state = new Map(
    Immutable.fromJS(default_plays_views).map((view) =>
      view.set('saved_table_state', view.get('table_state'))
    )
  ),
  { payload, type }
) {
  switch (type) {
    case plays_views_actions.GET_PLAYS_VIEWS_FULFILLED:
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

    case plays_views_actions.GET_PLAYS_VIEW_FULFILLED:
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

    case plays_views_actions.POST_PLAYS_VIEW_FULFILLED:
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

    case plays_views_actions.DELETE_PLAYS_VIEW_FULFILLED: {
      const { view_id } = payload.opts
      return state.delete(view_id)
    }

    case plays_views_actions.PLAYS_VIEW_CHANGED: {
      const { data_view } = payload
      return state.mergeIn([data_view.view_id], {
        ...data_view,
        table_state: data_view.table_state
      })
    }

    default:
      return state
  }
}
