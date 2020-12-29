/* global describe before it beforeEach */
process.env.NODE_ENV = 'test'

const chai = require('chai')
const chaiHTTP = require('chai-http')
const MockDate = require('mockdate')
const moment = require('moment')
const server = require('../api')
const knex = require('../db')

const league = require('../db/seeds/league')
const draft = require('../db/seeds/draft')
const { constants } = require('../common')
const { user1, user2 } = require('./fixtures/token')
const {
  addPlayer,
  selectPlayer,
  checkLastTransaction,
  error
} = require('./utils')

const should = chai.should()
chai.use(chaiHTTP)
const expect = chai.expect

describe('API /trades', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.migrate.forceFreeMigrationsLock()
    await knex.migrate.rollback()
    await knex.migrate.latest()
    await knex.seed.run()
  })

  describe('post', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      await league(knex)
    })

    it('one-for-one player trade', async () => {
      await draft(knex)

      const proposingTeamPlayerRows = await knex('rosters_players')
        .leftJoin('rosters', 'rosters_players.rid', 'rosters.uid')
        .where('rosters.tid', 1)
        .limit(1)

      const acceptingTeamPlayerRows = await knex('rosters_players')
        .leftJoin('rosters', 'rosters_players.rid', 'rosters.uid')
        .where('rosters.tid', 2)
        .limit(1)

      const proposingTeamPlayers = proposingTeamPlayerRows.map(p => p.player)
      const acceptingTeamPlayers = acceptingTeamPlayerRows.map(p => p.player)

      // set values to zero
      await knex('transactions')
        .whereIn('player', proposingTeamPlayers.concat(acceptingTeamPlayers))
        .update('value', 0)

      // TODO - get trading player values

      const proposeRes = await chai.request(server)
        .post('/api/leagues/1/trades')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          proposingTeamPlayers,
          acceptingTeamPlayers,
          pid: 1,
          tid: 2,
          leagueId: 1
        })

      proposeRes.should.have.status(200)
      // eslint-disable-next-line
      proposeRes.should.be.json
      proposeRes.body.pid.should.be.equal(1)
      proposeRes.body.tid.should.be.equal(2)
      proposeRes.body.userid.should.be.equal(1)
      proposeRes.body.year.should.be.equal(constants.season.year)
      should.exist(proposeRes.body.offered)
      should.not.exist(proposeRes.body.cancelled)
      should.not.exist(proposeRes.body.accepted)
      should.not.exist(proposeRes.body.rejected)
      should.not.exist(proposeRes.body.vetoed)
      proposeRes.body.proposingTeamPlayers.should.be.eql(proposingTeamPlayers)
      proposeRes.body.acceptingTeamPlayers.should.be.eql(acceptingTeamPlayers)

      const tradeid = proposeRes.body.uid

      const acceptRes = await chai.request(server)
        .post(`/api/leagues/1/trades/${tradeid}/accept`)
        .set('Authorization', `Bearer ${user2}`)

      acceptRes.should.have.status(200)
      // eslint-disable-next-line
      acceptRes.should.be.json
      acceptRes.body.pid.should.be.equal(1)
      acceptRes.body.tid.should.be.equal(2)
      acceptRes.body.userid.should.be.equal(1)
      acceptRes.body.year.should.be.equal(constants.season.year)
      should.exist(acceptRes.body.offered)
      should.not.exist(acceptRes.body.cancelled)
      should.exist(acceptRes.body.accepted)
      should.not.exist(acceptRes.body.rejected)
      should.not.exist(acceptRes.body.vetoed)
      acceptRes.body.proposingTeamPlayers.should.be.eql(proposingTeamPlayers)
      acceptRes.body.acceptingTeamPlayers.should.be.eql(acceptingTeamPlayers)

      const rows = await knex('rosters_players')
        .leftJoin('rosters', 'rosters_players.rid', 'rosters.uid')
        .whereIn('rosters_players.player', proposingTeamPlayers.concat(acceptingTeamPlayers))

      rows.length.should.equal(2)
      const proposingRow = rows.find(p => p.tid === 1)
      const acceptingRow = rows.find(p => p.tid === 2)
      proposingRow.player.should.equal(acceptingTeamPlayers[0])
      acceptingRow.player.should.equal(proposingTeamPlayers[0])

      // TODO - check player values pre/post trade
    })

    it('one for one trade of rookies: one active, one on practice squad, with subsequent deactivations', async () => {
      const player1 = await selectPlayer({ rookie: true })
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const value = 3
      await addPlayer({
        teamId,
        leagueId,
        userId,
        player: player1,
        slot: constants.slots.PS,
        transaction: constants.transactions.DRAFT
      })

      await knex('poaches').insert({
        userid: 3,
        tid: 3,
        lid: 1,
        player: player1.player,
        drop: null,
        submitted: Math.round(Date.now() / 1000)
      })

      // active player
      await knex('rosters_players')
        .update('slot', constants.slots.BENCH)
        .where('player', player1.player)
      await knex('transactions')
        .insert({
          userid: userId,
          tid: teamId,
          lid: leagueId,
          player: player1.player,
          type: constants.transactions.ROSTER_ACTIVATE,
          value: 0,
          year: constants.season.year,
          timestamp: Math.round(Date.now() / 1000)
        })

      const player2 = await selectPlayer({ rookie: true })
      await addPlayer({
        teamId: 2,
        leagueId,
        userId: 2,
        player: player2,
        slot: constants.slots.PS,
        transaction: constants.transactions.DRAFT,
        value
      })

      const proposingTeamPlayers = [player1.player]
      const acceptingTeamPlayers = [player2.player]
      const proposeRes = await chai.request(server)
        .post('/api/leagues/1/trades')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          proposingTeamPlayers,
          acceptingTeamPlayers,
          pid: 1,
          tid: 2,
          leagueId: 1
        })

      proposeRes.should.have.status(200)
      // eslint-disable-next-line
      proposeRes.should.be.json
      proposeRes.body.pid.should.be.equal(1)
      proposeRes.body.tid.should.be.equal(2)
      proposeRes.body.userid.should.be.equal(1)
      proposeRes.body.year.should.be.equal(constants.season.year)
      should.exist(proposeRes.body.offered)
      should.not.exist(proposeRes.body.cancelled)
      should.not.exist(proposeRes.body.accepted)
      should.not.exist(proposeRes.body.rejected)
      should.not.exist(proposeRes.body.vetoed)
      proposeRes.body.proposingTeamPlayers.should.be.eql(proposingTeamPlayers)
      proposeRes.body.acceptingTeamPlayers.should.be.eql(acceptingTeamPlayers)

      const tradeid = proposeRes.body.uid

      const acceptRes = await chai.request(server)
        .post(`/api/leagues/1/trades/${tradeid}/accept`)
        .set('Authorization', `Bearer ${user2}`)

      acceptRes.should.have.status(200)
      // eslint-disable-next-line
      acceptRes.should.be.json
      acceptRes.body.pid.should.be.equal(1)
      acceptRes.body.tid.should.be.equal(2)
      acceptRes.body.userid.should.be.equal(1)
      acceptRes.body.year.should.be.equal(constants.season.year)
      should.exist(acceptRes.body.offered)
      should.not.exist(acceptRes.body.cancelled)
      should.exist(acceptRes.body.accepted)
      should.not.exist(acceptRes.body.rejected)
      should.not.exist(acceptRes.body.vetoed)
      acceptRes.body.proposingTeamPlayers.should.be.eql(proposingTeamPlayers)
      acceptRes.body.acceptingTeamPlayers.should.be.eql(acceptingTeamPlayers)

      const rows = await knex('rosters_players')
        .leftJoin('rosters', 'rosters_players.rid', 'rosters.uid')
        .whereIn('rosters_players.player', proposingTeamPlayers.concat(acceptingTeamPlayers))

      rows.length.should.equal(2)
      const proposingRow = rows.find(p => p.tid === 1)
      const acceptingRow = rows.find(p => p.tid === 2)
      proposingRow.player.should.equal(acceptingTeamPlayers[0])
      acceptingRow.player.should.equal(proposingTeamPlayers[0])

      const res = await chai.request(server)
        .post('/api/teams/1/deactivate')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          player: player2.player,
          leagueId
        })

      res.should.have.status(200)
      // eslint-disable-next-line
      res.should.be.json

      res.body.tid.should.equal(teamId)
      res.body.player.should.equal(player2.player)
      res.body.slot.should.equal(constants.slots.PS)
      res.body.transaction.userid.should.equal(userId)
      res.body.transaction.tid.should.equal(teamId)
      res.body.transaction.lid.should.equal(leagueId)
      res.body.transaction.player.should.equal(player2.player)
      res.body.transaction.type.should.equal(constants.transactions.ROSTER_DEACTIVATE)
      res.body.transaction.value.should.equal(value)
      res.body.transaction.year.should.equal(constants.season.year)
      res.body.transaction.timestamp.should.equal(Math.round(Date.now() / 1000))

      // verify poach is cancelled
      const poaches = await knex('poaches')
      expect(poaches.length).to.equal(1)
      // eslint-disable-next-line
      expect(poaches[0].processed).to.exist
      expect(poaches[0].succ).to.equal(0)
      expect(poaches[0].reason).to.equal('Player traded')

      const rosterRows = await knex('rosters_players')
        .join('rosters', 'rosters_players.rid', 'rosters.uid')
        .where({
          year: constants.season.year,
          week: constants.season.week,
          player: player2.player
        })
        .limit(1)

      const rosterRow = rosterRows[0]
      expect(rosterRow.slot).to.equal(constants.slots.PS)

      await checkLastTransaction({
        leagueId,
        type: constants.transactions.ROSTER_DEACTIVATE,
        value,
        year: constants.season.year,
        player: player2.player,
        teamId,
        userId
      })
    })
  })

  // trade with drop players, make sure transactions are created

  // one for one trade

  // two for one trade with drop

  // one for two trade with drop

  // one for one pick exchange

  // two for one pick exchange

  // two players for two picks and two drops

  // three for one with no drop (has room)

  // cancel trade
  // reject trade

  // cancel trades with involved players when trade accepted

  // cancel trades with involved picks when trade accepted

  describe('errors', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      await league(knex)
    })

    it('trade player with existing poaching claim', async () => {
      const player1 = await selectPlayer({ rookie: true })
      const teamId = 1
      const leagueId = 1
      const userId = 1
      await addPlayer({
        teamId,
        leagueId,
        userId,
        player: player1,
        slot: constants.slots.PS,
        transaction: constants.transactions.DRAFT
      })

      await knex('poaches').insert({
        userid: 3,
        tid: 3,
        lid: 1,
        player: player1.player,
        drop: null,
        submitted: Math.round(Date.now() / 1000)
      })

      const player2 = await selectPlayer({ rookie: true })
      await addPlayer({
        teamId: 2,
        leagueId,
        userId: 2,
        player: player2,
        slot: constants.slots.PS,
        transaction: constants.transactions.DRAFT
      })

      const proposingTeamPlayers = [player1.player]
      const acceptingTeamPlayers = [player2.player]
      const request = chai.request(server)
        .post('/api/leagues/1/trades')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          proposingTeamPlayers,
          acceptingTeamPlayers,
          pid: 1,
          tid: 2,
          leagueId: 1
        })

      await error(request, 'player has poaching claim')
    })

    it('deadline has passed', async function () {
      MockDate.set(moment('1606626001', 'X').toDate())
      const request = chai.request(server)
        .post('/api/leagues/1/trades')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          proposingTeamPlayers: [],
          acceptingTeamPlayers: [],
          pid: 1,
          tid: 2,
          leagueId: 1
        })

      await error(request, 'deadline has passed')
    })
  })
  // errors

  // - not logged in
  // - invalid userId
  // - invalid leagueId
  // - invalid teamId
  // - invalid player
  // - invalid drop
  // - teamId doesn't belong to userId
  // - drop player not on team
  // - player not on team
  // - some players not on team
  // - some drop players not on team
  // - pick not owned by proposing team
  // - some picks not owned by proposing team
  // - pick is not owned by accepting team
  // - some picks are not owned by accepting team
  // - pick already used/drafted
  // - exceeds bench space on proposing team
  // - exceeds bench space on accepting team
  // - trade player with existing poaching claim
  // - trade proposal exceeds salary space (offseason)
  // - trade acceptance exceeds salary space (offseason)

  // - accept cancelled trade
  // - accept rejected trade
  // - reject rejected trade
  // - reject cancelled trade
})
