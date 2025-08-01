/* global describe before it beforeEach */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'
import MockDate from 'mockdate'

import server from '#api'
import knex from '#db'

import user from '#db/seeds/user.mjs'
import { constants } from '#libs-shared'
import { user1, user2 } from './fixtures/token.mjs'
import { missing, invalid, error, notLoggedIn } from './utils/index.mjs'

process.env.NODE_ENV = 'test'
chai.should()
chai.use(chai_http)
const expect = chai.expect
const { regular_season_start } = constants.season

describe('API /leagues/teams - add', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
  })

  describe('post', function () {
    beforeEach(async function () {
      MockDate.set(regular_season_start.subtract('2', 'month').toISOString())
      await user(knex)
    })

    it('add team', async () => {
      const leagueId = 1
      const res = await chai_request
        .execute(server)
        .post('/api/leagues/1/teams')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId
        })

      res.should.have.status(200)

      res.should.be.json

      res.body.roster.tid.should.equal(1)
      res.body.roster.lid.should.equal(leagueId)
      res.body.roster.week.should.equal(constants.season.week)
      res.body.roster.year.should.equal(constants.season.year)
      res.body.team.name.should.equal('Team1')
      res.body.team.abbrv.should.equal('TM1')
      res.body.team.waiver_order.should.equal(1)
      res.body.team.draft_order.should.equal(1)
      res.body.team.cap.should.equal(200)
      res.body.team.faab.should.equal(200)
      res.body.team.lid.should.equal(leagueId)

      const teams = await knex('teams').where({
        lid: leagueId,
        year: constants.season.year
      })
      expect(teams[0].lid).to.equal(leagueId)
      expect(teams[0].name).to.equal('Team1')
      expect(teams[0].abbrv).to.equal('TM1')
    })
  })

  describe('errors', function () {
    beforeEach(async function () {
      MockDate.set(regular_season_start.subtract('2', 'month').toISOString())
      await user(knex)
    })

    it('not logged in', async () => {
      const request = chai_request.execute(server).post('/api/leagues/1/teams')
      await notLoggedIn(request)
    })

    it('missing leagueId', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/leagues/1/teams')
        .set('Authorization', `Bearer ${user1}`)
        .send()

      await missing(request, 'leagueId')
    })

    it('invalid leagueId', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/leagues/2/teams')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 2
        })

      await invalid(request, 'leagueId')
    })

    it('user is not commish', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/leagues/1/teams')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          leagueId: 1
        })

      await invalid(request, 'leagueId')
    })

    it('exceeds league team limit', async () => {
      for (let i = 1; i <= 12; i++) {
        await knex('teams').insert({
          year: constants.season.year,
          uid: i,
          lid: 1,
          waiver_order: i,
          draft_order: i,
          name: `Team${i}`,
          abbrv: `TM${i}`
        })
      }

      const leagueId = 1
      const request = chai_request
        .execute(server)
        .post('/api/leagues/1/teams')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId
        })

      await error(request, 'league is full')
    })
  })
})
