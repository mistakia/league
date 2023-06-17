/* global describe before it beforeEach */
import chai from 'chai'
import chaiHTTP from 'chai-http'
import MockDate from 'mockdate'

import knex from '#db'

import league from '#db/seeds/league.mjs'
import { constants } from '#libs-shared'

process.env.NODE_ENV = 'test'

const { start } = constants.season
chai.should()
chai.use(chaiHTTP)

describe('API /waivers -report', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.migrate.forceFreeMigrationsLock()
    await knex.migrate.rollback()
    await knex.migrate.latest()
    await knex.seed.run()
  })

  describe('get', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      MockDate.set(start.subtract('2', 'month').toISOString())
      await league(knex)
    })

    // TODO - make sure you dont see certain failed waivers from other teams

    it('active roster waiver report', async () => {
      // TODO
    })

    it('practice waiver report', async () => {
      // TODO
    })

    it('poach waiver report', async () => {
      // TODO
    })
  })

  describe('errors', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      MockDate.set(start.subtract('2', 'month').toISOString())
      await league(knex)
    })

    it('missing processed', async () => {
      // TODO
    })

    it('missing type', async () => {
      // TODO
    })

    it('missing teamId', async () => {
      // TODO
    })

    it('invalid type', async () => {
      // TODO
    })

    it('invalid teamId', async () => {
      // TODO
    })

    it('userId does not belong to teamId', async () => {
      // TODO
    })
  })
})
