/* global describe, before, it */
import * as chai from 'chai'

import knex from '#db'
import { get_season_playoff_weeks, createLeague } from '#libs-server'
import { current_season } from '#constants'

process.env.NODE_ENV = 'test'
chai.should()
const expect = chai.expect

describe('LIBS-SERVER get_season_playoff_weeks', function () {
  const test_lid = 999
  const test_year = current_season.year

  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()

    // Create test league using createLeague (handles all required fields)
    await createLeague({
      lid: test_lid,
      commishid: 1,
      name: 'Test League'
    })

    // Update season with playoff configuration
    await knex('seasons')
      .where({ lid: test_lid, year: test_year })
      .update({
        wildcard_round: 15,
        championship_round: [16, 17]
      })
  })

  it('should return playoff weeks from seasons table', async () => {
    const result = await get_season_playoff_weeks({
      lid: test_lid,
      year: test_year
    })

    expect(result.wildcard_week).to.equal(15)
    expect(result.championship_weeks).to.deep.equal([16, 17])
    expect(result.final_week).to.equal(17)
    expect(result.playoff_weeks).to.deep.equal([15, 16, 17])
  })

  it('should return null values for non-existent season', async () => {
    const result = await get_season_playoff_weeks({ lid: test_lid, year: 1999 })

    expect(result.wildcard_week).to.be.null
    expect(result.championship_weeks).to.deep.equal([])
    expect(result.final_week).to.be.null
    expect(result.playoff_weeks).to.deep.equal([])
  })

  it('should handle season without wildcard round', async () => {
    // Update the existing season to remove wildcard round
    await knex('seasons')
      .where({ lid: test_lid, year: test_year })
      .update({
        wildcard_round: null,
        championship_round: [16, 17]
      })

    const result = await get_season_playoff_weeks({
      lid: test_lid,
      year: test_year
    })

    expect(result.wildcard_week).to.be.null
    expect(result.championship_weeks).to.deep.equal([16, 17])
    expect(result.final_week).to.equal(17)
    expect(result.playoff_weeks).to.deep.equal([16, 17])
  })

  it('should handle single championship week (single-element array)', async () => {
    // Update the existing season with single championship week as array
    await knex('seasons')
      .where({ lid: test_lid, year: test_year })
      .update({
        wildcard_round: 15,
        championship_round: [16] // Single-element array
      })

    const result = await get_season_playoff_weeks({
      lid: test_lid,
      year: test_year
    })

    expect(result.wildcard_week).to.equal(15)
    expect(result.championship_weeks).to.deep.equal([16])
    expect(result.final_week).to.equal(16)
    expect(result.playoff_weeks).to.deep.equal([15, 16])
  })
})

describe('SCRIPTS finalize_season', function () {
  // Note: Full integration tests for finalize_season require extensive test data
  // setup (teams, rosters, player gamelogs, matchups, playoffs). These tests
  // verify the basic structure and error handling.

  const test_lid = 998
  const test_year = current_season.year

  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()

    // Create minimal test league using createLeague (handles all required fields)
    await createLeague({
      lid: test_lid,
      commishid: 1,
      name: 'Test League No Playoffs'
    })

    // Update season to have no playoff configuration
    await knex('seasons').where({ lid: test_lid, year: test_year }).update({
      wildcard_round: null,
      championship_round: null
    })
  })

  it('should handle missing playoff configuration gracefully', async () => {
    const finalize_season = (await import('#scripts/finalize-season.mjs'))
      .default

    const result = await finalize_season({ lid: test_lid, year: test_year })

    expect(result.success).to.be.false
    expect(result.error).to.equal('No playoff configuration found')
  })
})
