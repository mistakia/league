/* global describe it */

import * as chai from 'chai'

import { RENAME_REGISTRY } from '#libs-shared/data-views-saved-view-migration.mjs'
import { data_views_actions } from '#app/core/data-views/actions.js'
import { data_views_reducer } from '#app/core/data-views/reducer.js'
import { plays_views_actions } from '#app/core/plays-view/actions.js'
import { plays_views_reducer } from '#app/core/plays-view/reducer.js'

const expect = chai.expect

// Reachability oracle for the saved_view surface's COLUMN_ID rules.
//
// WHY THIS EXISTS, and why it lives here rather than beside the migration's own
// spec: a spec that calls the migration cannot see whether anything CALLS the
// migration. `test/data-views-saved-view-migration.spec.mjs` and the per-rename
// specs all assert through `migrate_table_state`, so they stayed green for
// eleven days while the saved_view surface applied no column-id rule at all and
// a production row dropped its column on render. The mechanism and the incident
// are documented at app/core/data-views/reducer.js.
//
// So every assertion here drives a REDUCER -- the point where a persisted
// table_state enters the store -- and the rule population is derived from
// RENAME_REGISTRY, so a COLUMN_ID rule added tomorrow is covered the day it
// lands. That is exactly the failure mode the incident was.

const saved_view_column_id_records = RENAME_REGISTRY.filter(
  (entry) =>
    entry.level === 'column_id' && entry.surfaces.includes('saved_view')
).flatMap((entry) => Object.entries(entry.records))

// One rule, for the cases whose job is to prove they route through the
// migration at all rather than to re-walk the whole registry.
const [SAMPLE_LEGACY_ID, SAMPLE_CURRENT_ID] = saved_view_column_id_records[0]

// An id no rule names. The negative control on every read path: the reducer has
// to leave it alone, which is what makes a passing assertion evidence of a
// RENAME rather than of blanket rewriting.
const UNKNOWN_ID = 'player_no_such_column_id_exists_for_this_control'

// A saved view can persist a column as a bare string or as an object, and the
// migration returns the shape it was given.
const read_column_id = (entry) =>
  typeof entry === 'string' ? entry : entry?.column_id

const view_of = (state, view_id) => state.get(view_id).get('table_state')

const saved_view_payload = ({ view_id = 'coverage', column_id }) => ({
  view_id,
  view_name: 'coverage',
  view_description: null,
  user_id: 1,
  table_state: {
    columns: [{ column_id, params: {} }],
    prefix_columns: [],
    where: [],
    sort: [{ column_id, desc: true }]
  }
})

const hydrate = ({ reducer, type, column_id, single }) =>
  reducer(undefined, {
    type,
    payload: {
      data: single
        ? saved_view_payload({ column_id })
        : [saved_view_payload({ column_id })],
      opts: {}
    }
  })

describe('data-views saved_view column_id read coverage', function () {
  it('declares at least one saved_view column_id rule to check', function () {
    // A registry refactor that stopped declaring `saved_view` on the COLUMN_ID
    // batch would make every loop below iterate zero times and report green.
    expect(saved_view_column_id_records.length).to.be.greaterThan(0)
  })

  describe('user_data_views read path', function () {
    it('rewrites EVERY declared legacy id on the view-list fetch', function () {
      for (const [legacy_id, current_id] of saved_view_column_id_records) {
        const table_state = view_of(
          hydrate({
            reducer: data_views_reducer,
            type: data_views_actions.GET_DATA_VIEWS_FULFILLED,
            column_id: legacy_id
          }),
          'coverage'
        )

        expect(
          read_column_id(table_state.columns[0]),
          `columns entry for ${legacy_id}`
        ).to.equal(current_id)
        // sort carries only a column_id, so it follows the rename through
        // rename_map. A sort left behind silently stops ordering the table.
        expect(
          table_state.sort[0].column_id,
          `sort entry for ${legacy_id}`
        ).to.equal(current_id)
      }
    })

    // The remaining cases each assert that THIS action routes through the
    // migration. One rule settles that; walking all of them again would
    // re-exercise the same helper the list-fetch case already covers.
    it('rewrites on the single-view fetch', function () {
      const state = hydrate({
        reducer: data_views_reducer,
        type: data_views_actions.GET_DATA_VIEW_FULFILLED,
        column_id: SAMPLE_LEGACY_ID,
        single: true
      })
      expect(read_column_id(view_of(state, 'coverage').columns[0])).to.equal(
        SAMPLE_CURRENT_ID
      )
    })

    it('rewrites on the save response', function () {
      // The server echoes back what it stored, which is the UNMIGRATED row for
      // any view saved before the backfill.
      const state = hydrate({
        reducer: data_views_reducer,
        type: data_views_actions.POST_DATA_VIEW_FULFILLED,
        column_id: SAMPLE_LEGACY_ID,
        single: true
      })
      expect(read_column_id(view_of(state, 'coverage').columns[0])).to.equal(
        SAMPLE_CURRENT_ID
      )
    })

    it('rewrites on a restored browser snapshot', function () {
      // The versioned localStorage chain only migrates a snapshot whose stored
      // version is BEHIND, so a snapshot already at STORAGE_SCHEMA_VERSION and
      // carrying a newly renamed id would otherwise be restored over the
      // migrated server state and strand the view again.
      const hydrated = hydrate({
        reducer: data_views_reducer,
        type: data_views_actions.GET_DATA_VIEW_FULFILLED,
        column_id: SAMPLE_CURRENT_ID,
        single: true
      })

      const state = data_views_reducer(hydrated, {
        type: data_views_actions.RESTORE_DATA_VIEW_TABLE_STATE,
        payload: {
          view_id: 'coverage',
          table_state: {
            columns: [{ column_id: SAMPLE_LEGACY_ID, params: {} }],
            prefix_columns: []
          }
        }
      })

      expect(read_column_id(view_of(state, 'coverage').columns[0])).to.equal(
        SAMPLE_CURRENT_ID
      )
    })

    it('rewrites a column persisted as a bare string', function () {
      const state = data_views_reducer(undefined, {
        type: data_views_actions.GET_DATA_VIEWS_FULFILLED,
        payload: {
          data: [
            {
              ...saved_view_payload({ column_id: SAMPLE_LEGACY_ID }),
              table_state: {
                columns: [SAMPLE_LEGACY_ID],
                prefix_columns: [],
                where: [],
                sort: []
              }
            }
          ]
        }
      })
      expect(read_column_id(view_of(state, 'coverage').columns[0])).to.equal(
        SAMPLE_CURRENT_ID
      )
    })

    it('leaves saved_table_state in step with table_state', function () {
      // Migrating table_state alone would mark every hydrated view dirty on
      // load, since the unsaved-changes indicator compares the two.
      const state = hydrate({
        reducer: data_views_reducer,
        type: data_views_actions.GET_DATA_VIEWS_FULFILLED,
        column_id: SAMPLE_LEGACY_ID
      })
      const view = state.get('coverage')
      expect(view.get('saved_table_state')).to.deep.equal(
        view.get('table_state')
      )
    })

    it('leaves an id no rule names alone', function () {
      const state = hydrate({
        reducer: data_views_reducer,
        type: data_views_actions.GET_DATA_VIEWS_FULFILLED,
        column_id: UNKNOWN_ID
      })
      expect(read_column_id(view_of(state, 'coverage').columns[0])).to.equal(
        UNKNOWN_ID
      )
    })

    it('preserves the params a renamed column was saved with', function () {
      const state = data_views_reducer(undefined, {
        type: data_views_actions.GET_DATA_VIEW_FULFILLED,
        payload: {
          data: {
            ...saved_view_payload({ column_id: SAMPLE_LEGACY_ID }),
            table_state: {
              columns: [
                { column_id: SAMPLE_LEGACY_ID, params: { year: [2023] } }
              ],
              prefix_columns: [],
              where: [],
              sort: []
            }
          }
        }
      })
      const entry = view_of(state, 'coverage').columns[0]
      expect(entry.column_id).to.equal(SAMPLE_CURRENT_ID)
      expect(entry.params).to.deep.equal({ year: [2023] })
    })
  })

  describe('user_plays_views read path', function () {
    // Empty in production today. Wiring and checking it while it is empty is
    // what means it is already correct on the day it stops being empty.
    it('rewrites EVERY declared legacy id on the view-list fetch', function () {
      for (const [legacy_id, current_id] of saved_view_column_id_records) {
        const state = hydrate({
          reducer: plays_views_reducer,
          type: plays_views_actions.GET_PLAYS_VIEWS_FULFILLED,
          column_id: legacy_id
        })
        expect(
          read_column_id(view_of(state, 'coverage').columns[0]),
          `columns entry for ${legacy_id}`
        ).to.equal(current_id)
      }
    })

    it('rewrites on the single-view fetch', function () {
      const state = hydrate({
        reducer: plays_views_reducer,
        type: plays_views_actions.GET_PLAYS_VIEW_FULFILLED,
        column_id: SAMPLE_LEGACY_ID,
        single: true
      })
      expect(read_column_id(view_of(state, 'coverage').columns[0])).to.equal(
        SAMPLE_CURRENT_ID
      )
    })

    it('rewrites on the save response', function () {
      const state = hydrate({
        reducer: plays_views_reducer,
        type: plays_views_actions.POST_PLAYS_VIEW_FULFILLED,
        column_id: SAMPLE_LEGACY_ID,
        single: true
      })
      expect(read_column_id(view_of(state, 'coverage').columns[0])).to.equal(
        SAMPLE_CURRENT_ID
      )
    })

    it('leaves an id no rule names alone', function () {
      const state = hydrate({
        reducer: plays_views_reducer,
        type: plays_views_actions.GET_PLAYS_VIEWS_FULFILLED,
        column_id: UNKNOWN_ID
      })
      expect(read_column_id(view_of(state, 'coverage').columns[0])).to.equal(
        UNKNOWN_ID
      )
    })
  })
})
