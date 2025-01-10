/* global describe before it */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'

import server from '#api'
import knex from '#db'
import league from '#db/seeds/league.mjs'
import { user1, user2 } from './fixtures/token.mjs'
import { notLoggedIn, missing, invalid } from './utils/index.mjs'
import { constants } from '#libs-shared'

process.env.NODE_ENV = 'test'

chai.should()
chai.use(chai_http)
const expect = chai.expect

describe('API /teams - update', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()

    await league(knex)
  })

  describe('put', function () {
    it('teamtext', async () => {
      const value = false
      const res = await chai_request
        .execute(server)
        .put('/api/teams/1')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          field: 'teamtext',
          value
        })

      res.should.have.status(200)
      // eslint-disable-next-line
      res.should.be.json

      // verify database change
      res.body.value.should.equal(value)
      const teams = await knex('users_teams')
        .where({ tid: 1, userid: 1, year: constants.season.year })
        .limit(1)
      const team = teams[0]

      expect(team.teamtext).to.equal(value)
    })

    it('teamvoice', async () => {
      const value = false
      const res = await chai_request
        .execute(server)
        .put('/api/teams/1')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          field: 'teamvoice',
          value
        })

      res.should.have.status(200)
      // eslint-disable-next-line
      res.should.be.json

      // verify database change
      res.body.value.should.equal(value)
      const teams = await knex('users_teams')
        .where({ tid: 1, userid: 1, year: constants.season.year })
        .limit(1)
      const team = teams[0]

      expect(team.teamvoice).to.equal(value)
    })

    it('name', async () => {
      const value = 'TEST TEAM'
      const res = await chai_request
        .execute(server)
        .put('/api/teams/1')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          field: 'name',
          value
        })

      res.should.have.status(200)
      // eslint-disable-next-line
      res.should.be.json

      // verify database change
      res.body.value.should.equal(value)
      const team = await knex('teams')
        .where({ uid: 1, year: constants.season.year })
        .first()

      expect(team.name).to.equal(value)
    })

    it('name - commish', async () => {
      const value = 'TEST TEAM 2'
      const res = await chai_request
        .execute(server)
        .put('/api/teams/2')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          field: 'name',
          value
        })

      res.should.have.status(200)
      // eslint-disable-next-line
      res.should.be.json

      // verify database change
      res.body.value.should.equal(value)
      const team = await knex('teams')
        .where({ uid: 2, year: constants.season.year })
        .first()

      expect(team.name).to.equal(value)
    })

    it('image', async () => {
      const value = 'https://example.com/image.png'
      const res = await chai_request
        .execute(server)
        .put('/api/teams/1')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          field: 'image',
          value
        })

      res.should.have.status(200)
      // eslint-disable-next-line
      res.should.be.json

      // verify database change
      res.body.value.should.equal(value)
      const team = await knex('teams')
        .where({ uid: 1, year: constants.season.year })
        .first()

      expect(team.image).to.equal(value)
    })

    it('abbrv', async () => {
      const value = 'TT'
      const res = await chai_request
        .execute(server)
        .put('/api/teams/1')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          field: 'abbrv',
          value
        })

      res.should.have.status(200)
      // eslint-disable-next-line
      res.should.be.json

      // verify database change
      res.body.value.should.equal(value)
      const team = await knex('teams')
        .where({ uid: 1, year: constants.season.year })
        .first()

      expect(team.abbrv).to.equal(value)
    })

    it('pc', async () => {
      // TODO
    })

    it('ac', async () => {
      // TODO
    })
  })

  describe('errors', function () {
    it('not logged in', async () => {
      const request = chai_request.execute(server).put('/api/teams/1')
      await notLoggedIn(request)
    })

    it('missing value', async () => {
      const request = chai_request
        .execute(server)
        .put('/api/teams/1')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          field: 'name'
        })
      await missing(request, 'value')
    })

    it('missing field', async () => {
      const request = chai_request
        .execute(server)
        .put('/api/teams/1')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          value: 'test'
        })
      await missing(request, 'field')
    })

    it('invalid field - does not exist', async () => {
      const request = chai_request
        .execute(server)
        .put('/api/teams/1')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          field: 'name1',
          value: 'test'
        })
      await invalid(request, 'field')
    })

    it('teamId does not belong to userId', async () => {
      const request = chai_request
        .execute(server)
        .put('/api/teams/1')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          field: 'name',
          value: 'test'
        })
      await invalid(request, 'teamId')
    })

    it('invalid pc - length', async () => {
      // TODO
    })

    it('invalid ac - length', async () => {
      // TODO
    })

    it('image is not a url', async () => {
      // TODO
    })

    it('name is too long', async () => {
      // TODO
    })

    it('abbrv is too long', async () => {
      // TODO
    })

    it('invalid teamtext', async () => {
      // TODO
    })

    it('invalid teamvoice', async () => {
      // TODO
    })

    it('invalid leaguetext', async () => {
      // TODO
    })
  })
})
