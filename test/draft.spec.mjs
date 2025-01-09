/* global describe before it after */
import * as chai from 'chai'
import { default as chai_http, request as chai_request } from 'chai-http'
import MockDate from 'mockdate'

import server from '#api'
import knex from '#db'
import league from '#db/seeds/league.mjs'
import draftPicks from '#db/seeds/draft-picks.mjs'
import { constants } from '#libs-shared'
import {
  selectPlayer,
  checkRoster,
  checkLastTransaction,
  notLoggedIn,
  missing,
  invalid,
  error
} from './utils/index.mjs'
import { user1, user2, user3 } from './fixtures/token.mjs'

chai.use(chai_http)
const { start } = constants.season
const expect = chai.expect

describe('API /draft', function () {
  before(async function () {
    this.timeout(60 * 1000)

    MockDate.set(start.subtract('1', 'month').toISOString())

    await knex.seed.run()

    await league(knex)
    await draftPicks(knex)
  })

  after(() => {
    MockDate.reset()
  })

  it('make selection', async () => {
    MockDate.set(start.subtract('1', 'month').add('10', 'minute').toISOString())

    const leagueId = 1
    const teamId = 1
    const player = await selectPlayer({ rookie: true })
    const res = await chai_request.execute(server)
      .post('/api/leagues/1/draft')
      .set('Authorization', `Bearer ${user1}`)
      .send({
        teamId,
        pid: player.pid,
        pickId: 1
      })

    res.should.have.status(200)
    // eslint-disable-next-line
    res.should.be.json

    res.body.uid.should.equal(1)
    res.body.pid.should.equal(player.pid)
    res.body.lid.should.equal(leagueId)
    res.body.tid.should.equal(teamId)

    await checkRoster({ teamId, pid: player.pid, leagueId })
    await checkLastTransaction({
      leagueId,
      type: constants.transactions.DRAFT,
      value: 12,
      year: constants.season.year,
      pid: player.pid,
      teamId,
      userId: 1
    })

    const picks = await knex('draft').where({ uid: 1 })
    const pick = picks[0]

    expect(pick.pid).to.equal(player.pid)
  })

  // - draft a rookie with a traded pick
  // - draft a rookie after first 24hrs
  // - draft a rookie before the pick before you
  // - draft a rookie with no practice squad space (space on active roster)

  describe('errors', function () {
    it('not logged in', async () => {
      const request = chai_request.execute(server).post('/api/leagues/1/draft')
      await notLoggedIn(request)
    })

    it('missing teamId', async () => {
      const request = chai_request.execute(server)
        .post('/api/leagues/1/draft')
        .set('Authorization', `Bearer ${user2}`)
        .send({ pid: 'xx', pickId: 1 })

      await missing(request, 'teamId')
    })

    it('missing pid', async () => {
      const request = chai_request.execute(server)
        .post('/api/leagues/1/draft')
        .set('Authorization', `Bearer ${user2}`)
        .send({ teamId: 2, pickId: 1 })

      await missing(request, 'pid')
    })

    it('missing pickId', async () => {
      const request = chai_request.execute(server)
        .post('/api/leagues/1/draft')
        .set('Authorization', `Bearer ${user2}`)
        .send({ pid: 'xx', teamId: 2 })

      await missing(request, 'pickId')
    })

    it('invalid teamId', async () => {
      const request = chai_request.execute(server)
        .post('/api/leagues/1/draft')
        .set('Authorization', `Bearer ${user2}`)
        .send({ pid: 'xx', pickId: 2, teamId: 'a' })

      await invalid(request, 'teamId')
    })

    it('invalid pid - does not exist', async () => {
      MockDate.set(start.subtract('1', 'month').add('1', 'day').toISOString())
      const request = chai_request.execute(server)
        .post('/api/leagues/1/draft')
        .set('Authorization', `Bearer ${user2}`)
        .send({ pid: 'xx', pickId: 2, teamId: 2 })

      await invalid(request, 'pid')
    })

    it('invalid pid - position', async () => {
      // TODO
    })

    it('invalid leagueId', async () => {
      const request = chai_request.execute(server)
        .post('/api/leagues/0/draft')
        .set('Authorization', `Bearer ${user2}`)
        .send({ pid: 'xx', pickId: 2, teamId: 2 })

      await invalid(request, 'leagueId')
    })

    it('invalid pid - not a rookie', async () => {
      const players = await knex('player')
        .where('start', constants.season.year - 1)
        .limit(1)
      const player = players[0]
      const request = chai_request.execute(server)
        .post('/api/leagues/1/draft')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          teamId: 2,
          pid: player.pid,
          pickId: 2
        })

      await invalid(request, 'pid')
    })

    it('teamId does not belong to userId', async () => {
      const request = chai_request.execute(server)
        .post('/api/leagues/1/draft')
        .set('Authorization', `Bearer ${user3}`)
        .send({ pid: 'xx', pickId: 2, teamId: 2 })

      await invalid(request, 'teamId')
    })

    it('draft hasnt started', async () => {
      MockDate.set(
        start.subtract('1', 'month').subtract('1', 'day').toISOString()
      )
      const request = chai_request.execute(server)
        .post('/api/leagues/1/draft')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          teamId: 2,
          pid: 'xx',
          pickId: 2
        })

      await error(request, 'draft has not started')
    })

    it('pick not on clock', async () => {
      const player = await selectPlayer({ rookie: true })
      MockDate.set(
        start.subtract('1', 'month').add('1', 'minute').toISOString()
      )
      const request = chai_request.execute(server)
        .post('/api/leagues/1/draft')
        .set('Authorization', `Bearer ${user3}`)
        .send({
          teamId: 3,
          pid: player.pid,
          pickId: 3
        })

      await error(request, 'draft pick not on the clock')
    })

    it('pick is already selected', async () => {
      MockDate.set(
        start.subtract('1', 'month').add('1', 'minute').toISOString()
      )
      const request = chai_request.execute(server)
        .post('/api/leagues/1/draft')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId: 1,
          pid: 'xx',
          pickId: 1
        })

      await invalid(request, 'pickId')
    })

    it('pickId does not belong to teamId', async () => {
      MockDate.set(
        start.subtract('1', 'month').add('1', 'minute').toISOString()
      )
      const request = chai_request.execute(server)
        .post('/api/leagues/1/draft')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId: 1,
          pid: 'xx',
          pickId: 2
        })

      await invalid(request, 'pickId')
    })

    it('player rostered', async () => {
      const picks = await knex('draft').where({ uid: 1 }).limit(1)
      const { pid } = picks[0]
      MockDate.set(start.subtract('1', 'month').add('2', 'day').toISOString())
      const request = chai_request.execute(server)
        .post('/api/leagues/1/draft')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          teamId: 2,
          pid,
          pickId: 2
        })

      await error(request, 'player rostered')
    })

    it('selection after draft has ended', async () => {
      MockDate.set(start.add('1', 'month').add('1', 'day').toISOString())
      const player = await selectPlayer({ rookie: true })
      const request = chai_request.execute(server)
        .post('/api/leagues/1/draft')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          teamId: 2,
          pid: player.pid,
          pickId: 2
        })

      await error(request, 'draft has ended')
    })

    it('exceeds roster limit', async () => {
      // TODO
    })

    it('exceeds roster cap', async () => {
      // TODO
    })

    it('pick expired', async () => {
      // TODO
    })

    it('reserve violation', async () => {
      // TODO
    })
  })
})
