/* global describe it */

import * as chai from 'chai'

import {
  RENAME_REGISTRY,
  COLUMN_ID_RENAMES
} from '#libs-shared/data-views-saved-view-migration.mjs'
import { data_views_actions } from '#app/core/data-views/actions.js'
import { data_views_reducer } from '#app/core/data-views/reducer.js'
import { plays_views_actions } from '#app/core/plays-view/actions.js'
import { plays_views_reducer } from '#app/core/plays-view/reducer.js'

const expect = chai.expect

// Reachability oracle for the saved_view surface's COLUMN_ID rules.
//
// WHY THIS EXISTS. `data-views-saved-view-migration.mjs` declares COLUMN_ID
// rules for three surfaces, and for two of them a declared rule is
// automatically applied: local_storage runs the versioned chain, short_url runs
// parse_table_state_from_url. The saved_view surface applied NOTHING at read
// time, and nothing said so -- the existing per-rename specs assert through
// `migrate_table_state`, which is the shared function, not the saved-view read
// path. So they were green for eleven days while a production row stranded on
// `player_season_projected_pass_yards` rendered a blank page (signals
// 127159/127160). A spec that calls the migration directly cannot see whether
// anything CALLS the migration.
//
// This asserts through the REDUCER instead, which is the read path: the point
// where a server-persisted table_state enters the store. Remove the
// migrate_persisted call from either reducer and this goes red on every
// declared rule.
//
// Scope note: the rule population is derived from RENAME_REGISTRY rather than
// listed here, so a COLUMN_ID rule added tomorrow is covered the day it lands,
// which is exactly the failure mode the incident was.

const saved_view_column_id_records = RENAME_REGISTRY.filter(
  (entry) =>
    entry.level === 'column_id' && entry.surfaces.includes('saved_view')
).flatMap((entry) => Object.entries(entry.records))

// An id no rule names. Used as the negative control on every read path: the
// reducer has to leave it alone, which is what makes a passing assertion above
// evidence of a RENAME rather than of blanket rewriting.
const UNKNOWN_ID = 'player_no_such_column_id_exists_for_this_control'

const read_column_id = (entry) =>
  typeof entry === 'string' ? entry : entry?.column_id

const view_of = (state, view_id) => state.get(view_id).get('table_state')

const saved_view_payload = ({ view_id, column_id }) => ({
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

describe('data-views saved_view column_id read coverage', function () {
  it('declares at least one saved_view column_id rule to check', function () {
    // A registry refactor that stopped declaring `saved_view` on the COLUMN_ID
    // batch would make every loop below iterate zero times and report green.
    expect(saved_view_column_id_records.length).to.be.greaterThan(0)
  })

  describe('user_data_views read path', function () {
    it('rewrites every declared legacy id on the view-list fetch', function () {
      for (const [legacy_id, current_id] of saved_view_column_id_records) {
        const state = data_views_reducer(undefined, {
          type: data_views_actions.GET_DATA_VIEWS_FULFILLED,
          payload: {
            data: [
              saved_view_payload({ view_id: 'coverage', column_id: legacy_id })
            ]
          }
        })

        const table_state = view_of(state, 'coverage')
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

    it('rewrites every declared legacy id on the single-view fetch', function () {
      for (const [legacy_id, current_id] of saved_view_column_id_records) {
        const state = data_views_reducer(undefined, {
          type: data_views_actions.GET_DATA_VIEW_FULFILLED,
          payload: {
            data: saved_view_payload({
              view_id: 'coverage',
              column_id: legacy_id
            })
          }
        })
        expect(
          read_column_id(view_of(state, 'coverage').columns[0]),
          `columns entry for ${legacy_id}`
        ).to.equal(current_id)
      }
    })

    it('rewrites every declared legacy id on a restored browser snapshot', function () {
      // The versioned localStorage chain only migrates a snapshot whose stored
      // version is BEHIND, so a snapshot already at STORAGE_SCHEMA_VERSION and
      // carrying a newly renamed id would otherwise be restored over the
      // migrated server state and strand the view again.
      for (const [legacy_id, current_id] of saved_view_column_id_records) {
        const hydrated = data_views_reducer(undefined, {
          type: data_views_actions.GET_DATA_VIEW_FULFILLED,
          payload: {
            data: saved_view_payload({
              view_id: 'coverage',
              column_id: current_id
            })
          }
        })

        const state = data_views_reducer(hydrated, {
          type: data_views_actions.RESTORE_DATA_VIEW_TABLE_STATE,
          payload: {
            view_id: 'coverage',
            table_state: {
              columns: [{ column_id: legacy_id, params: {} }],
              prefix_columns: []
            }
          }
        })

        expect(
          read_column_id(view_of(state, 'coverage').columns[0]),
          `restored snapshot for ${legacy_id}`
        ).to.equal(current_id)
      }
    })

    it('leaves saved_table_state in step with table_state', function () {
      // Migrating table_state alone would mark every hydrated view dirty on
      // load, since data-views.js decides the unsaved-changes indicator by
      // comparing the two.
      const [legacy_id] = saved_view_column_id_records[0]
      const state = data_views_reducer(undefined, {
        type: data_views_actions.GET_DATA_VIEWS_FULFILLED,
        payload: {
          data: [
            saved_view_payload({ view_id: 'coverage', column_id: legacy_id })
          ]
        }
      })
      const view = state.get('coverage')
      expect(view.get('saved_table_state')).to.deep.equal(
        view.get('table_state')
      )
    })

    it('leaves an id no rule names alone', function () {
      const state = data_views_reducer(undefined, {
        type: data_views_actions.GET_DATA_VIEWS_FULFILLED,
        payload: {
          data: [
            saved_view_payload({ view_id: 'coverage', column_id: UNKNOWN_ID })
          ]
        }
      })
      expect(read_column_id(view_of(state, 'coverage').columns[0])).to.equal(
        UNKNOWN_ID
      )
    })

    it('preserves the params a renamed column was saved with', function () {
      const [legacy_id, current_id] = saved_view_column_id_records[0]
      const state = data_views_reducer(undefined, {
        type: data_views_actions.GET_DATA_VIEW_FULFILLED,
        payload: {
          data: {
            ...saved_view_payload({
              view_id: 'coverage',
              column_id: legacy_id
            }),
            table_state: {
              columns: [{ column_id: legacy_id, params: { year: [2023] } }],
              prefix_columns: [],
              where: [],
              sort: []
            }
          }
        }
      })
      const entry = view_of(state, 'coverage').columns[0]
      expect(entry.column_id).to.equal(current_id)
      expect(entry.params).to.deep.equal({ year: [2023] })
    })
  })

  describe('user_plays_views read path', function () {
    // Empty in production today. Wiring and checking it while it is empty is
    // what means it is already correct on the day it stops being empty.
    it('rewrites every declared legacy id on the view-list fetch', function () {
      for (const [legacy_id, current_id] of saved_view_column_id_records) {
        const state = plays_views_reducer(undefined, {
          type: plays_views_actions.GET_PLAYS_VIEWS_FULFILLED,
          payload: {
            data: [
              saved_view_payload({ view_id: 'coverage', column_id: legacy_id })
            ]
          }
        })
        expect(
          read_column_id(view_of(state, 'coverage').columns[0]),
          `columns entry for ${legacy_id}`
        ).to.equal(current_id)
      }
    })

    it('leaves an id no rule names alone', function () {
      const state = plays_views_reducer(undefined, {
        type: plays_views_actions.GET_PLAYS_VIEWS_FULFILLED,
        payload: {
          data: [
            saved_view_payload({ view_id: 'coverage', column_id: UNKNOWN_ID })
          ]
        }
      })
      expect(read_column_id(view_of(state, 'coverage').columns[0])).to.equal(
        UNKNOWN_ID
      )
    })
  })

  it('declares no column_id chain the single-pass migration cannot resolve', function () {
    // migrate_column_entry does ONE map lookup, so a rule whose target is
    // itself a legacy id leaves the view on an intermediate spelling that no
    // field resolves -- a rename that reads as covered and is not. Params chain
    // legitimately (resolved by declared merge order); column ids do not.
    const unresolved = Object.entries(COLUMN_ID_RENAMES)
      .filter(([, current_id]) =>
        Object.prototype.hasOwnProperty.call(COLUMN_ID_RENAMES, current_id)
      )
      .map(([legacy_id, current_id]) => `${legacy_id} -> ${current_id}`)

    expect(unresolved).to.deep.equal([])
  })
})
