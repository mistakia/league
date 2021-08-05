/* global describe before beforeEach it */
process.env.NODE_ENV = 'test'

const chai = require('chai')
const chaiHTTP = require('chai-http')
// const MockDate = require('mockdate')

const server = require('../api')
const knex = require('../db')

const league = require('../db/seeds/league')
const { constants } = require('../common')
// const { start } = constants.season
const { user1, user2 } = require('./fixtures/token')
const {
  selectPlayer,
  addPlayer,
  notLoggedIn,
  missing,
  invalid
} = require('./utils')

chai.should()
chai.use(chaiHTTP)
const expect = chai.expect

describe('API /teams - cutlist', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.migrate.forceFreeMigrationsLock()
    await knex.migrate.rollback()
    await knex.migrate.latest()
    await knex.seed.run()
  })

  describe('post', function () {
    beforeEach(async function () {
      await league(knex)
    })

    it('one player', async () => {
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const player = await selectPlayer()
      await addPlayer({
        player,
        leagueId,
        teamId,
        userId,
        slot: constants.slots.BENCH
      })

      const res = await chai
        .request(server)
        .post('/api/teams/1/cutlist')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          players: player.player
        })

      res.should.have.status(200)
      // eslint-disable-next-line
      res.should.be.json

      res.body.length.should.equal(1)
      res.body[0].should.equal(player.player)

      const players = await knex('cutlist')
      expect(players.length).to.equal(1)
      expect(players[0].player).to.equal(player.player)
      expect(players[0].tid).to.equal(teamId)
      expect(players[0].order).to.equal(0)
    })

    it('multiple player', async () => {
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const player1 = await selectPlayer()
      await addPlayer({
        player: player1,
        leagueId,
        teamId,
        userId,
        slot: constants.slots.BENCH
      })

      const player2 = await selectPlayer()
      await addPlayer({
        player: player2,
        leagueId,
        teamId,
        userId,
        slot: constants.slots.BENCH
      })

      const players = [player1.player, player2.player]
      const res = await chai
        .request(server)
        .post('/api/teams/1/cutlist')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          players
        })

      res.should.have.status(200)
      // eslint-disable-next-line
      res.should.be.json

      res.body.length.should.equal(2)
      res.body.should.deep.equal(players)

      const cutlist = await knex('cutlist')
      expect(cutlist.length).to.equal(2)
      expect(cutlist[0].player).to.equal(player1.player)
      expect(cutlist[0].tid).to.equal(teamId)
      expect(cutlist[0].order).to.equal(0)
      expect(cutlist[1].player).to.equal(player2.player)
      expect(cutlist[1].tid).to.equal(teamId)
      expect(cutlist[1].order).to.equal(1)
    })

    it('update', async () => {
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const player1 = await selectPlayer()
      await addPlayer({
        player: player1,
        leagueId,
        teamId,
        userId,
        slot: constants.slots.BENCH
      })

      const player2 = await selectPlayer()
      await addPlayer({
        player: player2,
        leagueId,
        teamId,
        userId,
        slot: constants.slots.BENCH
      })

      const res1 = await chai
        .request(server)
        .post('/api/teams/1/cutlist')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          players: [player2.player, player1.player]
        })

      res1.should.have.status(200)
      // eslint-disable-next-line
      res1.should.be.json

      const players = [player1.player, player2.player]
      const res2 = await chai
        .request(server)
        .post('/api/teams/1/cutlist')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          players
        })

      res2.body.length.should.equal(2)
      res2.body.should.deep.equal(players)

      const cutlist = await knex('cutlist')
      expect(cutlist.length).to.equal(2)
      expect(cutlist[0].player).to.equal(player2.player)
      expect(cutlist[0].tid).to.equal(teamId)
      expect(cutlist[0].order).to.equal(1)
      expect(cutlist[1].player).to.equal(player1.player)
      expect(cutlist[1].tid).to.equal(teamId)
      expect(cutlist[1].order).to.equal(0)
    })

    it('delete', async () => {
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const player1 = await selectPlayer()
      await addPlayer({
        player: player1,
        leagueId,
        teamId,
        userId,
        slot: constants.slots.BENCH
      })

      const player2 = await selectPlayer()
      await addPlayer({
        player: player2,
        leagueId,
        teamId,
        userId,
        slot: constants.slots.BENCH
      })

      const res1 = await chai
        .request(server)
        .post('/api/teams/1/cutlist')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          players: [player2.player, player1.player]
        })

      res1.should.have.status(200)
      // eslint-disable-next-line
      res1.should.be.json

      const res2 = await chai
        .request(server)
        .post('/api/teams/1/cutlist')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          players: []
        })

      res2.body.length.should.equal(0)

      const cutlist = await knex('cutlist')
      expect(cutlist.length).to.equal(0)
    })
  })

  describe('errors', function () {
    beforeEach(async function () {
      await league(knex)
    })

    it('not logged in', async () => {
      const request = chai.request(server).post('/api/teams/1/cutlist')
      await notLoggedIn(request)
    })

    it('missing players', async () => {
      const request = chai
        .request(server)
        .post('/api/teams/1/cutlist')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1
        })

      await missing(request, 'players')
    })

    it('missing leagueId', async () => {
      const request = chai
        .request(server)
        .post('/api/teams/1/cutlist')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          players: 'x'
        })

      await missing(request, 'leagueId')
    })

    it('invalid player - does not exist', async () => {
      const request = chai
        .request(server)
        .post('/api/teams/1/cutlist')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          players: 'x',
          leagueId: 1
        })

      await invalid(request, 'player')
    })

    it('invalid leagueId - does not exist', async () => {
      const request = chai
        .request(server)
        .post('/api/teams/1/cutlist')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          players: 'x',
          leagueId: 2
        })

      await invalid(request, 'leagueId')
    })

    it('teamId does not belong to userId', async () => {
      const request = chai
        .request(server)
        .post('/api/teams/1/cutlist')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          players: 'x',
          leagueId: 1
        })

      await invalid(request, 'teamId')
    })

    it('player not on team', async () => {
      const player = await selectPlayer()
      const request = chai
        .request(server)
        .post('/api/teams/1/cutlist')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          players: player.player,
          leagueId: 1
        })

      await invalid(request, 'player')
    })
  })
})
