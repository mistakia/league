/* global describe before it */
process.env.NODE_ENV = 'test'

const chai = require('chai')
const chaiHTTP = require('chai-http')
const MockDate = require('mockdate')

const server = require('../api')
const knex = require('../db')

const league = require('../db/seeds/league')
const draftPicks = require('../db/seeds/draft-picks')
const { constants } = require('../common')
const { start } = constants.season
const { user1, user2 } = require('./fixtures/token')
const { notLoggedIn, missing, invalid } = require('./utils')

chai.should()
chai.use(chaiHTTP)

describe('API /waivers - cancel', function () {
  let playerId
  let waiverId

  before(async function () {
    this.timeout(60 * 1000)
    await knex.migrate.forceFreeMigrationsLock()
    await knex.migrate.rollback()
    await knex.migrate.latest()
    await knex.seed.run()

    MockDate.set(start.clone().subtract('1', 'month').toDate())

    await league(knex)
    await draftPicks(knex)
  })

  it('cancel poaching waiver', async () => {
    MockDate.set(
      start.clone().subtract('1', 'month').add('10', 'minute').toDate()
    )

    // make draft selection
    const leagueId = 1
    const players = await knex('player')
      .where('start', constants.season.year)
      .limit(1)
    const player = players[0]
    playerId = player.player
    await chai
      .request(server)
      .post('/api/leagues/1/draft')
      .set('Authorization', `Bearer ${user1}`)
      .send({
        teamId: 1,
        playerId,
        pickId: 1
      })

    // submit poaching waiver
    const teamId = 2
    const submitRes = await chai
      .request(server)
      .post('/api/leagues/1/waivers')
      .set('Authorization', `Bearer ${user2}`)
      .send({
        teamId,
        player: playerId,
        type: constants.waivers.POACH,
        leagueId
      })

    waiverId = submitRes.body.uid

    const res = await chai
      .request(server)
      .post(`/api/leagues/1/waivers/${waiverId}/cancel`)
      .set('Authorization', `Bearer ${user2}`)
      .send({
        teamId,
        leagueId
      })

    res.should.have.status(200)
    // eslint-disable-next-line
    res.should.be.json

    res.body.uid.should.equal(waiverId)
    res.body.tid.should.equal(teamId)
    res.body.lid.should.equal(leagueId)
    res.body.cancelled.should.equal(Math.round(Date.now() / 1000))
  })

  it('resubmit & cancel poach waiver', async () => {
    // submit poaching waiver
    const teamId = 2
    const leagueId = 1
    const submitRes = await chai
      .request(server)
      .post('/api/leagues/1/waivers')
      .set('Authorization', `Bearer ${user2}`)
      .send({
        teamId,
        player: playerId,
        type: constants.waivers.POACH,
        leagueId
      })

    const waiverId = submitRes.body.uid

    const res = await chai
      .request(server)
      .post(`/api/leagues/1/waivers/${waiverId}/cancel`)
      .set('Authorization', `Bearer ${user2}`)
      .send({
        teamId,
        leagueId
      })

    res.should.have.status(200)
    // eslint-disable-next-line
    res.should.be.json

    res.body.uid.should.equal(waiverId)
    res.body.tid.should.equal(teamId)
    res.body.lid.should.equal(leagueId)
    res.body.cancelled.should.equal(Math.round(Date.now() / 1000))
  })

  it('cancel free agency waiver', async () => {})

  it('resubmit & cancel free agency waiver', async () => {})

  describe('errors', function () {
    it('not logged in', async () => {
      const request = chai
        .request(server)
        .post(`/api/leagues/1/waivers/${waiverId}/cancel`)
      await notLoggedIn(request)
    })

    it('missing teamId', async () => {
      const request = chai
        .request(server)
        .post(`/api/leagues/1/waivers/${waiverId}/cancel`)
        .set('Authorization', `Bearer ${user2}`)
        .send({
          leagueId: 1
        })

      await missing(request, 'teamId')
    })

    it('missing leagueId', async () => {
      const request = chai
        .request(server)
        .post(`/api/leagues/1/waivers/${waiverId}/cancel`)
        .set('Authorization', `Bearer ${user2}`)
        .send({
          teamId: 2
        })

      await missing(request, 'leagueId')
    })

    it('invalid teamId', async () => {
      const request = chai
        .request(server)
        .post(`/api/leagues/1/waivers/${waiverId}/cancel`)
        .set('Authorization', `Bearer ${user2}`)
        .send({
          teamId: 'x',
          leagueId: 1
        })

      await invalid(request, 'teamId')
    })

    it('invalid leagueId', async () => {
      const request = chai
        .request(server)
        .post(`/api/leagues/1/waivers/${waiverId}/cancel`)
        .set('Authorization', `Bearer ${user2}`)
        .send({
          teamId: 2,
          leagueId: 'x'
        })

      await invalid(request, 'leagueId')
    })

    it('teamId does not belong to userId', async () => {
      const request = chai
        .request(server)
        .post(`/api/leagues/1/waivers/${waiverId}/cancel`)
        .set('Authorization', `Bearer ${user2}`)
        .send({
          teamId: 1,
          leagueId: 1
        })

      await invalid(request, 'teamId')
    })

    it('waiverId does not belong to teamId', async () => {
      const request = chai
        .request(server)
        .post(`/api/leagues/1/waivers/${waiverId}/cancel`)
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId: 1,
          leagueId: 1
        })

      await invalid(request, 'waiverId')
    })

    it('waiver already cancelled', async () => {
      const request = chai
        .request(server)
        .post(`/api/leagues/1/waivers/${waiverId}/cancel`)
        .set('Authorization', `Bearer ${user2}`)
        .send({
          teamId: 2,
          leagueId: 1
        })

      await invalid(request, 'waiverId')
    })
  })
})
