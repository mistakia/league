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
    const results = search_columns({
      query: 'betting market implied probability',
      limit: 5
    })
    const ids = results.map((result) => result.column_id)

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
    })

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
      expect(search_columns({ query }), query).to.deep.equal([])
    }
  })

  it('returns nothing for an empty or absent query', () => {
    expect(search_columns({ query: '' })).to.deep.equal([])
    expect(search_columns({})).to.deep.equal([])
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
      }).map((result) => result.column_id)
      if (ids.includes(column.column_id)) {
        found_in_top_five += 1
      }
    }

    // Measured at 523 of 523. Asserted slightly below so that adding a column
    // whose description duplicates another's is a review conversation and not a
    // red suite.
    expect(found_in_top_five).to.be.at.least(
      Math.floor(described.length * 0.97)
    )
  })

  it('honours the result limit', () => {
    expect(search_columns({ query: 'yards', limit: 3 }).length).to.be.at.most(3)
  })
})
