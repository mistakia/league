/* global describe before beforeEach it */
import chai from 'chai'
import chaiHTTP from 'chai-http'
import knex from '#db'
import MockDate from 'mockdate'

import league from '#db/seeds/league.mjs'
import { constants } from '#libs-shared'

process.env.NODE_ENV = 'test'
const { start } = constants.season
chai.use(chaiHTTP)

describe('API /poaches - update', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.migrate.forceFreeMigrationsLock()
    await knex.migrate.rollback()
    await knex.migrate.latest()
    await knex.seed.run()
  })

  describe('errors', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      MockDate.set(start.subtract('2', 'month').toISOString())
      await league(knex)
    })

    it('release player used in another poach', async () => {
      // TODO
    })
  })
  // errors

  // - not logged in
  // - invalid userId
  // - invalid leagueId
  // - invalid teamId
  // - invalid player
  // - invalid release
  // - teamId doesn't belong to userId
  // - release player not on team
  // - exceeds roster space
  // - exceeds salary space
  // - release player involved in different poach
})
