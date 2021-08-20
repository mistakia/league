/* global describe before it after */
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

const expect = chai.expect

const {
  selectPlayer,
  checkRoster,
  checkLastTransaction,
  notLoggedIn,
  missing,
  invalid,
  error
} = require('./utils')
const { user1, user2, user3 } = require('./fixtures/token')

chai.use(chaiHTTP)

describe('API /draft', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.migrate.forceFreeMigrationsLock()
    await knex.migrate.rollback()
    await knex.migrate.latest()
    await knex.seed.run()

    MockDate.set(start.subtract('1', 'month').toDate())

    await league(knex)
    await draftPicks(knex)
  })

  after(() => {
    MockDate.reset()
  })

  it('make selection', async () => {
    MockDate.set(start.subtract('1', 'month').add('10', 'minute').toDate())

    const leagueId = 1
    const teamId = 1
    const player = await selectPlayer({ rookie: true })
    const res = await chai
      .request(server)
      .post('/api/leagues/1/draft')
      .set('Authorization', `Bearer ${user1}`)
      .send({
        teamId,
        playerId: player.player,
        pickId: 1
      })

    res.should.have.status(200)
    // eslint-disable-next-line
    res.should.be.json

    res.body.uid.should.equal(1)
    res.body.player.should.equal(player.player)
    res.body.lid.should.equal(leagueId)
    res.body.tid.should.equal(teamId)

    await checkRoster({ teamId, player: player.player, leagueId })
    await checkLastTransaction({
      leagueId,
      type: constants.transactions.DRAFT,
      value: 12,
      year: constants.season.year,
      player: player.player,
      teamId,
      userId: 1
    })

    const picks = await knex('draft').where({ uid: 1 })
    const pick = picks[0]

    expect(pick.player).to.equal(player.player)
  })

  // - draft a rookie with a traded pick
  // - draft a rookie after first 24hrs
  // - draft a rookie before the pick before you
  // - draft a rookie with no practice squad space (space on active roster)

  describe('errors', function () {
    it('not logged in', async () => {
      const request = chai.request(server).post('/api/leagues/1/draft')
      await notLoggedIn(request)
    })

    it('missing teamId', async () => {
      const request = chai
        .request(server)
        .post('/api/leagues/1/draft')
        .set('Authorization', `Bearer ${user2}`)
        .send({ playerId: 'xx', pickId: 1 })

      await missing(request, 'teamId')
    })

    it('missing playerId', async () => {
      const request = chai
        .request(server)
        .post('/api/leagues/1/draft')
        .set('Authorization', `Bearer ${user2}`)
        .send({ teamId: 2, pickId: 1 })

      await missing(request, 'playerId')
    })

    it('missing pickId', async () => {
      const request = chai
        .request(server)
        .post('/api/leagues/1/draft')
        .set('Authorization', `Bearer ${user2}`)
        .send({ playerId: 'xx', teamId: 2 })

      await missing(request, 'pickId')
    })

    it('invalid teamId', async () => {
      const request = chai
        .request(server)
        .post('/api/leagues/1/draft')
        .set('Authorization', `Bearer ${user2}`)
        .send({ playerId: 'xx', pickId: 2, teamId: 'a' })

      await invalid(request, 'teamId')
    })

    it('invalid playerId - does not exist', async () => {
      MockDate.set(start.subtract('1', 'month').add('1', 'day').toDate())
      const request = chai
        .request(server)
        .post('/api/leagues/1/draft')
        .set('Authorization', `Bearer ${user2}`)
        .send({ playerId: 'xx', pickId: 2, teamId: 2 })

      await invalid(request, 'playerId')
    })

    it('invalid playerId - position', async () => {
      // TODO
    })

    it('invalid leagueId', async () => {
      const request = chai
        .request(server)
        .post('/api/leagues/0/draft')
        .set('Authorization', `Bearer ${user2}`)
        .send({ playerId: 'xx', pickId: 2, teamId: 2 })

      await invalid(request, 'leagueId')
    })

    it('invalid playerId - not a rookie', async () => {
      const players = await knex('player')
        .where('start', constants.season.year - 1)
        .limit(1)
      const player = players[0]
      const request = chai
        .request(server)
        .post('/api/leagues/1/draft')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          teamId: 2,
          playerId: player.player,
          pickId: 2
        })

      await invalid(request, 'playerId')
    })

    it('teamId does not belong to userId', async () => {
      const request = chai
        .request(server)
        .post('/api/leagues/1/draft')
        .set('Authorization', `Bearer ${user3}`)
        .send({ playerId: 'xx', pickId: 2, teamId: 2 })

      await invalid(request, 'teamId')
    })

    it('draft hasnt started', async () => {
      MockDate.set(start.subtract('1', 'month').subtract('1', 'day').toDate())
      const request = chai
        .request(server)
        .post('/api/leagues/1/draft')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          teamId: 2,
          playerId: 'xx',
          pickId: 2
        })

      await error(request, 'draft has not started')
    })

    it('pick not on clock', async () => {
      const player = await selectPlayer({ rookie: true })
      MockDate.set(start.subtract('1', 'month').add('1', 'minute').toDate())
      const request = chai
        .request(server)
        .post('/api/leagues/1/draft')
        .set('Authorization', `Bearer ${user3}`)
        .send({
          teamId: 3,
          playerId: player.player,
          pickId: 3
        })

      await error(request, 'draft pick not on the clock')
    })

    it('pick is already selected', async () => {
      MockDate.set(start.subtract('1', 'month').add('1', 'minute').toDate())
      const request = chai
        .request(server)
        .post('/api/leagues/1/draft')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId: 1,
          playerId: 'xx',
          pickId: 1
        })

      await invalid(request, 'pickId')
    })

    it('pickId does not belong to teamId', async () => {
      MockDate.set(start.subtract('1', 'month').add('1', 'minute').toDate())
      const request = chai
        .request(server)
        .post('/api/leagues/1/draft')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          teamId: 1,
          playerId: 'xx',
          pickId: 2
        })

      await invalid(request, 'pickId')
    })

    it('player rostered', async () => {
      const picks = await knex('draft').where({ uid: 1 }).limit(1)
      const { player } = picks[0]
      MockDate.set(start.subtract('1', 'month').add('2', 'day').toDate())
      const request = chai
        .request(server)
        .post('/api/leagues/1/draft')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          teamId: 2,
          playerId: player,
          pickId: 2
        })

      await error(request, 'player rostered')
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
