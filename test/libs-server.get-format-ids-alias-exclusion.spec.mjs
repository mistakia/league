/* global describe it before */

import * as chai from 'chai'

import knex from '#db'
import { named_scoring_formats, named_league_formats } from '#libs-shared'
import { get_format_ids } from '#libs-server/stats-pipeline.mjs'

chai.should()
const expect = chai.expect

// The generator collapses every catalog entry whose unique tuple is deep-equal
// onto one canonical id, so a catalog KEY is a source slug and only a catalog
// `id` is addressable in league_scoring_formats / league_formats. A consumer
// that iterates the keys hands an alias slug to a lookup that has no row for
// it. That is what broke finalize-game for every game between the 2026-05-29
// format-id migration and its repair: `ppr_lower_turnover` is an alias of
// `draftkings`, and the resulting throw aborted the whole process_formats step
// -- taking every later scoring format and every league format with it.
const scoring_aliases = Object.entries(named_scoring_formats)
  .filter(([key, format]) => key !== format.id)
  .map(([key]) => key)

const league_aliases = Object.entries(named_league_formats)
  .filter(([key, format]) => key !== format.id)
  .map(([key]) => key)

describe('LIBS-SERVER get_format_ids alias exclusion', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
  })

  // Negative control: the exclusion assertions below are vacuous unless the
  // catalog actually carries an alias for them to exclude.
  it('the catalog carries at least one alias slug', () => {
    expect(scoring_aliases.length + league_aliases.length).to.be.at.least(1)
  })

  it('returns no alias slug, only canonical ids', async () => {
    const { scoring_format_ids, league_format_ids } = await get_format_ids()

    for (const alias of scoring_aliases) {
      expect(
        scoring_format_ids.includes(alias),
        `scoring alias ${alias} has no league_scoring_formats row and must not be returned`
      ).to.equal(false)
    }

    for (const alias of league_aliases) {
      expect(
        league_format_ids.includes(alias),
        `league alias ${alias} has no league_formats row and must not be returned`
      ).to.equal(false)
    }
  })

  it('still returns the canonical id every alias collapses onto', async () => {
    const { scoring_format_ids, league_format_ids } = await get_format_ids()

    for (const alias of scoring_aliases) {
      expect(scoring_format_ids).to.include(named_scoring_formats[alias].id)
    }

    for (const alias of league_aliases) {
      expect(league_format_ids).to.include(named_league_formats[alias].id)
    }
  })
})
