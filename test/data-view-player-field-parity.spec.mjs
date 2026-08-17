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
//
// The registration and description halves are NOT specific to the player table,
// and scoping them there let the identical drift run for two years on the
// scoring-format-logs pair. 6ce38f740 (2024-08-03) deleted the four non-rank
// fantasy points fields from the frontend file alone, leaving the server
// definitions and the descriptions in place; the columns stayed queryable over
// the API, went unselectable in the UI, and threw "Field not found for
// column_id" on any saved view still holding one (signal 124653). Both pairs are
// covered below.
//
// The value-path assertion was scoped to the player table on the grounds that
// every scoring-format-logs definition carries a `select_as` and the player-table
// rule skips those, because a result key built from a PARAMETER has no single
// alias to compare against. That reasoning does not transfer: both
// scoring-format-logs factories build `select_as` from the column name alone and
// take no arguments, so there is exactly one alias per column. The exemption was
// removed on 2026-08-17 after the long-tail conform left all four rank columns
// reading a value path nothing answers. Check the ARITY of a `select_as` before
// concluding a family is unassertable.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as chai from 'chai'

import player_table_column_definitions from '#libs-server/data-views-column-definitions/player-table-column-definitions.mjs'
import player_scoring_format_logs_column_definitions from '#libs-server/data-views-column-definitions/player-scoring-format-logs-column-definitions.mjs'
import player_practice_column_definitions from '#libs-server/data-views-column-definitions/player-practice-column-definitions.mjs'
import pff_player_seasonlogs_column_definitions, {
  PFF_PLAYER_RANGE_OFFSET_AGGREGATE as pff_player_seasonlogs_range_offset_aggregate
} from '#libs-server/data-views-column-definitions/player-pff-seasonlogs-column-definitions.mjs'
import pff_player_facet_seasonlogs_column_definitions, {
  PFF_PLAYER_FACET_RANGE_OFFSET_AGGREGATE as pff_player_facet_seasonlogs_range_offset_aggregate
} from '#libs-server/data-views-column-definitions/player-pff-facet-seasonlogs-column-definitions.mjs'
import all_column_definitions from '#libs-server/data-views-column-definitions/index.mjs'
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

const scoring_format_logs_fields_source = fs.readFileSync(
  path.resolve(
    __dirname,
    '../app/core/data-views-fields/scoring-format-logs-table-fields.js'
  ),
  'utf8'
)

const pff_seasonlogs_fields_source = fs.readFileSync(
  path.resolve(
    __dirname,
    '../app/core/data-views-fields/player-pff-seasonlogs-table-fields.js'
  ),
  'utf8'
)

const pff_facet_seasonlogs_fields_source = fs.readFileSync(
  path.resolve(
    __dirname,
    '../app/core/data-views-fields/player-pff-facet-seasonlogs-table-fields.js'
  ),
  'utf8'
)

const practice_fields_source = fs.readFileSync(
  path.resolve(
    __dirname,
    '../app/core/data-views-fields/practice-table-fields.js'
  ),
  'utf8'
)

// The `export default { ... }` files are a different shape from the selector
// form above: two-space indent, and a key whose helper call is frequently on the
// FOLLOWING line when prettier wraps a long column id --
//
//   player_fantasy_points_per_game_from_seasonlogs:
//     from_scoring_format_seasonlogs({
//
// A parser anchored on `<key>: <helper>({` on one line silently drops exactly
// the longest ids, which are the ones most likely to be missing, so the key is
// matched alone and the wrap is not part of the pattern.
//
// It returns a Map of id -> player_value_path (null when the field declares
// none), the same shape `parse_frontend_fields` returns, so the id-only
// assertions read it through `.has` / `.size` / `.keys` unchanged. Each entry's
// body is bounded by the NEXT key match rather than by a brace scan: the wrapped
// form puts the opening brace on the following line, so there is no `\n  },` at
// this indent to anchor on, and slicing to the next key cannot swallow a
// sibling's value path.
const parse_export_default_fields = (source) => {
  const fields = new Map()
  const key_pattern = /^ {2}(player_[a-z0-9_]+):/gm
  const matches = [...source.matchAll(key_pattern)]

  for (const [index, match] of matches.entries()) {
    const body_end = matches[index + 1]?.index ?? source.length
    const body = source.slice(match.index, body_end)
    const value_path_match = body.match(/player_value_path: '([^']+)'/)
    fields.set(match[1], value_path_match ? value_path_match[1] : null)
  }

  return fields
}

// The REVERSE direction of every assertion in this file, and the one nothing
// covered until 2026-08-13. Each family's other checks iterate the SERVER ids,
// so DROPPING a server definition simply shrinks the iteration and they all stay
// green -- which is how b69d64899 orphaned `player_practice_status` in the
// frontend file, the description index and three saved views with every parity
// check passing. A frontend field with no server definition is fatal to a saved
// view holding it ("Field not found for column_id").
//
// It resolves against the FULL registry rather than the family's own module,
// because a frontend field file is not partitioned the way the server modules
// are: `player-table-fields.js` carries `player_nfl_teams`, whose definition
// lives in `player-team-column-definition.mjs`. Checking family-locally reports
// that as orphaned when it is correctly registered.
const find_orphaned_frontend_fields = (frontend_fields) =>
  [...frontend_fields.keys()].filter(
    (column_id) => !all_column_definitions[column_id]
  )

// Each field is a `    player_<name>: {` entry at a fixed indent inside the
// returned object literal, carrying an optional player_value_path before the
// entry closes. Anchoring on the indent keeps helper functions and the module's
// own top-level consts out of the match.
//
// The helper-call form (`player_contract_average_annual_value: contract_field({`) has to be
// matched too. An earlier version of this parser accepted only the bare object
// literal and silently dropped the nine contract columns -- they read as missing
// frontend fields when they are all present, which is the same vacuous-pattern
// failure the positive control above exists to catch, arriving from the other
// direction.
//
// `indent` is a parameter because the field files come in two shapes: the
// selector form nests its entries four spaces deep, while the plain
// `export default { ... }` files (practice) sit at two. A parser hardcoded to
// four spaces matches nothing in the latter and passes every assertion below by
// vacuous iteration -- the exact failure each block's positive control catches.
const parse_frontend_fields = (source, indent = 4) => {
  const fields = new Map()
  const pad = ' '.repeat(indent)
  const field_pattern = new RegExp(
    `^ {${indent}}(player_[a-z0-9_]+): (?:[a-z_]+\\()?\\{$`,
    'gm'
  )

  let match
  while ((match = field_pattern.exec(source)) !== null) {
    const column_id = match[1]
    const literal_end = source.indexOf(`\n${pad}},`, match.index)
    const call_end = source.indexOf(`\n${pad}}),`, match.index)
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
    expect(
      frontend_fields.get('player_contract_average_annual_value')
    ).to.equal('contract_average_annual_value')
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

  it('backs every frontend field with a server column definition', function () {
    expect(
      find_orphaned_frontend_fields(frontend_fields),
      'player table frontend fields with no server column definition'
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

describe('data view scoring format logs field parity', function () {
  const frontend_fields = parse_export_default_fields(
    scoring_format_logs_fields_source
  )
  const server_column_ids = Object.keys(
    player_scoring_format_logs_column_definitions
  )

  it('parses the frontend field file', function () {
    // Positive control, same reasoning as the player-table one: a parser that
    // matches nothing passes both assertions below by vacuous iteration.
    expect(frontend_fields.size).to.be.greaterThan(10)
    // The same-line form.
    expect(
      frontend_fields.has('player_fantasy_points_rank_from_seasonlogs')
    ).to.equal(true)
    // The prettier-wrapped form, which a one-line pattern would miss.
    expect(
      frontend_fields.has(
        'player_fantasy_points_per_game_position_rank_from_seasonlogs'
      )
    ).to.equal(true)
    // A value path off the wrapped form, so a parser that finds every id and no
    // path cannot pass the assertion below by iterating nulls.
    expect(
      frontend_fields.get(
        'player_fantasy_points_per_game_position_rank_from_seasonlogs'
      )
    ).to.equal('points_per_game_position_rank_from_seasonlogs')
  })

  it('registers every server column in the frontend field file', function () {
    const missing = server_column_ids.filter(
      (column_id) => !frontend_fields.has(column_id)
    )
    expect(
      missing,
      `scoring format logs columns with no frontend field (unselectable in the UI): ${missing.join(', ')}`
    ).to.deep.equal([])
  })

  it('describes every server column in the shared fields index', function () {
    const missing = server_column_ids.filter(
      (column_id) => !data_view_fields_index[column_id]
    )
    expect(
      missing,
      `scoring format logs columns with no description: ${missing.join(', ')}`
    ).to.deep.equal([])
  })

  it('backs every frontend field with a server column definition', function () {
    expect(
      find_orphaned_frontend_fields(frontend_fields),
      'scoring format logs frontend fields with no server column definition'
    ).to.deep.equal([])
  })

  // The value path IS checkable here, and the comment on the pff block below
  // said otherwise until 2026-08-17 -- which is what left this family uncovered
  // while its two neighbours were gated. Every definition carries a select_as,
  // but both factories build it from the column name alone and take no
  // arguments (`${column_name}_from_{season,career}logs`), so there is exactly
  // one alias per column and CALLING it is an exact oracle rather than a
  // restatement of the derivation.
  //
  // The gap was live: the 2026-08-17 long-tail conform moved points_rnk /
  // points_pos_rnk / points_per_game_rnk / points_per_game_pos_rnk to their
  // full-word names and swept the server definitions, the fields index and the
  // goldens, but not this file -- a word-bounded rewrite of `points_rnk` cannot
  // match `points_rnk_from_seasonlogs`, because the next character is an
  // underscore. All four rank columns rendered an empty cell in the default
  // data view, with the API returning the values correctly.
  it('matches each frontend value path to the emitted alias', function () {
    const mismatched = []

    for (const column_id of server_column_ids) {
      const definition =
        player_scoring_format_logs_column_definitions[column_id]

      const value_path = frontend_fields.get(column_id)
      if (!value_path) continue

      const expected_path = definition.select_as()
      if (value_path !== expected_path) {
        mismatched.push(
          `${column_id}: frontend reads '${value_path}', server emits '${expected_path}'`
        )
      }
    }

    expect(
      mismatched,
      `frontend value paths that render an empty cell: ${mismatched.join('; ')}`
    ).to.deep.equal([])
  })
})

// The PFF seasonlog family, added 2026-08-13. It was outside this file until
// then and had accumulated ELEVEN defects behind a green suite: two value paths
// that rendered blank cells (player_pff_run, player_pff_pass -- both cited in
// this repo's own CLAUDE.md as the standing example of the class), six server
// columns with a description and no frontend field at all (height, weight,
// speed, position, unit, meets_snap_minimum), and three stale entries in the
// aggregate map below.
//
// The value path is checkable here even though every definition carries a
// select_as: create_field_from_pff_player_seasonlogs builds it as
// `pff_${column_name}`, deterministically, so there is exactly one alias to
// compare against. (This said "unlike scoring-format-logs" until 2026-08-17;
// that family's select_as is equally deterministic and is now gated too, and
// the false exemption is what left four of its columns rendering blank.) That derivation is the whole reason a repoint moves the
// payload key, which is what makes this assertion load-bearing rather than
// decorative.
describe('data view pff seasonlogs field parity', function () {
  const frontend_fields = parse_frontend_fields(pff_seasonlogs_fields_source)
  const server_column_ids = Object.keys(
    pff_player_seasonlogs_column_definitions
  )

  it('parses the frontend field file', function () {
    // Positive control: a parser matching nothing passes everything below by
    // vacuous iteration.
    expect(frontend_fields.size).to.be.greaterThan(30)
    expect(frontend_fields.get('player_pff_offense')).to.equal('pff_offense')
  })

  it('registers every server column in the frontend field file', function () {
    const missing = server_column_ids.filter(
      (column_id) => !frontend_fields.has(column_id)
    )
    expect(
      missing,
      `pff seasonlog columns with no frontend field (unselectable in the UI, and fatal to a saved view holding one): ${missing.join(', ')}`
    ).to.deep.equal([])
  })

  it('describes every server column in the shared fields index', function () {
    const missing = server_column_ids.filter(
      (column_id) => !data_view_fields_index[column_id]
    )
    expect(
      missing,
      `pff seasonlog columns with no description: ${missing.join(', ')}`
    ).to.deep.equal([])
  })

  it('backs every frontend field with a server column definition', function () {
    expect(
      find_orphaned_frontend_fields(frontend_fields),
      'pff seasonlog frontend fields with no server column definition'
    ).to.deep.equal([])
  })

  it('matches each frontend value path to the emitted pff_ alias', function () {
    const mismatched = []

    for (const column_id of server_column_ids) {
      const { column_name } =
        pff_player_seasonlogs_column_definitions[column_id]
      if (!column_name) continue

      const value_path = frontend_fields.get(column_id)
      if (!value_path) continue

      const expected_path = `pff_${column_name}`
      if (value_path !== expected_path) {
        mismatched.push(
          `${column_id}: frontend reads '${value_path}', server emits '${expected_path}'`
        )
      }
    }

    expect(
      mismatched,
      `frontend value paths that render an empty cell: ${mismatched.join('; ')}`
    ).to.deep.equal([])
  })

  it('keys every aggregate override on a real column name', function () {
    // A key that matches no column silently falls back to SUM
    // (select-string.mjs), so a multi-year window ADDS grades instead of
    // averaging them -- wrong numbers rather than missing ones, and nothing
    // anywhere reports it. `pass`, `run` and `speed` were in that state from
    // adffc01fe until 2026-08-13.
    const column_names = new Set(
      server_column_ids
        .map((id) => pff_player_seasonlogs_column_definitions[id].column_name)
        .filter(Boolean)
    )
    const orphaned = Object.keys(
      pff_player_seasonlogs_range_offset_aggregate
    ).filter((key) => !column_names.has(key))

    expect(
      orphaned,
      `aggregate overrides keyed on a column that does not exist, so they silently default to SUM: ${orphaned.join(', ')}`
    ).to.deep.equal([])
  })
})

// The PFF facet-seasonlogs family (2026-08-15): the OL / pressure / signature
// detail. Unlike the pff seasonlog family it omits the value-path assertion --
// none of these fields carries a player_value_path, because the measurements
// live only on pff_player_facet_seasonlogs and never on the player object, so a
// path would render a blank cell.
describe('data view pff facet seasonlogs field parity', function () {
  const frontend_fields = parse_frontend_fields(
    pff_facet_seasonlogs_fields_source
  )
  const server_column_ids = Object.keys(
    pff_player_facet_seasonlogs_column_definitions
  )

  it('parses the frontend field file', function () {
    // Positive control: a parser matching nothing passes everything below by
    // vacuous iteration.
    expect(frontend_fields.size).to.be.greaterThan(10)
    expect(frontend_fields.has('player_pff_pressures_allowed')).to.equal(true)
  })

  it('registers every server column in the frontend field file', function () {
    const missing = server_column_ids.filter(
      (column_id) => !frontend_fields.has(column_id)
    )
    expect(
      missing,
      `pff facet seasonlog columns with no frontend field (unselectable in the UI, and fatal to a saved view holding one): ${missing.join(', ')}`
    ).to.deep.equal([])
  })

  it('describes every server column in the shared fields index', function () {
    const missing = server_column_ids.filter(
      (column_id) => !data_view_fields_index[column_id]
    )
    expect(
      missing,
      `pff facet seasonlog columns with no description: ${missing.join(', ')}`
    ).to.deep.equal([])
  })

  it('backs every frontend field with a server column definition', function () {
    expect(
      find_orphaned_frontend_fields(frontend_fields),
      'pff facet seasonlog frontend fields with no server column definition'
    ).to.deep.equal([])
  })

  it('keys every aggregate override on a real column name', function () {
    const column_names = new Set(
      server_column_ids
        .map(
          (id) => pff_player_facet_seasonlogs_column_definitions[id].column_name
        )
        .filter(Boolean)
    )
    const orphaned = Object.keys(
      pff_player_facet_seasonlogs_range_offset_aggregate
    ).filter((key) => !column_names.has(key))

    expect(
      orphaned,
      `aggregate overrides keyed on a column that does not exist, so they silently default to SUM: ${orphaned.join(', ')}`
    ).to.deep.equal([])
  })
})

describe('data view practice field parity', function () {
  // This file is the `export default { ... }` shape, so its entries sit at a
  // two-space indent rather than the selector form's four.
  const frontend_fields = parse_frontend_fields(practice_fields_source, 2)
  const server_column_ids = Object.keys(player_practice_column_definitions)

  it('parses the frontend field file', function () {
    // Positive control: a parser matching nothing passes everything below by
    // vacuous iteration.
    expect(frontend_fields.size).to.be.greaterThan(5)
    expect(frontend_fields.get('player_practice_status')).to.equal(
      'practice_status'
    )
  })

  it('registers every server column in the frontend field file', function () {
    const missing = server_column_ids.filter(
      (column_id) => !frontend_fields.has(column_id)
    )
    expect(
      missing,
      `practice columns with no frontend field (unselectable in the UI, and fatal to a saved view holding one): ${missing.join(', ')}`
    ).to.deep.equal([])
  })

  it('describes every server column in the shared fields index', function () {
    const missing = server_column_ids.filter(
      (column_id) => !data_view_fields_index[column_id]
    )
    expect(
      missing,
      `practice columns with no description: ${missing.join(', ')}`
    ).to.deep.equal([])
  })

  it('backs every frontend field with a server column definition', function () {
    // The REVERSE direction, and the one that caught nothing until 2026-08-13.
    // Every assertion above iterates the SERVER ids, so dropping a server
    // definition simply shrinks the iteration and each of them stays green --
    // which is exactly how b69d64899 orphaned `player_practice_status` in the
    // frontend file, the description index and three saved views while every
    // parity check passed. A frontend field with no server definition is fatal
    // to any saved view holding it ("Field not found for column_id").
    expect(
      find_orphaned_frontend_fields(frontend_fields),
      'practice frontend fields with no server column definition'
    ).to.deep.equal([])
  })

  it('matches each frontend value path to the emitted alias', function () {
    // The practice family pins `select_as` explicitly rather than deriving it
    // from the column name, so the expected path is whatever that thunk
    // returns -- not a `${prefix}_${column_name}` reconstruction.
    const mismatched = []

    for (const column_id of server_column_ids) {
      const { select_as } = player_practice_column_definitions[column_id]
      if (typeof select_as !== 'function') continue

      const value_path = frontend_fields.get(column_id)
      if (!value_path) continue

      const expected_path = select_as()
      if (value_path !== expected_path) {
        mismatched.push(
          `${column_id}: frontend reads '${value_path}', server emits '${expected_path}'`
        )
      }
    }

    expect(
      mismatched,
      `frontend value paths that render an empty cell: ${mismatched.join('; ')}`
    ).to.deep.equal([])
  })
})
