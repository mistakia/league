import Immutable, { Map } from 'immutable'

import { plays_views_actions } from './actions'
import { default_plays_views } from './default-plays-views'
import { migrate_plays_view_table_state } from '#libs-shared/data-views-saved-view-migration.mjs'

// The saved_view read path for user_plays_views, the same hole
// app/core/data-views/reducer.js documents: nothing applied the registry's
// column-id renames to a server-persisted plays view, so a renamed id stranded
// there indefinitely. browser-storage.mjs covers only the localStorage
// snapshots. Read-only, for the reasons given in the data-views reducer.
// user_plays_views holds 0 rows today; wiring it now means it is already
// correct on the day it stops being empty.
const migrate_persisted = (table_state) =>
  migrate_plays_view_table_state(table_state).table_state

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
          const table_state = migrate_persisted(view.table_state)
          state.set(
            view.view_id,
            new Map({
              ...view,
              table_state,
              saved_table_state: table_state
            })
          )
        })
      })

    case plays_views_actions.GET_PLAYS_VIEW_FULFILLED:
      return state.withMutations((state) => {
        const table_state = migrate_persisted(payload.data.table_state)
        state.set(
          payload.data.view_id,
          new Map({
            ...payload.data,
            table_state,
            saved_table_state: table_state
          })
        )
      })

    case plays_views_actions.POST_PLAYS_VIEW_FULFILLED:
      return state.withMutations((state) => {
        const table_state = migrate_persisted(payload.data.table_state)
        state.set(
          payload.data.view_id,
          new Map({
            view_id: payload.data.view_id,
            view_name: payload.data.view_name,
            view_description: payload.data.view_description,
            user_id: payload.data.user_id,
            table_state,
            saved_table_state: table_state
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
