import Immutable, { Map, Set as ImmutableSet, List } from 'immutable'

import { app_actions } from '@core/app/actions'
import { data_views_actions } from './index'
import { default_data_views } from './default-data-views'
import { data_view_request_actions } from '@core/data-view-request/actions'
import { is_valid_table_state } from '#libs-shared/data-view-storage/validate.mjs'

// table_state is stored as a plain JS object (consistent with the other
// reducer cases that build views via `new Map({ ...view, table_state })`) so
// downstream consumers can use plain `.columns` / `.map` access.

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

    case app_actions.AUTH_FULFILLED: {
      const leagueId = payload.data.leagues.length
        ? payload.data.leagues[0].uid
        : undefined
      if (!leagueId) return state

      const is_player_grain = (table_state) => {
        const row_grain = table_state?.get
          ? table_state.get('row_grain')
          : table_state?.row_grain
        const grain =
          row_grain && row_grain.get ? row_grain.get(0) : row_grain?.[0]
        return !grain || grain === 'player'
      }

      const add_roster_status = (columns) =>
        columns && columns.includes('player_league_roster_status')
          ? columns
          : (columns || List()).push('player_league_roster_status')

      return state.withMutations((state) => {
        state.forEach((view, key) => {
          let updated_view = view
          if (is_player_grain(view.get('table_state'))) {
            updated_view = updated_view.updateIn(
              ['table_state', 'prefix_columns'],
              add_roster_status
            )
          }
          if (is_player_grain(view.get('saved_table_state'))) {
            updated_view = updated_view.updateIn(
              ['saved_table_state', 'prefix_columns'],
              add_roster_status
            )
          }
          if (updated_view !== view) state.set(key, updated_view)
        })
      })
    }

    case data_views_actions.RESTORE_DATA_VIEW_TABLE_STATE: {
      const { view_id, table_state } = payload
      if (!is_valid_table_state(table_state)) return state
      return state.mergeIn([view_id], { view_id, table_state })
    }

    case data_views_actions.REVERT_DATA_VIEW: {
      const { view_id } = payload
      const view = state.get(view_id)
      if (!view) return state
      const saved = view.get('saved_table_state')
      if (saved == null) return state
      return state.setIn([view_id, 'table_state'], saved)
    }

    case data_views_actions.DATA_VIEW_CHANGED: {
      const { data_view } = payload
      // Drop invalid table_state so corrupted payloads (react-table destructure
      // with undefined fields, stale browser snapshots, etc.) cannot wipe an
      // existing view's columns/prefix_columns.
      const { table_state, ...rest } = data_view
      const merge_payload = is_valid_table_state(table_state)
        ? { ...rest, table_state }
        : rest
      return state.mergeIn([data_view.view_id], merge_payload)
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

// ======================================
// View organization reducer (B10)
// State shape:
//   favorite_view_ids: Immutable.Set<string>
//   tags_by_view_id:   Immutable.Map<view_id, Immutable.List<{name, source}>>
// ======================================

const organization_initial_state = new Map({
  favorite_view_ids: ImmutableSet(),
  tags_by_view_id: new Map()
})

export function data_view_organization_reducer(
  state = organization_initial_state,
  { payload, type }
) {
  switch (type) {
    // Hydrate from GET organization response
    case data_views_actions.GET_DATA_VIEW_ORGANIZATION_FULFILLED: {
      const { favorites = [], tags_by_view_id = {} } = payload.data
      const new_favorites = ImmutableSet(favorites)
      const new_tags = new Map(
        Object.entries(tags_by_view_id).map(([view_id, tags]) => [
          view_id,
          List(tags.map((t) => ({ name: t.name, source: t.source })))
        ])
      )
      return state
        .set('favorite_view_ids', new_favorites)
        .set('tags_by_view_id', new_tags)
    }

    case data_views_actions.GET_DATA_VIEW_ORGANIZATION_FAILED:
      // Keep existing state on failure
      return state

    // Optimistic favorite insert
    case data_views_actions.POST_DATA_VIEW_FAVORITE_PENDING: {
      const { view_id } = payload.opts
      return state.update('favorite_view_ids', (s) => s.add(view_id))
    }

    // Rollback optimistic favorite insert on failure
    case data_views_actions.POST_DATA_VIEW_FAVORITE_FAILED: {
      const { view_id } = payload.opts
      return state.update('favorite_view_ids', (s) => s.delete(view_id))
    }

    case data_views_actions.POST_DATA_VIEW_FAVORITE_FULFILLED:
      // Already applied optimistically; no-op
      return state

    // Optimistic favorite delete
    case data_views_actions.DELETE_DATA_VIEW_FAVORITE_PENDING: {
      const { view_id } = payload.opts
      return state.update('favorite_view_ids', (s) => s.delete(view_id))
    }

    // Rollback optimistic favorite delete on failure
    case data_views_actions.DELETE_DATA_VIEW_FAVORITE_FAILED: {
      const { view_id } = payload.opts
      return state.update('favorite_view_ids', (s) => s.add(view_id))
    }

    case data_views_actions.DELETE_DATA_VIEW_FAVORITE_FULFILLED:
      // Already applied optimistically; no-op
      return state

    // Optimistic tag add
    case data_views_actions.POST_DATA_VIEW_TAG_PENDING: {
      const { view_id, tag_name } = payload.opts
      if (!view_id || !tag_name) return state
      return state.updateIn(['tags_by_view_id', view_id], (tags) => {
        const current = tags || List()
        // Remove existing entry for this tag_name (in case it's an llm row being promoted)
        const filtered = current.filter((t) => t.name !== tag_name)
        return filtered.push({ name: tag_name, source: 'user' })
      })
    }

    // Rollback optimistic tag add on failure (remove the tag we added)
    case data_views_actions.POST_DATA_VIEW_TAG_FAILED: {
      const { view_id, tag_name, prior_source } = payload.opts
      if (!view_id || !tag_name) return state
      if (prior_source) {
        // Restore the prior llm row that was overwritten optimistically
        return state.updateIn(['tags_by_view_id', view_id], (tags) => {
          const current = tags || List()
          const filtered = current.filter((t) => t.name !== tag_name)
          return filtered.push({ name: tag_name, source: prior_source })
        })
      }
      // No prior row — remove the optimistically added tag
      return state.updateIn(['tags_by_view_id', view_id], (tags) => {
        if (!tags) return tags
        return tags.filter((t) => t.name !== tag_name)
      })
    }

    case data_views_actions.POST_DATA_VIEW_TAG_FULFILLED: {
      // Normalize with server-confirmed tag_name (lowercased)
      const { view_id } = payload.opts
      const confirmed_tag_name = payload.data?.tag_name
      if (!view_id || !confirmed_tag_name) return state
      const pending_tag_name = payload.opts.tag_name
      if (confirmed_tag_name === pending_tag_name) return state
      // Rename pending tag to confirmed (sanitized) name
      return state.updateIn(['tags_by_view_id', view_id], (tags) => {
        if (!tags) return tags
        return tags
          .filter((t) => t.name !== pending_tag_name)
          .push({ name: confirmed_tag_name, source: 'user' })
      })
    }

    // Optimistic tag delete
    case data_views_actions.DELETE_DATA_VIEW_TAG_PENDING: {
      const { view_id, tag_name } = payload.opts
      if (!view_id || !tag_name) return state
      return state.updateIn(['tags_by_view_id', view_id], (tags) => {
        if (!tags) return tags
        return tags.filter((t) => !(t.name === tag_name && t.source === 'user'))
      })
    }

    // Rollback optimistic tag delete on failure
    case data_views_actions.DELETE_DATA_VIEW_TAG_FAILED: {
      const { view_id, tag_name } = payload.opts
      if (!view_id || !tag_name) return state
      return state.updateIn(['tags_by_view_id', view_id], (tags) => {
        const current = tags || List()
        // Only add back if not already present
        if (current.some((t) => t.name === tag_name)) return current
        return current.push({ name: tag_name, source: 'user' })
      })
    }

    case data_views_actions.DELETE_DATA_VIEW_TAG_FULFILLED:
      // Already applied optimistically; no-op
      return state

    default:
      return state
  }
}
