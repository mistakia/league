/* global describe it */

// Structural parity for the player-table data-view column, across the three
// registries a column has to appear in to be usable:
//
//   1. libs-server/data-views-column-definitions/player-table-column-definitions.mjs
//      -- the server definition, which is what makes the column queryable.
//   2. libs-shared/data-view-fields-index.mjs -- the description.
//   3. app/core/data-views-fields/player-table-fields.js -- the frontend field,
//      which is the ONLY thing that makes the column selectable in the UI.
//
// The failure this prevents is silent in both directions. A column registered
// server-side and described but missing from the frontend file is queryable over
// the API and invisible in the app, and the two files anyone thinks to check
// agree with each other -- which is how 17 columns accumulated there, including
// every external ID added after 2026-07 (underdog, sumer, fantasylabs, fantrax,
// ffpc, nffc, sis, fantasypoints). A commit that repaired the server/shared pair
// for nine of them treated the pairing as total and shipped, because the app
// registry was not in the check.
//
// The third assertion is the value path, and it is the one with live defects
// behind it. react-table resolves a cell as row[`${accessorKey}_${index}`] ||
// row[accessorKey] (table-menu.js:211), accessorKey defaults to
// player_value_path (data-views-fields/index.js:147), and the server aliases the
// result column as column_definition.column_name (select-string.mjs:139). So a
// player_value_path that disagrees with the server column_name renders an empty
// cell for a value the API returned correctly -- no error, no warning, nothing in
// the logs. player_rts_id ('rts_id' vs rts_player_id) and player_fanduel_id
// ('fanduel_id' vs fanduel_player_id) were both broken this way.
//
// The column_name is not the whole story, though, and asserting it alone is
// wrong: createPlayer (app/core/players/player.js) normalizes each row before it
// reaches the table and renames two keys on the way through. A field reading the
// post-normalization name is correct, so those renames are carried below as a
// reviewed map rather than treated as defects -- a check that flagged them would
// have been "fixed" by breaking two working columns.
//
// The frontend file is read as text rather than imported: it resolves webpack
// aliases (@components, @constants) and imports React components, so it is not
// Node-importable without an alias harness. Parsing costs the ability to see
// computed keys, which this file does not use.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as chai from 'chai'

import player_table_column_definitions from '#libs-server/data-views-column-definitions/player-table-column-definitions.mjs'
import data_view_fields_index from '#libs-shared/data-view-fields-index.mjs'

const { expect } = chai
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const player_table_fields_path = path.resolve(
  __dirname,
  '../app/core/data-views-fields/player-table-fields.js'
)
const player_table_fields_source = fs.readFileSync(
  player_table_fields_path,
  'utf8'
)

// Each field is a `    player_<name>: {` entry at a fixed indent inside the
// returned object literal, carrying an optional player_value_path before the
// entry closes. Anchoring on the indent keeps helper functions and the module's
// own top-level consts out of the match.
//
// The helper-call form (`player_contract_apy: contract_field({`) has to be
// matched too. An earlier version of this parser accepted only the bare object
// literal and silently dropped the nine contract columns -- they read as missing
// frontend fields when they are all present, which is the same vacuous-pattern
// failure the positive control above exists to catch, arriving from the other
// direction.
const parse_frontend_fields = (source) => {
  const fields = new Map()
  const field_pattern = /^ {4}(player_[a-z0-9_]+): (?:[a-z_]+\()?\{$/gm

  let match
  while ((match = field_pattern.exec(source)) !== null) {
    const column_id = match[1]
    const literal_end = source.indexOf('\n    },', match.index)
    const call_end = source.indexOf('\n    }),', match.index)
    const body_end =
      call_end !== -1 && (literal_end === -1 || call_end < literal_end)
        ? call_end
        : literal_end
    const body = source.slice(match.index, body_end)
    const value_path_match = body.match(/player_value_path: '([^']+)'/)
    fields.set(column_id, value_path_match ? value_path_match[1] : null)
  }

  return fields
}

describe('data view player field parity', function () {
  const frontend_fields = parse_frontend_fields(player_table_fields_source)
  const server_column_ids = Object.keys(player_table_column_definitions)

  it('parses the frontend field file', function () {
    // Positive control. A parser that matches nothing would pass every
    // assertion below by vacuous iteration, which is the failure mode that reads
    // exactly like success.
    expect(frontend_fields.size).to.be.greaterThan(50)
    expect(frontend_fields.get('player_position')).to.equal('primary_position')
    // The helper-call form, which the first version of the parser missed.
    expect(frontend_fields.get('player_contract_apy')).to.equal('contract_apy')
  })

  it('registers every server column in the frontend field file', function () {
    const missing = server_column_ids.filter(
      (column_id) => !frontend_fields.has(column_id)
    )
    expect(
      missing,
      `player table columns with no frontend field (unselectable in the UI): ${missing.join(', ')}`
    ).to.deep.equal([])
  })

  it('describes every server column in the shared fields index', function () {
    const missing = server_column_ids.filter(
      (column_id) => !data_view_fields_index[column_id]
    )
    expect(
      missing,
      `player table columns with no description: ${missing.join(', ')}`
    ).to.deep.equal([])
  })

  it('matches each frontend value path to the server column name', function () {
    // Renames performed by createPlayer (app/core/players/player.js) between the
    // API row and the table row. Reviewed, not derived: the normalizer spreads
    // the rest of the row through untouched, so this is the complete set of keys
    // whose table name differs from the server alias.
    const normalizer_renames = {
      current_nfl_team: 'team'
    }

    const mismatched = []

    for (const column_id of server_column_ids) {
      const definition = player_table_column_definitions[column_id]

      // select_as columns alias on a parameter, so the result key is not the
      // physical column name and cannot be checked statically. A definition with
      // no column_name at all is computed (main_select over several columns,
      // like player_name or the derived athleticism scores) and has no single
      // alias to compare against.
      if (definition.select_as || !definition.column_name) continue

      const value_path = frontend_fields.get(column_id)
      if (!value_path) continue

      const expected_path =
        normalizer_renames[definition.column_name] || definition.column_name

      if (value_path !== expected_path) {
        mismatched.push(
          `${column_id}: frontend reads '${value_path}', row carries '${expected_path}'`
        )
      }
    }

    expect(
      mismatched,
      `frontend value paths that render an empty cell: ${mismatched.join('; ')}`
    ).to.deep.equal([])
  })
})
