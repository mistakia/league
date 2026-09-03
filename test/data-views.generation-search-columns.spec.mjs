/* global describe it */
import * as chai from 'chai'

import { search_columns } from '#libs-server/data-views/generation/search-columns.mjs'
import { get_data_view_generation_catalog } from '#libs-server/data-views/generation/build-data-view-generation-catalog.mjs'

const { expect } = chai

// Retrieval exists so a caller pulls the handful of columns an instruction is
// about instead of being pushed all 597. Two properties decide whether it is
// usable, and they pull against each other:
//
//   1. a phrase naming a measure finds that measure, and
//   2. a phrase naming nothing finds NOTHING.
//
// The second is the one worth testing hardest. A retriever that always returns
// its top ten looks fine in every demo and is actively harmful in use: the
// caller cannot distinguish "here are the columns you meant" from "the catalog
// has no idea what you meant, here are ten anyway", and a generated view built
// on the second is wrong with no signal that it is wrong.

describe('data view generation / column search', () => {
  it('finds a measure named in plain language', () => {
    const { columns } = search_columns({
      query: 'betting market implied probability',
      limit: 5
    })
    const ids = columns.map((result) => result.column_id)

    expect(ids).to.include(
      'player_game_prop_implied_probability_from_betting_markets'
    )
  })

  it('returns the column param vocabulary alongside the match', () => {
    // The point of the whole exercise. A caller that finds the column and not
    // its params can name the measure and cannot configure it.
    const [top] = search_columns({
      query: 'betting market implied probability',
      limit: 1
    }).columns

    expect(top.param_keys).to.include('market_type')
    expect(top.param_keys).to.include('source_id')
    expect(top.param_keys).to.include('time_type')
  })

  it('returns nothing for a phrase the corpus has no terms for', () => {
    for (const query of [
      'zqx wibble frobnicate',
      'asdfgh qwerty',
      'flibbertigibbet zorptastic'
    ]) {
      expect(search_columns({ query }).columns, query).to.deep.equal([])
    }
  })

  it('returns nothing for an empty or absent query', () => {
    expect(search_columns({ query: '' }).columns).to.deep.equal([])
    expect(search_columns({}).columns).to.deep.equal([])
  })

  // The ranking regression. Coverage saturates at 1 for every column matching
  // every query term, which left `column_id` alphabetical order deciding the
  // result: a search for "receiving yards" returned ten `nfl_team_seasonlogs_*`
  // columns and `player_receiving_yards_from_plays` appeared nowhere in the top
  // ten. Each case below is a phrase a person would actually type, paired with
  // the column a person who knows the schema would pick.
  const canonical_cases = [
    ['receiving yards', 'player', 'player_receiving_yards_from_plays'],
    ['passing yards', 'player', 'player_pass_yards_from_plays'],
    ['rushing yards', 'player', 'player_rush_yards_from_plays'],
    ['targets', 'player', 'player_targets_from_plays'],
    ['receptions', 'player', 'player_receptions_from_plays']
  ]

  for (const [query, grain, expected_column_id] of canonical_cases) {
    it(`ranks ${expected_column_id} first for "${query}"`, () => {
      const { columns } = search_columns({ query, grain, limit: 5 })
      expect(columns[0].column_id, query).to.equal(expected_column_id)
    })
  }

  it('restricts to the requested grain', () => {
    // "wide receivers" is a player question, but the words "receiving yards"
    // match team and player columns equally, and the team family is larger.
    const { columns } = search_columns({
      query: 'receiving yards',
      grain: 'player',
      limit: 20
    })

    expect(columns).to.not.be.empty
    for (const column of columns) {
      expect(column.grain, column.column_id).to.match(/^player/)
    }
  })

  it('reports the whole match set, not the returned page', () => {
    // A truncated result used to be indistinguishable from an exhaustive one,
    // so a caller had no signal that narrowing the query would help.
    const result = search_columns({ query: 'yards', limit: 3 })

    expect(result.returned_count).to.equal(3)
    expect(result.match_count).to.be.above(3)
  })

  it('folds inflections so a query term meets an id term', () => {
    // `player_pass_yards_from_plays` spells it `pass`; a person types "passing".
    // Unfolded, the query matched only the prose description and first place
    // went to the column that spells the inflection out.
    const { columns } = search_columns({
      query: 'passing yards',
      grain: 'player',
      limit: 3
    })

    expect(columns[0].column_id).to.equal('player_pass_yards_from_plays')
  })

  it('ranks the described column first for its own description', () => {
    // Self-retrieval over the corpus. A weak test on its own -- the query is
    // the document -- but it fails loudly if scoring, tokenizing or the index
    // break, and it is the only assertion here that covers all 523 descriptions
    // rather than a chosen few.
    const catalog = get_data_view_generation_catalog()
    const described = catalog.columns.filter((column) => column.description)

    let found_in_top_five = 0
    for (const column of described) {
      const ids = search_columns({
        query: column.description,
        limit: 5
      }).columns.map((result) => result.column_id)
      if (ids.includes(column.column_id)) {
        found_in_top_five += 1
      }
    }

    // Measured at 523 of 523, and still 523 of 523 after the id-precision
    // tiebreak and suffix folding went in -- which is the point of keeping it:
    // it is the only assertion here that would catch a ranking change that fixed
    // the chosen few by breaking the broad case.
    expect(found_in_top_five).to.be.at.least(
      Math.floor(described.length * 0.97)
    )
  })

  it('honours the result limit', () => {
    expect(
      search_columns({ query: 'yards', limit: 3 }).columns.length
    ).to.be.at.most(3)
  })
})
