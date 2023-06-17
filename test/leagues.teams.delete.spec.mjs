/* global describe before it beforeEach */
import chai from 'chai'
import chaiHTTP from 'chai-http'
import MockDate from 'mockdate'

import server from '#api'
import knex from '#db'

import user from '#db/seeds/user.mjs'
import { constants } from '#libs-shared'
import { user1, user2 } from './fixtures/token.mjs'
import { missing, invalid, error, notLoggedIn } from './utils/index.mjs'

process.env.NODE_ENV = 'test'
chai.should()
chai.use(chaiHTTP)
const expect = chai.expect
const { start } = constants.season

describe('API /leagues/teams - delete', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.migrate.forceFreeMigrationsLock()
    await knex.migrate.rollback()
    await knex.migrate.latest()
    await knex.seed.run()
  })

  describe('delete', function () {
    beforeEach(async function () {
      MockDate.set(start.subtract('2', 'month').toISOString())
      await user(knex)
    })

    it('remove team', async () => {
      const leagueId = 1
      const team = {
        year: constants.season.year,
        name: 'Team1',
        abbrv: 'TM1',
        lid: leagueId
      }
      const rows = await knex('teams').insert(team)
      team.uid = rows[0]

      const roster = {
        tid: team.uid,
        lid: leagueId,
        week: constants.season.week,
        year: constants.season.year
      }

      await knex('rosters').insert(roster)

      const res = await chai
        .request(server)
        .delete('/api/leagues/1/teams')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId: team.uid,
          leagueId
        })

      res.should.have.status(200)
      // eslint-disable-next-line
      res.should.be.json

      res.body.rosters.should.equal(1)
      res.body.teams.should.equal(1)

      const teams = await knex('teams').where({
        lid: leagueId,
        year: constants.season.year
      })
      const rosters = await knex('rosters').where({ lid: leagueId })
      expect(teams.length).to.equal(0)
      expect(rosters.length).to.equal(0)
    })
  })

  describe('errors', function () {
    beforeEach(async function () {
      MockDate.set(start.subtract('2', 'month').toISOString())
      await user(knex)
    })

    it('not logged in', async () => {
      const request = chai.request(server).delete('/api/leagues/teams')
      await notLoggedIn(request)
    })

    it('missing leagueId', async () => {
      const request = chai
        .request(server)
        .delete('/api/leagues/1/teams')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId: 1
        })

      await missing(request, 'leagueId')
    })

    it('missing teamId', async () => {
      const request = chai
        .request(server)
        .delete('/api/leagues/1/teams')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1
        })

      await missing(request, 'teamId')
    })

    it('invalid leagueId', async () => {
      const request = chai
        .request(server)
        .delete('/api/leagues/2/teams')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId: 1,
          leagueId: 2
        })

      await invalid(request, 'leagueId')
    })

    it('user is not commish', async () => {
      const request = chai
        .request(server)
        .delete('/api/leagues/1/teams')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          teamId: 1,
          leagueId: 1
        })

      await invalid(request, 'leagueId')
    })

    it('can not remove user team', async () => {
      const rows = await knex('teams').insert({
        lid: 1,
        year: constants.season.year,
        name: 'Team1',
        abbrv: 'TM1',
        cap: 200,
        faab: 200
      })

      await knex('users_teams').insert({
        userid: 1,
        tid: rows[0]
      })

      const request = chai
        .request(server)
        .delete('/api/leagues/1/teams')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId: 2,
          leagueId: 1
        })

      await error(request, 'can not remove user team')
    })
  })
})
