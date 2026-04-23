/* global describe, it, before, after */

import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'

import server from '#api'

import { seed_nfl_games, clear_nfl_games } from './fixtures/seed-nfl-games.mjs'
import {
  seed_nfl_plays_current_week,
  clear_nfl_plays_current_week
} from './fixtures/seed-nfl-plays.mjs'
import { run_under_season_type } from './fixtures/postseason.mjs'
import { user1 } from './fixtures/token.mjs'

process.env.NODE_ENV = 'test'
chai.use(chai_http)
chai.should()
const expect = chai.expect

describe('API /scoreboard postseason', function () {
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

      it('defaults week to current POST nfl_seas_week and returns POST plays', async function () {
        const res = await chai_request
          .execute(server)
          .get('/api/scoreboard')
          .set('Authorization', `Bearer ${user1}`)
        res.should.have.status(200)
        res.body.should.be.an('array')
        expect(res.body.length).to.be.greaterThan(0)
        for (const play of res.body) {
          expect(play.week).to.equal(1)
          expect(play.playStats).to.be.an('array')
        }
      })
    },
    { seed_nfl_games: false }
  )
})
