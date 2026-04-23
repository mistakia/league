/* global describe, it, before, after */

import * as chai from 'chai'
import MockDate from 'mockdate'

import knex from '#db'
import league_seed from '#db/seeds/league.mjs'
import { current_season, waiver_types } from '#constants'
import get_top_practice_squad_waiver from '#libs-server/get-top-practice-squad-waiver.mjs'

import { seed_nfl_games, clear_nfl_games } from './fixtures/seed-nfl-games.mjs'
import { run_under_season_type } from './fixtures/postseason.mjs'
import { selectPlayer } from './utils/index.mjs'

process.env.NODE_ENV = 'test'

const expect = chai.expect

describe('LIBS-SERVER get_top_practice_squad_waiver postseason', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
  })

  run_under_season_type(
    'POST',
    function () {
      before(async function () {
        this.timeout(60 * 1000)
        await clear_nfl_games({})
        // Draft window is long past by POST; seed with draft_start two weeks ago
        // so the waiver-window early-return paths do not short-circuit.
        await league_seed(knex, {
          draft_start: Math.round(Date.now() / 1000) - 14 * 24 * 60 * 60
        })
        await seed_nfl_games({})
      })

      after(async function () {
        await clear_nfl_games({})
      })

      it('returns waiver row joined to current POST-week game (gate widened)', async function () {
        const lid = 1
        const player = await selectPlayer({
          random: false,
          rookie: false
        })
        await knex('player')
          .where({ pid: player.pid })
          .update({ current_nfl_team: 'KC' })

        await knex('waivers').insert({
          tid: 1,
          userid: 1,
          lid,
          pid: player.pid,
          po: 9999,
          submitted: Math.round(Date.now() / 1000),
          bid: 0,
          type: waiver_types.FREE_AGENCY_PRACTICE
        })

        const result = await get_top_practice_squad_waiver(lid)

        expect(result).to.be.an('object')
        expect(result.pid).to.equal(player.pid)
        // Gate widening contract: nfl_games.date and time_est are populated
        // for a player whose team has a game in the current POST week.
        // Null values here would mean the join returned no row (gate failure).
        expect(result.date, 'nfl_games.date populated').to.not.equal(null)
        expect(result.date, 'nfl_games.date populated').to.not.equal(undefined)
        expect(result.time_est, 'nfl_games.time_est populated').to.not.equal(
          null
        )
      })
    },
    { seed_nfl_games: false }
  )

  describe('REG waiver window (regression: early-return still fires)', function () {
    const { regular_season_start } = current_season

    before(async function () {
      this.timeout(60 * 1000)
      // regular_season_start is Tuesday (day()===2) — advance one week to
      // stay in REG while keeping day-of-week Tuesday, when isWaiverPeriod is true.
      const tuesday_reg = regular_season_start.add(1, 'week')
      MockDate.set(tuesday_reg.toISOString())
      await league_seed(knex, {
        draft_start: Math.round(Date.now() / 1000) - 14 * 24 * 60 * 60
      })
    })

    after(function () {
      MockDate.reset()
    })

    it('returns undefined during REG waiver period (line-41 early-return)', async function () {
      expect(current_season.isRegularSeason).to.equal(true)
      expect(current_season.isWaiverPeriod).to.equal(true)

      const lid = 1
      const player = await selectPlayer({ random: false, rookie: false })
      await knex('waivers').insert({
        tid: 1,
        userid: 1,
        lid,
        pid: player.pid,
        po: 9999,
        submitted: Math.round(Date.now() / 1000),
        bid: 0,
        type: waiver_types.FREE_AGENCY_PRACTICE
      })

      const result = await get_top_practice_squad_waiver(lid)
      expect(result).to.equal(undefined)
    })
  })
})
