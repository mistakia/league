/* global describe before it beforeEach */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'
import MockDate from 'mockdate'

import server from '#api'
import knex from '#db'

import user from '#db/seeds/user.mjs'
import { current_season } from '#constants'
import { user1, user2 } from './fixtures/token.mjs'
import {
  missing,
  invalid,
  error,
  notLoggedIn,
  forbidden
} from './utils/index.mjs'

process.env.NODE_ENV = 'test'
chai.should()
chai.use(chai_http)
const expect = chai.expect
const { regular_season_start } = current_season

describe('API /leagues/teams - delete', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
  })

  describe('delete', function () {
    beforeEach(async function () {
      MockDate.set(regular_season_start.subtract('2', 'month').toISOString())
      await user(knex)
    })

    it('remove team', async () => {
      const leagueId = 1
      const team = {
        year: current_season.year,
        name: 'Team1',
        abbrv: 'TM1',
        lid: leagueId
      }
      const insert_query = await knex('teams').insert(team).returning('uid')
      team.uid = insert_query[0].uid

      const roster = {
        tid: team.uid,
        lid: leagueId,
        week: current_season.week,
        year: current_season.year
      }

      await knex('rosters').insert(roster)

      const res = await chai_request
        .execute(server)
        .delete('/api/leagues/1/teams')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId: team.uid,
          leagueId
        })

      res.should.have.status(200)

      res.should.be.json

      res.body.rosters.should.equal(1)
      res.body.teams.should.equal(1)

      const teams = await knex('teams').where({
        lid: leagueId,
        year: current_season.year
      })
      const rosters = await knex('rosters').where({ lid: leagueId })
      expect(teams.length).to.equal(0)
      expect(rosters.length).to.equal(0)
    })
  })

  describe('errors', function () {
    beforeEach(async function () {
      MockDate.set(regular_season_start.subtract('2', 'month').toISOString())
      await user(knex)
    })

    it('not logged in', async () => {
      const request = chai_request.execute(server).delete('/api/leagues/teams')
      await notLoggedIn(request)
    })

    it('missing leagueId', async () => {
      const request = chai_request
        .execute(server)
        .delete('/api/leagues/1/teams')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId: 1
        })

      await missing(request, 'leagueId')
    })

    it('missing teamId', async () => {
      const request = chai_request
        .execute(server)
        .delete('/api/leagues/1/teams')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1
        })

      await missing(request, 'teamId')
    })

    it('invalid leagueId', async () => {
      const request = chai_request
        .execute(server)
        .delete('/api/leagues/2/teams')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId: 1,
          leagueId: 2
        })

      await invalid(request, 'leagueId')
    })

    it('user is not commish', async () => {
      const request = chai_request
        .execute(server)
        .delete('/api/leagues/1/teams')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          teamId: 1,
          leagueId: 1
        })

      await forbidden(request, 'Only league commissioner can')
    })

    it('can not remove user team', async () => {
      const rows = await knex('teams')
        .insert({
          lid: 1,
          year: current_season.year,
          name: 'Team1',
          abbrv: 'TM1',
          cap: 200,
          faab: 200
        })
        .returning('uid')

      const tid = rows[0].uid

      await knex('users_teams').insert({
        userid: 1,
        tid,
        year: current_season.year
      })

      const request = chai_request
        .execute(server)
        .delete('/api/leagues/1/teams')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId: tid,
          leagueId: 1
        })

      await error(request, 'can not remove user team')
    })
  })
})
