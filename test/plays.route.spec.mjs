/* global describe, it, before, after */

import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'

import server from '#api'

import { seed_nfl_games, clear_nfl_games } from './fixtures/seed-nfl-games.mjs'
import {
  seed_nfl_plays_current_week,
  clear_nfl_plays_current_week,
  seed_nfl_plays,
  clear_nfl_plays
} from './fixtures/seed-nfl-plays.mjs'
import { run_under_season_type } from './fixtures/postseason.mjs'

process.env.NODE_ENV = 'test'
chai.use(chai_http)
chai.should()
const expect = chai.expect

describe('API /plays postseason', function () {
  run_under_season_type(
    'POST',
    function () {
      before(async function () {
        this.timeout(60 * 1000)
        await clear_nfl_games({})
        await clear_nfl_plays_current_week()
        await clear_nfl_plays({})
        await seed_nfl_games({})
        await seed_nfl_plays_current_week({
          seas_type: 'POST',
          week: 1,
          plays_per_game: 2,
          game_count: 1
        })
        await seed_nfl_plays({
          year: 2020,
          seas_type: 'REG',
          week: 1,
          plays_per_game: 1,
          game_count: 1
        })
        await seed_nfl_plays({
          year: 2020,
          seas_type: 'POST',
          week: 1,
          plays_per_game: 1,
          game_count: 1
        })
        await seed_nfl_games({ year: 2020 })
      })

      after(async function () {
        await clear_nfl_plays_current_week()
        await clear_nfl_plays({})
        await clear_nfl_games({})
        await clear_nfl_games({ year: 2020 })
      })

      it('GET /plays without params returns current-week POST plays', async function () {
        const res = await chai_request.execute(server).get('/api/plays')
        res.should.have.status(200)
        res.body.should.be.an('array')
        expect(res.body.length).to.be.greaterThan(0)
        for (const play of res.body) {
          expect(play.year).to.be.a('number')
          expect(play.week).to.equal(1)
          // Under POST mockdate, the current-week query must filter to POST.
          // The seeded REG week 18 plays must not leak into this response.
        }
      })

      it('GET /plays/stats without params returns current-week POST stats', async function () {
        const res = await chai_request.execute(server).get('/api/plays/stats')
        res.should.have.status(200)
        res.body.should.be.an('array')
        expect(res.body.length).to.be.greaterThan(0)
      })

      it('GET /plays?year=2020&week=1 returns historical REG plays (back-compat)', async function () {
        const res = await chai_request
          .execute(server)
          .get('/api/plays?year=2020&week=1')
        res.should.have.status(200)
        res.body.should.be.an('array')
        expect(res.body.length).to.equal(1)
        for (const play of res.body) {
          expect(play.year).to.equal(2020)
        }
      })

      it('GET /plays?year=2020&week=1&seas_type=POST returns historical POST plays', async function () {
        const res = await chai_request
          .execute(server)
          .get('/api/plays?year=2020&week=1&seas_type=POST')
        res.should.have.status(200)
        res.body.should.be.an('array')
        expect(res.body.length).to.equal(1)
        for (const play of res.body) {
          expect(play.year).to.equal(2020)
        }
      })

      it('GET /plays/charted?years=2020 defaults to REG for back-compat', async function () {
        const res = await chai_request
          .execute(server)
          .get('/api/plays/charted?years=2020')
        res.should.have.status(200)
        res.body.should.be.an('array')
        expect(res.body.length).to.equal(1)
      })

      it('GET /plays/charted?years=2020&seas_types[]=REG&seas_types[]=POST returns both seas_types', async function () {
        const res = await chai_request
          .execute(server)
          .get(
            '/api/plays/charted?years=2020&seas_types[]=REG&seas_types[]=POST'
          )
        res.should.have.status(200)
        res.body.should.be.an('array')
        expect(res.body.length).to.equal(2)
      })
    },
    { seed_nfl_games: false }
  )
})
