/* global describe, it, before, after, afterEach */

import * as chai from 'chai'

import knex from '#db'
import { current_season } from '#constants'
import { build_scoreboard_current_plays_query } from '#api/sockets/scoreboard.mjs'

import { seed_nfl_games, clear_nfl_games } from './fixtures/seed-nfl-games.mjs'
import {
  seed_nfl_plays_current_week,
  clear_nfl_plays_current_week
} from './fixtures/seed-nfl-plays.mjs'
import { run_under_season_type } from './fixtures/postseason.mjs'

const expect = chai.expect

describe('SOCKET /scoreboard postseason poll query', function () {
  run_under_season_type(
    'POST',
    function () {
      before(async function () {
        this.timeout(60 * 1000)
        await clear_nfl_plays_current_week()
        await clear_nfl_games({})
        await seed_nfl_games({})
        await seed_nfl_plays_current_week({
          seas_type: 'POST',
          week: 1,
          plays_per_game: 2,
          game_count: 1
        })
      })

      afterEach(async function () {
        // Clear + reseed minimal POST to isolate between tests that add REG
        // plays inline. Cheap: each seed is <5 rows.
        await clear_nfl_plays_current_week()
        await seed_nfl_plays_current_week({
          seas_type: 'POST',
          week: 1,
          plays_per_game: 2,
          game_count: 1
        })
      })

      after(async function () {
        await clear_nfl_plays_current_week()
        await clear_nfl_games({})
      })

      it('returns current POST-week plays', async function () {
        const plays = await build_scoreboard_current_plays_query({
          db: knex,
          updated: 0
        })
        expect(plays.length).to.be.greaterThan(0)
        for (const play of plays) {
          expect(play.year).to.equal(current_season.year)
          expect(play.week).to.equal(current_season.nfl_seas_week)
        }
      })

      it('drops REG-seeded plays under POST (seas_type filter)', async function () {
        await seed_nfl_plays_current_week({
          seas_type: 'REG',
          week: 18,
          plays_per_game: 1,
          game_count: 1
        })
        const plays = await build_scoreboard_current_plays_query({
          db: knex,
          updated: 0
        })
        for (const play of plays) {
          expect(play.week).to.equal(current_season.nfl_seas_week)
        }
        // Total rows must still be the POST-only count, not POST + REG.
        expect(plays.length).to.equal(2)
      })
    },
    { seed_nfl_games: false }
  )
})
