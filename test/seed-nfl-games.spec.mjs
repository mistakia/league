/* global describe, it, before, after */

import * as chai from 'chai'

import knex from '#db'
import { seed_nfl_games, clear_nfl_games } from './fixtures/seed-nfl-games.mjs'

const expect = chai.expect

describe('TEST FIXTURE seed_nfl_games', function () {
  const year = 2023

  before(async function () {
    await clear_nfl_games({ year })
    await seed_nfl_games({ year })
  })

  after(async function () {
    await clear_nfl_games({ year })
  })

  it('inserts REG rows spanning the era week range', async function () {
    const weeks = await knex('nfl_games')
      .where({ season_year: year, season_type: 'REG' })
      .distinct('week')
      .pluck('week')
    expect(weeks.sort((a, b) => a - b)).to.deep.equal(
      Array.from({ length: 18 }, (_, i) => i + 1)
    )
  })

  it('inserts POST rows spanning weeks 1-4', async function () {
    const weeks = await knex('nfl_games')
      .where({ season_year: year, season_type: 'POST' })
      .distinct('week')
      .pluck('week')
    expect(weeks.sort()).to.deep.equal([1, 2, 3, 4])
  })

  it('is idempotent on repeat invocation', async function () {
    const before_count = await knex('nfl_games')
      .where({ season_year: year })
      .count('* as c')
      .first()
    await seed_nfl_games({ year })
    const after_count = await knex('nfl_games')
      .where({ season_year: year })
      .count('* as c')
      .first()
    expect(after_count.c).to.equal(before_count.c)
  })
})
