/* global describe before beforeEach it */
import chai from 'chai'
import MockDate from 'mockdate'

import knex from '#db'
import league from '#db/seeds/league.mjs'
import draft from '#db/seeds/draft.mjs'
import { constants } from '#common'
import { getRoster } from '#utils'
import run from '#scripts/generate-rosters.mjs'

process.env.NODE_ENV = 'test'

chai.should()
const { start } = constants.season
const expect = chai.expect

describe('SCRIPTS /rosters - generate weekly rosters', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.migrate.forceFreeMigrationsLock()
    await knex.migrate.rollback()
    await knex.migrate.latest()
    await knex.seed.run()
  })

  describe('process', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      MockDate.set(start.subtract('1', 'month').toDate())
      await league(knex)
    })

    it('generate rosters for week 1', async () => {
      await draft(knex)

      let error
      try {
        await run()
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      const teamId = 1
      const roster1 = await getRoster({ tid: teamId })
      const roster1Players = roster1.players.map(
        ({ lid, player, pos, slot, tid, type }) => ({
          lid,
          player,
          pos,
          slot,
          tid,
          type
        })
      )
      const roster2 = await getRoster({
        tid: teamId,
        week: constants.season.week + 1
      })
      const roster2Players = roster2.players.map(
        ({ lid, player, pos, slot, tid, type }) => ({
          lid,
          player,
          pos,
          slot,
          tid,
          type
        })
      )
      expect(roster1Players).to.eql(roster2Players)

      try {
        await run()
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      const roster3 = await getRoster({ tid: teamId })
      const roster3Players = roster3.players.map(
        ({ lid, player, pos, slot, tid, type }) => ({
          lid,
          player,
          pos,
          slot,
          tid,
          type
        })
      )
      const roster4 = await getRoster({
        tid: teamId,
        week: constants.season.week + 1
      })
      const roster4Players = roster4.players.map(
        ({ lid, player, pos, slot, tid, type }) => ({
          lid,
          player,
          pos,
          slot,
          tid,
          type
        })
      )
      expect(roster3Players).to.eql(roster4Players)
      expect(roster1Players).to.eql(roster3Players)
      expect(roster4.week).to.equal(constants.season.week + 1)
      expect(roster4.year).to.equal(constants.season.year)
    })

    it('generate rosters for next year', async () => {
      MockDate.set(start.add(17, 'week').toDate())
      await draft(knex)

      let error
      try {
        await run({ nextSeason: true })
      } catch (err) {
        console.log(err)
        error = err
      }

      expect(error).to.equal(undefined)

      const teamId = 1
      const roster1 = await getRoster({ tid: teamId })
      const roster1Players = roster1.players.map(
        ({ lid, player, pos, slot, tid, type }) => ({
          lid,
          player,
          pos,
          slot,
          tid,
          type
        })
      )
      const roster2 = await getRoster({
        tid: teamId,
        week: 0,
        year: constants.season.year + 1
      })
      const roster2Players = roster2.players.map(
        ({ lid, player, pos, slot, tid, type }) => ({
          lid,
          player,
          pos,
          slot,
          tid,
          type
        })
      )
      expect(roster1Players).to.eql(roster2Players)

      try {
        await run()
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      const roster3 = await getRoster({ tid: teamId })
      const roster3Players = roster3.players.map(
        ({ lid, player, pos, slot, tid, type }) => ({
          lid,
          player,
          pos,
          slot,
          tid,
          type
        })
      )
      const roster4 = await getRoster({
        tid: teamId,
        week: 0,
        year: constants.season.year + 1
      })
      const roster4Players = roster4.players.map(
        ({ lid, player, pos, slot, tid, type }) => ({
          lid,
          player,
          pos,
          slot,
          tid,
          type
        })
      )
      expect(roster3Players).to.eql(roster4Players)
      expect(roster1Players).to.eql(roster3Players)
      expect(roster4.week).to.equal(0)
      expect(roster4.year).to.equal(constants.season.year + 1)
    })
  })

  /* describe('errors', function () {
   *   beforeEach(async function () {
   *     this.timeout(60 * 1000)
   *     MockDate.set(start.subtract('1', 'month').toDate())
   *     await league(knex)
   *   })
   * }) */
})
