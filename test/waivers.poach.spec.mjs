/* global describe before it */
import chai from 'chai'
import chaiHTTP from 'chai-http'
import MockDate from 'mockdate'

import server from '#api'
import knex from '#db'

import league from '#db/seeds/league.mjs'
import draftPicks from '#db/seeds/draft-picks.mjs'
import { constants } from '#libs-shared'
import { user1, user2, user3 } from './fixtures/token.mjs'
import { notLoggedIn, missing, invalid, error } from './utils/index.mjs'

process.env.NODE_ENV = 'test'

const expect = chai.expect
chai.should()
chai.use(chaiHTTP)
const { start } = constants.season

describe('API /waivers - poach', function () {
  let pid

  before(async function () {
    this.timeout(60 * 1000)

    MockDate.set(start.subtract('1', 'month').toISOString())

    await knex.seed.run()
    await league(knex)
    await draftPicks(knex)

    await knex('seasons')
      .update({
        free_agency_live_auction_start: start.subtract('1', 'week').unix()
      })
      .where('lid', 1)
  })

  it('submit poaching waiver for drafted player', async () => {
    MockDate.set(start.subtract('1', 'month').add('10', 'minute').toISOString())

    // make draft selection
    const leagueId = 1
    const players = await knex('player')
      .where('start', constants.season.year)
      .limit(1)

    const player = players[0]
    pid = player.pid
    await chai
      .request(server)
      .post('/api/leagues/1/draft')
      .set('Authorization', `Bearer ${user1}`)
      .send({
        teamId: 1,
        pid,
        pickId: 1
      })

    MockDate.set(
      start
        .subtract('1', 'month')
        .add('10', 'minute')
        .add('25', 'hours')
        .toISOString()
    )

    // submit poaching waiver
    const teamId = 2
    const res = await chai
      .request(server)
      .post('/api/leagues/1/waivers')
      .set('Authorization', `Bearer ${user2}`)
      .send({
        teamId,
        pid,
        type: constants.waivers.POACH,
        leagueId
      })

    res.should.have.status(200)
    // eslint-disable-next-line
    res.should.be.json

    res.body.tid.should.equal(teamId)
    res.body.userid.should.equal(2)
    res.body.lid.should.equal(leagueId)
    res.body.pid.should.equal(pid)
    res.body.po.should.equal(9999)
    const submitted = Math.round(Date.now() / 1000)
    res.body.submitted.should.equal(submitted)
    res.body.type.should.equal(constants.waivers.POACH)
    res.body.uid.should.be.a('number')
    res.body.uid.should.be.above(0)

    const waivers = await knex('waivers').select('*')

    expect(waivers.length).to.equal(1)

    const waiver = waivers[0]
    expect(waiver.uid).to.be.a('number')
    expect(waiver.uid).to.be.above(0)
    expect(waiver.userid).to.equal(2)
    expect(waiver.pid).to.equal(pid)
    expect(waiver.tid).to.equal(teamId)
    expect(waiver.lid).to.equal(leagueId)
    expect(waiver.submitted).to.equal(submitted)
    expect(waiver.bid).to.equal(0)
    expect(waiver.po).to.equal(9999)
    expect(waiver.type).to.equal(constants.waivers.POACH)
    expect(waiver.succ).to.equal(null)
    expect(waiver.reason).to.equal(null)
    expect(waiver.processed).to.equal(null)
    expect(waiver.cancelled).to.equal(null)

    res.body.uid.should.equal(waiver.uid)
  })

  // - poaching waiver for deactivated player
  // - poaching waiver for drafted player
  // - poaching waiver for added to practice squad player
  // - poaching waiver with full roster and release player

  describe('errors', function () {
    it('not logged in', async () => {
      const request = chai.request(server).post('/api/leagues/1/waivers')
      await notLoggedIn(request)
    })

    it('missing pid', async () => {
      const request = chai
        .request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          teamId: 2,
          type: constants.waivers.POACH,
          leagueId: 1
        })

      await missing(request, 'pid')
    })

    it('missing teamId', async () => {
      const request = chai
        .request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          pid,
          type: constants.waivers.POACH,
          leagueId: 1
        })

      await missing(request, 'teamId')
    })

    it('missing leagueId', async () => {
      const request = chai
        .request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          teamId: 2,
          pid,
          type: constants.waivers.POACH
        })

      await missing(request, 'leagueId')
    })

    it('missing type', async () => {
      const request = chai
        .request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          teamId: 2,
          pid,
          leagueId: 1
        })

      await missing(request, 'type')
    })

    it('invalid player', async () => {
      const request = chai
        .request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          teamId: 2,
          type: constants.waivers.POACH,
          pid: 'x',
          leagueId: 1
        })

      await invalid(request, 'player')
    })

    it('invalid release', async () => {
      const request = chai
        .request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          teamId: 2,
          type: constants.waivers.POACH,
          pid,
          release: 'x',
          leagueId: 1
        })

      await invalid(request, 'player')
    })

    it('invalid leagueId', async () => {
      const request = chai
        .request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          teamId: 2,
          type: constants.waivers.POACH,
          pid,
          leagueId: 2
        })

      await invalid(request, 'leagueId')
    })

    it('invalid bid', async () => {
      const request = chai
        .request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          teamId: 2,
          type: constants.waivers.POACH,
          bid: 'x',
          pid,
          leagueId: 1
        })

      await invalid(request, 'bid')
    })

    it('invalid type', async () => {
      const request = chai
        .request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          teamId: 2,
          type: 4,
          pid,
          leagueId: 1
        })

      await invalid(request, 'type')
    })

    it('invalid teamId', async () => {
      const request = chai
        .request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          teamId: 'x',
          type: constants.waivers.POACH,
          pid,
          leagueId: 1
        })

      await invalid(request, 'teamId')
    })

    it('teamId does not belong to userId', async () => {
      const request = chai
        .request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          teamId: 1,
          type: constants.waivers.POACH,
          pid,
          leagueId: 1
        })

      await invalid(request, 'teamId')
    })

    it('release player not on team', async () => {
      const players = await knex('player')
        .whereNot('current_nfl_team', 'INA')
        .limit(1)
      const releasePlayerId = players[0].pid

      const request = chai
        .request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user3}`)
        .send({
          teamId: 3,
          release: releasePlayerId,
          type: constants.waivers.POACH,
          pid,
          leagueId: 1
        })

      await invalid(request, 'release')
    })

    it('duplicate waivers', async () => {
      const request = chai
        .request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          teamId: 2,
          type: constants.waivers.POACH,
          pid,
          leagueId: 1
        })

      await error(request, 'duplicate waiver claim')
    })

    it('player not on a practice squad', async () => {
      const players = await knex('player')
        .whereNot('current_nfl_team', 'INA')
        .limit(1)
      const randomPlayerId = players[0].pid

      const request = chai
        .request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          teamId: 2,
          type: constants.waivers.POACH,
          pid: randomPlayerId,
          leagueId: 1
        })

      await error(request, 'player is not on waivers')
    })

    it('player is not on waivers - past 48 hours', async () => {
      const time = start
        .subtract('1', 'month')
        .add('2', 'day')
        .add('11', 'minute')
        .toISOString()
      MockDate.set(time)
      const request = chai
        .request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user3}`)
        .send({
          teamId: 3,
          type: constants.waivers.POACH,
          pid,
          leagueId: 1
        })

      await error(request, 'player is not on waivers')
    })

    it('claim exceeds roster limits', async () => {
      // TODO
    })

    it('claim exceeds available cap', async () => {
      // TODO
    })

    it('santuary period - free agency period', async () => {
      // TODO
    })

    it('santuary period - regular season start', async () => {
      // TODO
    })

    it('santuary period - first 24 hours on practice squad', async () => {
      // TODO
    })

    it('protected player prior to extension deadline', async () => {
      // TODO
    })
  })
})
