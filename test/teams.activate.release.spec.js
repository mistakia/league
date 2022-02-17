/* global describe before beforeEach it */
process.env.NODE_ENV = 'test'

const chai = require('chai')
const chaiHTTP = require('chai-http')
const MockDate = require('mockdate')

const server = require('../api')
const knex = require('../db')

const league = require('../db/seeds/league')
const { constants } = require('../common')
const { start } = constants.season
const { user1 } = require('./fixtures/token')
const {
  addPlayer,
  selectPlayer,
  fillRoster,
  invalid,
  error
} = require('./utils')

chai.should()
chai.use(chaiHTTP)
const expect = chai.expect

describe('API /teams - activate', function () {
  before(async function () {
    this.timeout(60 * 1000)

    MockDate.set(start.subtract('1', 'week').toDate())

    await knex.migrate.forceFreeMigrationsLock()
    await knex.migrate.rollback()
    await knex.migrate.latest()
    await knex.seed.run()
  })

  describe('post', function () {
    beforeEach(async function () {
      await league(knex)
    })

    it('activate and release player', async () => {
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const value = 0

      await fillRoster({ leagueId, teamId })

      const players = await knex('rosters_players')
        .join('rosters', 'rosters_players.rid', 'rosters.uid')
        .where({
          lid: leagueId,
          tid: teamId,
          week: constants.season.week,
          year: constants.season.year
        })

      const player1 = players.find((p) => p.slot === constants.slots.IR)
      const player2 = players.find((p) => p.slot === constants.slots.BENCH)

      const res = await chai
        .request(server)
        .post('/api/teams/1/activate')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          player: player1.player,
          release: player2.player,
          leagueId
        })

      res.should.have.status(200)
      // eslint-disable-next-line
      res.should.be.json

      res.body.tid.should.equal(teamId)
      res.body.player.should.equal(player1.player)
      res.body.slot.should.equal(constants.slots.BENCH)
      res.body.transaction.userid.should.equal(userId)
      res.body.transaction.tid.should.equal(teamId)
      res.body.transaction.lid.should.equal(leagueId)
      res.body.transaction.player.should.equal(player1.player)
      res.body.transaction.type.should.equal(
        constants.transactions.ROSTER_ACTIVATE
      )
      res.body.transaction.value.should.equal(value)
      res.body.transaction.year.should.equal(constants.season.year)
      res.body.transaction.timestamp.should.equal(Math.round(Date.now() / 1000))

      const rosterRows = await knex('rosters_players')
        .join('rosters', 'rosters_players.rid', 'rosters.uid')
        .where({
          year: constants.season.year,
          week: constants.season.week,
          player: player1.player
        })
        .limit(1)

      const rosterRow = rosterRows[0]
      expect(rosterRow.slot).to.equal(constants.slots.BENCH)

      const transactions = await knex('transactions')

      const activateTransaction = transactions.find(
        (t) => t.type === constants.transactions.ROSTER_ACTIVATE
      )
      expect(activateTransaction.lid).to.equal(leagueId)
      expect(activateTransaction.type).to.equal(
        constants.transactions.ROSTER_ACTIVATE
      )
      expect(activateTransaction.value).to.equal(value)
      expect(activateTransaction.player).to.equal(player1.player)
      expect(activateTransaction.tid).to.equal(teamId)
      expect(activateTransaction.userid).to.equal(userId)

      const releaseTransaction = transactions.find(
        (t) => t.type === constants.transactions.ROSTER_RELEASE
      )
      expect(releaseTransaction.lid).to.equal(leagueId)
      expect(releaseTransaction.type).to.equal(
        constants.transactions.ROSTER_RELEASE
      )
      expect(releaseTransaction.value).to.equal(value)
      expect(releaseTransaction.player).to.equal(player2.player)
      expect(releaseTransaction.tid).to.equal(teamId)
      expect(releaseTransaction.userid).to.equal(userId)
    })
  })

  describe('errors', function () {
    beforeEach(async function () {
      await league(knex)
    })

    it('invalid release player - does not exist', async () => {
      const player1 = await selectPlayer()
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const value = 2
      await addPlayer({
        teamId,
        leagueId,
        userId,
        player: player1,
        slot: constants.slots.IR,
        transaction: constants.transactions.DRAFT,
        value
      })

      const request = chai
        .request(server)
        .post('/api/teams/1/activate')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          release: 'x',
          player: player1.player
        })

      await invalid(request, 'player')
    })

    it('release player not on team', async () => {
      const player1 = await selectPlayer()
      const player2 = await selectPlayer()
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const value = 2
      await addPlayer({
        teamId,
        leagueId,
        userId,
        player: player1,
        slot: constants.slots.IR,
        transaction: constants.transactions.DRAFT,
        value
      })

      const request = chai
        .request(server)
        .post('/api/teams/1/activate')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          release: player2.player,
          player: player1.player
        })

      await error(request, 'player not on roster')
    })

    it('exceeds roster limits', async () => {
      const teamId = 1
      const leagueId = 1

      await fillRoster({ leagueId, teamId })

      const players = await knex('rosters_players')
        .join('rosters', 'rosters_players.rid', 'rosters.uid')
        .where({
          lid: leagueId,
          tid: teamId,
          week: constants.season.week,
          year: constants.season.year
        })

      const player1 = players.find((p) => p.slot === constants.slots.IR)
      const player2 = players.find(
        (p) => p.slot === constants.slots.IR && p.player !== player1.player
      )

      const request = chai
        .request(server)
        .post('/api/teams/1/activate')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          player: player1.player,
          release: player2.player,
          leagueId
        })

      await error(request, 'exceeds roster limits')
    })

    it('activate player is on active roster', async () => {
      const player1 = await selectPlayer()
      const player2 = await selectPlayer()
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const value = 2
      await addPlayer({
        teamId,
        leagueId,
        userId,
        player: player1,
        slot: constants.slots.BENCH,
        transaction: constants.transactions.DRAFT,
        value
      })

      await addPlayer({
        teamId,
        leagueId,
        userId,
        player: player2,
        slot: constants.slots.BENCH,
        transaction: constants.transactions.DRAFT,
        value
      })

      const request = chai
        .request(server)
        .post('/api/teams/1/activate')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          release: player2.player,
          player: player1.player
        })

      await error(request, 'player is on active roster')
    })
  })
})
