/* global describe before it */
process.env.NODE_ENV = 'test'

const chai = require('chai')
const chaiHTTP = require('chai-http')
const MockDate = require('mockdate')

const server = require('../api')
const knex = require('../db')

const league = require('../db/seeds/league')
const { constants } = require('../common')
const { start } = constants.season
const { user1, user2 } = require('./fixtures/token')
const {
  addPlayer,
  selectPlayer,
  checkLastTransaction,
  notLoggedIn,
  missing,
  invalid,
  error
} = require('./utils')
const run = require('../scripts/process-waivers-free-agency-active')

chai.should()
chai.use(chaiHTTP)
const expect = chai.expect

describe('API /teams - deactivate', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.migrate.forceFreeMigrationsLock()
    await knex.migrate.rollback()
    await knex.migrate.latest()
    await knex.seed.run()
  })

  describe('post', function () {
    before(async function () {
      this.timeout(60 * 1000)
      await league(knex)
    })

    it('drafted player', async () => {
      MockDate.set(start.subtract('1', 'week').toDate())
      const player = await selectPlayer({ rookie: true })
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const value = 2
      await addPlayer({
        teamId,
        leagueId,
        userId,
        player,
        slot: constants.slots.BENCH,
        transaction: constants.transactions.DRAFT,
        value
      })

      const res = await chai
        .request(server)
        .post('/api/teams/1/deactivate')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          player: player.player,
          leagueId
        })

      res.should.have.status(200)
      // eslint-disable-next-line
      res.should.be.json

      res.body.tid.should.equal(teamId)
      res.body.player.should.equal(player.player)
      res.body.slot.should.equal(constants.slots.PS)
      res.body.transaction.userid.should.equal(userId)
      res.body.transaction.tid.should.equal(teamId)
      res.body.transaction.lid.should.equal(leagueId)
      res.body.transaction.player.should.equal(player.player)
      res.body.transaction.type.should.equal(
        constants.transactions.ROSTER_DEACTIVATE
      )
      res.body.transaction.value.should.equal(value)
      res.body.transaction.year.should.equal(constants.season.year)
      res.body.transaction.timestamp.should.equal(Math.round(Date.now() / 1000))

      const rosterRows = await knex('rosters_players')
        .join('rosters', 'rosters_players.rid', 'rosters.uid')
        .where({
          year: constants.season.year,
          week: constants.season.week,
          player: player.player
        })
        .limit(1)

      const rosterRow = rosterRows[0]
      expect(rosterRow.slot).to.equal(constants.slots.PS)

      await checkLastTransaction({
        leagueId,
        type: constants.transactions.ROSTER_DEACTIVATE,
        value,
        year: constants.season.year,
        player: player.player,
        teamId,
        userId
      })
    })

    it('signed via waivers, with no competing bids', async () => {
      MockDate.set(start.add('1', 'month').day(4).toDate())
      const leagueId = 1
      const teamId = 1
      const userId = 1
      const value = 2
      const player = await selectPlayer()
      await knex('waivers').insert({
        tid: teamId,
        userid: 1,
        lid: leagueId,
        player: player.player,
        po: 9999,
        submitted: Math.round(Date.now() / 1000),
        bid: value,
        type: constants.waivers.FREE_AGENCY
      })

      let error
      try {
        await run()
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      const res = await chai
        .request(server)
        .post('/api/teams/1/deactivate')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          player: player.player,
          leagueId
        })

      res.should.have.status(200)
      // eslint-disable-next-line
      res.should.be.json

      res.body.tid.should.equal(teamId)
      res.body.player.should.equal(player.player)
      res.body.slot.should.equal(constants.slots.PS)
      res.body.transaction.userid.should.equal(userId)
      res.body.transaction.tid.should.equal(teamId)
      res.body.transaction.lid.should.equal(leagueId)
      res.body.transaction.player.should.equal(player.player)
      res.body.transaction.type.should.equal(
        constants.transactions.ROSTER_DEACTIVATE
      )
      res.body.transaction.value.should.equal(value)
      res.body.transaction.year.should.equal(constants.season.year)
      res.body.transaction.timestamp.should.equal(Math.round(Date.now() / 1000))

      const rosterRows = await knex('rosters_players')
        .join('rosters', 'rosters_players.rid', 'rosters.uid')
        .where({
          year: constants.season.year,
          week: constants.season.week,
          player: player.player
        })
        .limit(1)

      const rosterRow = rosterRows[0]
      expect(rosterRow.slot).to.equal(constants.slots.PS)

      await checkLastTransaction({
        leagueId,
        type: constants.transactions.ROSTER_DEACTIVATE,
        value,
        year: constants.season.year,
        player: player.player,
        teamId,
        userId
      })
    })

    it('traded player', async () => {
      // TODO
    })

    it('added player', async () => {
      // TODO
    })

    it('signed player', async () => {
      // TODO
    })

    it('end of season add', async () => {
      // TODO
    })

    it('ir player', async () => {
      // TODO
    })

    it('covid player', async () => {
      // TODO
    })
  })

  describe('errors', function () {
    it('not logged in', async () => {
      const request = chai.request(server).post('/api/teams/1/deactivate')
      await notLoggedIn(request)
    })

    it('missing player', async () => {
      const request = chai
        .request(server)
        .post('/api/teams/1/deactivate')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1
        })

      await missing(request, 'player')
    })

    it('missing leagueId', async () => {
      const request = chai
        .request(server)
        .post('/api/teams/1/deactivate')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          player: 'x'
        })

      await missing(request, 'leagueId')
    })

    it('teamId does not belong to userId', async () => {
      const request = chai
        .request(server)
        .post('/api/teams/1/deactivate')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          leagueId: 1,
          player: 'x'
        })

      await invalid(request, 'teamId')
    })

    it('player not on team', async () => {
      const player = await selectPlayer()
      const request = chai
        .request(server)
        .post('/api/teams/1/deactivate')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          player: player.player
        })

      await invalid(request, 'player')
    })

    it('player already on practice squad', async () => {
      const player = await selectPlayer({ rookie: true })
      await addPlayer({
        leagueId: 1,
        player,
        teamId: 1,
        userId: 1,
        slot: constants.slots.PS
      })
      const request = chai
        .request(server)
        .post('/api/teams/1/deactivate')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          player: player.player,
          leagueId: 1
        })

      await error(request, 'player is already on practice squad')
    })

    it('exceed roster limits', async () => {
      // TODO
    })

    it('player previously poached', async () => {
      // TODO
    })

    it('player previously activated', async () => {
      // TODO
    })

    it('player on roster for more than 48 hours', async () => {
      // TODO
    })

    it('signed via free agency waivers with multiple bids', async () => {
      MockDate.set(start.add('1', 'month').day(4).toDate())
      const leagueId = 1
      const player = await selectPlayer()
      await knex('waivers').insert({
        tid: 1,
        userid: 1,
        lid: leagueId,
        player: player.player,
        po: 9999,
        submitted: Math.round(Date.now() / 1000),
        bid: 1,
        type: constants.waivers.FREE_AGENCY
      })

      await knex('waivers').insert({
        tid: 2,
        userid: 1,
        lid: leagueId,
        player: player.player,
        po: 9999,
        submitted: Math.round(Date.now() / 1000),
        bid: 0,
        type: constants.waivers.FREE_AGENCY
      })

      let err
      try {
        await run()
      } catch (error) {
        err = error
      }

      expect(err).to.equal(undefined)

      const request = chai
        .request(server)
        .post('/api/teams/1/deactivate')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          player: player.player,
          leagueId
        })

      await error(request, 'player is not eligible, had competing waivers')
    })
  })
})
