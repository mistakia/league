/* global describe before it */
import chai from 'chai'
import chaiHTTP from 'chai-http'
import MockDate from 'mockdate'

import server from '#api'
import knex from '#db'

import league from '#db/seeds/league.mjs'
import draftPicks from '#db/seeds/draft-picks.mjs'
import { constants } from '#common'
import { user1, user2 } from './fixtures/token.mjs'
import { notLoggedIn, missing, invalid } from './utils/index.mjs'

process.env.NODE_ENV = 'test'

chai.should()
chai.use(chaiHTTP)
const { start } = constants.season

describe('API /waivers - cancel', function () {
  let playerId
  let waiverId

  before(async function () {
    this.timeout(60 * 1000)
    await knex.migrate.forceFreeMigrationsLock()
    await knex.migrate.rollback()
    await knex.migrate.latest()
    await knex.seed.run()

    MockDate.set(start.subtract('1', 'month').toDate())

    await league(knex)
    await draftPicks(knex)

    await knex('leagues')
      .update({
        adate: start.subtract('1', 'week').unix()
      })
      .where('uid', 1)
  })

  it('cancel poaching waiver', async () => {
    MockDate.set(start.subtract('1', 'month').add('10', 'minute').toDate())

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

    MockDate.set(
      start
        .subtract('1', 'month')
        .add('10', 'minute')
        .add('25', 'hours')
        .toDate()
    )

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
