/* global describe, it, before, after */

import * as chai from 'chai'

import knex from '#db'
import { current_season } from '#constants'
import { getPlayByPlayQuery } from '#libs-server'

import { seed_nfl_games, clear_nfl_games } from './fixtures/seed-nfl-games.mjs'
import {
  seed_nfl_plays_current_week,
  clear_nfl_plays_current_week
} from './fixtures/seed-nfl-plays.mjs'
import { run_under_season_type } from './fixtures/postseason.mjs'

const expect = chai.expect

// The scoreboard socket's poll() builds the query via getPlayByPlayQuery and
// filters on current_season.{year, nfl_seas_week, nfl_seas_type}. We exercise
// that exact filter shape here rather than driving the WebSocket.
const build_socket_query = () =>
  getPlayByPlayQuery(knex)
    .where('nfl_plays_current_week.year', current_season.year)
    .where('nfl_plays_current_week.week', current_season.nfl_seas_week)
    .where('nfl_plays_current_week.seas_type', current_season.nfl_seas_type)
    .where('updated', '>', 0)

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

      after(async function () {
        await clear_nfl_plays_current_week()
        await clear_nfl_games({})
      })

      it('socket poll query returns current POST-week plays', async function () {
        const plays = await build_socket_query()
        expect(plays.length).to.be.greaterThan(0)
        for (const play of plays) {
          expect(play.year).to.equal(current_season.year)
          expect(play.week).to.equal(current_season.nfl_seas_week)
        }
      })

      it('socket poll query drops REG-seeded plays under POST', async function () {
        await seed_nfl_plays_current_week({
          seas_type: 'REG',
          week: 18,
          plays_per_game: 1,
          game_count: 1
        })
        const plays = await build_socket_query()
        for (const play of plays) {
          expect(play.week).to.equal(current_season.nfl_seas_week)
        }
      })
    },
    { seed_nfl_games: false }
  )
})
