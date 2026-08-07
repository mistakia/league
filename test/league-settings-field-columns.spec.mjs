/* global describe before it */
import * as chai from 'chai'

import db from '#db'
import {
  league_fields,
  season_fields,
  integer_fields,
  positive_integer_fields
} from '#api/routes/leagues/league-settings.mjs'
import swagger_config from '#api/swagger/config.mjs'

const expect = chai.expect

// `PUT /leagues/:lid/settings` dispatches on these lists: a field in
// `league_fields` is written straight through as `db('leagues').update({ [field]: value })`.
// The lists are plain string arrays, so they name no table and no gate can see
// them -- `check-knex-column-resolution` cannot resolve a computed update key,
// and `check-api-response-shapes` gate 2 leaves both league schemas uncovered
// (measured: the gate stays green with the whole swagger half of a rename
// reverted). Nothing else in the suite names these fields either.
//
// The failure a stale entry produces is not symmetric. An entry naming a dropped
// column reaches Postgres as a 42703 on a real commissioner's edit, which is a
// 500 rather than anything a test would catch. A MISSING entry is quieter still:
// the route falls through every branch and answers as though the update
// succeeded while writing nothing.

const columns_of = async (table) =>
  new Set(Object.keys(await db(table).columnInfo()))

describe('league settings field lists', function () {
  this.timeout(30000)

  let leagues_columns
  let seasons_columns

  before(async () => {
    leagues_columns = await columns_of('leagues')
    seasons_columns = await columns_of('seasons')
  })

  it('every league_fields entry is a real leagues column', () => {
    expect(league_fields.length).to.be.at.least(5)

    const unresolved = league_fields.filter((f) => !leagues_columns.has(f))
    expect(unresolved).to.deep.equal(
      [],
      `league_fields naming no leagues column: ${unresolved.join(', ')}`
    )
  })

  it('every season_fields entry is a real seasons column', () => {
    expect(season_fields.length).to.be.at.least(5)

    const unresolved = season_fields.filter((f) => !seasons_columns.has(f))
    expect(unresolved).to.deep.equal(
      [],
      `season_fields naming no seasons column: ${unresolved.join(', ')}`
    )
  })

  it('the league-scoped validation lists stay in step with league_fields', () => {
    // A provider id validated as an integer but absent from `league_fields` is
    // accepted, type-checked and then silently not written, because the route
    // dispatches on `league_fields` alone. Both directions matter, so this
    // asserts the intersection rather than one-way containment.
    const league_scoped = (list) =>
      list.filter((field) => leagues_columns.has(field)).sort()

    const validated = new Set([
      ...league_scoped(integer_fields),
      ...league_scoped(positive_integer_fields)
    ])

    const validated_but_unwritable = [...validated].filter(
      (field) => !league_fields.includes(field)
    )
    expect(validated_but_unwritable).to.deep.equal(
      [],
      `validated as a leagues column but absent from league_fields: ${validated_but_unwritable.join(', ')}`
    )
  })

  it('the swagger League schemas document only real leagues columns', () => {
    const schemas = swagger_config.components.schemas
    const documented = new Set()

    for (const name of ['League', 'LeagueSettings']) {
      const properties = schemas[name]?.properties
      expect(properties, `swagger schema ${name} is missing`).to.be.an('object')
      Object.keys(properties).forEach((key) => documented.add(key))
    }

    // These schemas carry response-shape keys that are not leagues columns
    // (`teams`, `commissioner`, and the like), so a bare "every documented key
    // is a column" assertion would be wrong. The claim that IS checkable is the
    // one a rename breaks: a key spelled like an external-provider id must be
    // the spelling the table uses.
    const provider_id_keys = [...documented].filter((key) =>
      /^(espn|sleeper|mfl|fleaflicker|yahoo|cbs)(_league)?_id$/.test(key)
    )
    expect(provider_id_keys.length).to.be.at.least(
      4,
      'no provider-id keys found in the League schemas -- the pattern no longer matches, so this assertion is vacuous'
    )

    const unresolved = provider_id_keys.filter(
      (key) => !leagues_columns.has(key)
    )
    expect(unresolved).to.deep.equal(
      [],
      `swagger documents provider ids that are not leagues columns: ${unresolved.join(', ')}`
    )
  })
})
