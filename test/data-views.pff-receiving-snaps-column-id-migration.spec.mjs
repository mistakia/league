/* global describe it */

import * as chai from 'chai'

import { migrate_table_state } from '#libs-shared/data-views-saved-view-migration.mjs'
import parse_table_state_from_url from '#app/core/data-views/parse-table-state-from-url.mjs'

const expect = chai.expect

// Coverage for the 2026-08-13 pff receiving-snaps rename
// (db/adhoc/2026-08-13-pff-seasonlogs-routes.sql). PFF's `receiving_snaps`
// field counts the pass plays a player was on the field for -- what pff.com
// shows under PASS -- so the column became `pass_plays`, and a true `routes`
// column was added beside it for the value the old name claimed to hold.
//
// WHY THIS SPEC EXISTS AT ALL. The alternative to renaming was to leave the id
// `player_pff_receiving_snaps` alone and repoint it at the new `routes` column.
// That keeps every saved view rendering and silently changes the NUMBER it
// displays, and nothing in the gate set can see it: check-saved-view-param-
// coverage walks param KEYS, so a semantic repoint under a stable id is
// invisible to it, and the SQL stays valid so the validity gate is green too.
// The rename is therefore the value-preserving choice, and these assertions are
// what pin that -- a future repoint of either id fails here.
//
// Both persisted surfaces are covered because different code rewrites them: a
// saved view goes through migrate_table_state, while a share URL goes through
// parse_table_state_from_url and never enters the versioned migration chain (a
// query string carries no version field). 7 of 869 production URLs carried the
// old id when this landed, and a share link is immutable once sent.
//
// Asserts through the two PUBLIC entry points rather than importing the rename
// map, so a red here is an id that was not rewritten rather than a missing
// export.

const OLD_ID = 'player_pff_receiving_snaps'
const NEW_ID = 'player_pff_pass_plays'

const params = (object) => new URLSearchParams(object)
const json = (value) => JSON.stringify(value)

describe('data-views pff receiving_snaps column id migration', function () {
  describe('saved view', function () {
    it('rewrites the column id and preserves its params', function () {
      const { table_state, changed } = migrate_table_state({
        columns: [{ column_id: OLD_ID, params: { year: [2023] } }]
      })

      expect(changed).to.equal(true)
      expect(table_state.columns[0].column_id).to.equal(NEW_ID)
      // Value preservation is the point of the rename: the window the view was
      // saved with has to survive it.
      expect(table_state.columns[0].params).to.deep.equal({ year: [2023] })
    })

    it('rewrites a bare string column entry', function () {
      const { table_state } = migrate_table_state({ columns: [OLD_ID] })
      const entry = table_state.columns[0]
      const column_id = typeof entry === 'string' ? entry : entry.column_id
      expect(column_id).to.equal(NEW_ID)
    })

    it('carries a sort entry through the rename', function () {
      // sort carries only a column_id, so it follows via rename_map rather than
      // being migrated on its own. A sort left on the old id silently stops
      // ordering the table.
      const { table_state } = migrate_table_state({
        columns: [{ column_id: OLD_ID, params: {} }],
        sort: [{ column_id: OLD_ID, desc: true }]
      })

      expect(table_state.sort[0].column_id).to.equal(NEW_ID)
      expect(table_state.sort[0].desc).to.equal(true)
    })

    it('leaves the new routes id alone', function () {
      // player_pff_routes is a NEW column, not a rename target. If it ever
      // appears in COLUMN_ID_RENAMES something has confused the two values
      // again, which is the whole defect this cluster fixed.
      const { table_state } = migrate_table_state({
        columns: [{ column_id: 'player_pff_routes', params: {} }]
      })
      expect(table_state.columns[0].column_id).to.equal('player_pff_routes')
    })
  })

  describe('share url', function () {
    it('rewrites the column id', function () {
      const table_state = parse_table_state_from_url(
        params({ columns: json([OLD_ID]) })
      )
      const entry = table_state.columns[0]
      const column_id = typeof entry === 'string' ? entry : entry.column_id
      expect(column_id).to.equal(NEW_ID)
    })

    it('rewrites the column id in the object entry shape and keeps params', function () {
      const table_state = parse_table_state_from_url(
        params({
          columns: json([{ column_id: OLD_ID, params: { year: [2023] } }])
        })
      )

      expect(table_state.columns[0].column_id).to.equal(NEW_ID)
      expect(table_state.columns[0].params).to.deep.equal({ year: [2023] })
    })

    it('rewrites the column id in sort', function () {
      const table_state = parse_table_state_from_url(
        params({
          columns: json([OLD_ID]),
          sort: json([{ column_id: OLD_ID, desc: true }])
        })
      )
      expect(table_state.sort[0].column_id).to.equal(NEW_ID)
    })
  })
})
