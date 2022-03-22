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
const { user1, user2, user3 } = require('./fixtures/token')
const { notLoggedIn, missing, invalid, error } = require('./utils')

const expect = chai.expect
chai.should()
chai.use(chaiHTTP)

describe('API /waivers - poach', function () {
  let playerId

  before(async function () {
    this.timeout(60 * 1000)
    await knex.migrate.forceFreeMigrationsLock()
    await knex.migrate.rollback()
    await knex.migrate.latest()

    MockDate.set(start.subtract('1', 'month').toDate())

    await knex.seed.run()
    await league(knex)
    await draftPicks(knex)

    await knex('leagues')
      .update({
        adate: start.subtract('1', 'week').unix()
      })
      .where('uid', 1)
  })

  it('submit poaching waiver for drafted player', async () => {
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
    const res = await chai
      .request(server)
      .post('/api/leagues/1/waivers')
      .set('Authorization', `Bearer ${user2}`)
      .send({
        teamId,
        player: playerId,
        type: constants.waivers.POACH,
        leagueId
      })

    res.should.have.status(200)
    // eslint-disable-next-line
    res.should.be.json

    res.body.tid.should.equal(teamId)
    res.body.userid.should.equal(2)
    res.body.lid.should.equal(leagueId)
    res.body.player.should.equal(playerId)
    res.body.po.should.equal(9999)
    const submitted = Math.round(Date.now() / 1000)
    res.body.submitted.should.equal(submitted)
    res.body.type.should.equal(constants.waivers.POACH)
    res.body.uid.should.equal(1)

    const waivers = await knex('waivers').select('*')

    expect(waivers.length).to.equal(1)

    const waiver = waivers[0]
    expect(waiver.uid).to.equal(1)
    expect(waiver.userid).to.equal(2)
    expect(waiver.player).to.equal(playerId)
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

    it('missing player', async () => {
      const request = chai
        .request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          teamId: 2,
          type: constants.waivers.POACH,
          leagueId: 1
        })

      await missing(request, 'player')
    })

    it('missing teamId', async () => {
      const request = chai
        .request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          player: playerId,
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
          player: playerId,
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
          player: playerId,
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
          player: 'x',
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
          player: playerId,
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
          player: playerId,
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
          player: playerId,
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
          player: playerId,
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
          player: playerId,
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
          player: playerId,
          leagueId: 1
        })

      await invalid(request, 'teamId')
    })

    it('release player not on team', async () => {
      const players = await knex('player').whereNot('cteam', 'INA').limit(1)
      const releasePlayerId = players[0].player

      const request = chai
        .request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user3}`)
        .send({
          teamId: 3,
          release: releasePlayerId,
          type: constants.waivers.POACH,
          player: playerId,
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
          player: playerId,
          leagueId: 1
        })

      await error(request, 'duplicate waiver claim')
    })

    it('player not on a practice squad', async () => {
      const players = await knex('player').whereNot('cteam', 'INA').limit(1)
      const randomPlayerId = players[0].player

      const request = chai
        .request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          teamId: 2,
          type: constants.waivers.POACH,
          player: randomPlayerId,
          leagueId: 1
        })

      await error(request, 'player is not on waivers')
    })

    it('player is not on waivers - past 48 hours', async () => {
      const time = start
        .subtract('1', 'month')
        .add('2', 'day')
        .add('11', 'minute')
        .toDate()
      MockDate.set(time)
      const request = chai
        .request(server)
        .post('/api/leagues/1/waivers')
        .set('Authorization', `Bearer ${user3}`)
        .send({
          teamId: 3,
          type: constants.waivers.POACH,
          player: playerId,
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
