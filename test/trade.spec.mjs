/* global describe before it beforeEach */
import * as chai from 'chai'
import { default as chai_http, request as chai_request } from 'chai-http'
import MockDate from 'mockdate'

import server from '#api'
import knex from '#db'
import league from '#db/seeds/league.mjs'
import draft from '#db/seeds/draft.mjs'
import { constants } from '#libs-shared'
import { user1, user2 } from './fixtures/token.mjs'
import {
  addPlayer,
  selectPlayer,
  checkLastTransaction,
  error
} from './utils/index.mjs'

process.env.NODE_ENV = 'test'

const should = chai.should()
chai.use(chai_http)
const expect = chai.expect

describe('API /trades', function () {
  before(async function () {
    this.timeout(60 * 1000)
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
        .where({
          lid: 1,
          tid: 1,
          year: constants.season.year,
          week: constants.season.week
        })
        .whereNot('pos', 'K')
        .limit(1)

      const acceptingTeamPlayerRows = await knex('rosters_players')
        .where({
          lid: 1,
          tid: 2,
          year: constants.season.year,
          week: constants.season.week
        })
        .whereNot('pos', 'K')
        .limit(1)

      const proposingTeamPlayers = proposingTeamPlayerRows.map((p) => p.pid)
      const acceptingTeamPlayers = acceptingTeamPlayerRows.map((p) => p.pid)

      // set values to zero
      await knex('transactions')
        .whereIn('pid', proposingTeamPlayers.concat(acceptingTeamPlayers))
        .update('value', 0)

      // TODO - get trading player values

      const proposeRes = await chai_request.execute(server)
        .post('/api/leagues/1/trades')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          proposingTeamPlayers,
          acceptingTeamPlayers,
          propose_tid: 1,
          accept_tid: 2,
          leagueId: 1
        })

      proposeRes.should.have.status(200)
      // eslint-disable-next-line
      proposeRes.should.be.json
      proposeRes.body.propose_tid.should.be.equal(1)
      proposeRes.body.accept_tid.should.be.equal(2)
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

      const acceptRes = await chai_request.execute(server)
        .post(`/api/leagues/1/trades/${tradeid}/accept`)
        .set('Authorization', `Bearer ${user2}`)

      acceptRes.should.have.status(200)
      // eslint-disable-next-line
      acceptRes.should.be.json
      acceptRes.body.propose_tid.should.be.equal(1)
      acceptRes.body.accept_tid.should.be.equal(2)
      acceptRes.body.userid.should.be.equal(1)
      acceptRes.body.year.should.be.equal(constants.season.year)
      should.exist(acceptRes.body.offered)
      should.not.exist(acceptRes.body.cancelled)
      should.exist(acceptRes.body.accepted)
      should.not.exist(acceptRes.body.rejected)
      should.not.exist(acceptRes.body.vetoed)
      acceptRes.body.proposingTeamPlayers.should.be.eql(proposingTeamPlayers)
      acceptRes.body.acceptingTeamPlayers.should.be.eql(acceptingTeamPlayers)

      const rows = await knex('rosters_players').whereIn(
        'pid',
        proposingTeamPlayers.concat(acceptingTeamPlayers)
      )

      rows.length.should.equal(2)
      const proposingRow = rows.find((p) => p.tid === 1)
      const acceptingRow = rows.find((p) => p.tid === 2)
      proposingRow.pid.should.equal(acceptingTeamPlayers[0])
      acceptingRow.pid.should.equal(proposingTeamPlayers[0])

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
        pid: player1.pid,
        player_tid: teamId,
        submitted: Math.round(Date.now() / 1000)
      })

      // active player
      await knex('rosters_players')
        .update('slot', constants.slots.BENCH)
        .where('pid', player1.pid)
      await knex('transactions').insert({
        userid: userId,
        tid: teamId,
        lid: leagueId,
        pid: player1.pid,
        type: constants.transactions.ROSTER_ACTIVATE,
        value: 0,
        week: constants.season.week,
        year: constants.season.year,
        timestamp: Math.round(Date.now() / 1000)
      })

      const player2 = await selectPlayer({
        rookie: true,
        exclude_pids: [player1.pid]
      })
      await addPlayer({
        teamId: 2,
        leagueId,
        userId: 2,
        player: player2,
        slot: constants.slots.PS,
        transaction: constants.transactions.DRAFT,
        value
      })

      const proposingTeamPlayers = [player1.pid]
      const acceptingTeamPlayers = [player2.pid]
      const proposeRes = await chai_request.execute(server)
        .post('/api/leagues/1/trades')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          proposingTeamPlayers,
          acceptingTeamPlayers,
          propose_tid: 1,
          accept_tid: 2,
          leagueId: 1
        })

      proposeRes.should.have.status(200)
      // eslint-disable-next-line
      proposeRes.should.be.json
      proposeRes.body.propose_tid.should.be.equal(1)
      proposeRes.body.accept_tid.should.be.equal(2)
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

      const acceptRes = await chai_request.execute(server)
        .post(`/api/leagues/1/trades/${tradeid}/accept`)
        .set('Authorization', `Bearer ${user2}`)

      acceptRes.should.have.status(200)
      // eslint-disable-next-line
      acceptRes.should.be.json
      acceptRes.body.propose_tid.should.be.equal(1)
      acceptRes.body.accept_tid.should.be.equal(2)
      acceptRes.body.userid.should.be.equal(1)
      acceptRes.body.year.should.be.equal(constants.season.year)
      should.exist(acceptRes.body.offered)
      should.not.exist(acceptRes.body.cancelled)
      should.exist(acceptRes.body.accepted)
      should.not.exist(acceptRes.body.rejected)
      should.not.exist(acceptRes.body.vetoed)
      acceptRes.body.proposingTeamPlayers.should.be.eql(proposingTeamPlayers)
      acceptRes.body.acceptingTeamPlayers.should.be.eql(acceptingTeamPlayers)

      const rows = await knex('rosters_players').whereIn(
        'pid',
        proposingTeamPlayers.concat(acceptingTeamPlayers)
      )

      rows.length.should.equal(2)
      const proposingRow = rows.find((p) => p.tid === 1)
      const acceptingRow = rows.find((p) => p.tid === 2)
      proposingRow.pid.should.equal(acceptingTeamPlayers[0])
      acceptingRow.pid.should.equal(proposingTeamPlayers[0])

      const res = await chai_request.execute(server)
        .post('/api/teams/1/deactivate')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          deactivate_pid: player2.pid,
          leagueId
        })

      res.should.have.status(200)
      // eslint-disable-next-line
      res.should.be.json

      res.body.tid.should.equal(teamId)
      res.body.pid.should.equal(player2.pid)
      res.body.slot.should.equal(constants.slots.PS)
      res.body.transaction.userid.should.equal(userId)
      res.body.transaction.tid.should.equal(teamId)
      res.body.transaction.lid.should.equal(leagueId)
      res.body.transaction.pid.should.equal(player2.pid)
      res.body.transaction.type.should.equal(
        constants.transactions.ROSTER_DEACTIVATE
      )
      res.body.transaction.value.should.equal(value)
      res.body.transaction.year.should.equal(constants.season.year)
      res.body.transaction.timestamp.should.equal(Math.round(Date.now() / 1000))

      // verify poach is cancelled
      const poaches = await knex('poaches')
      expect(poaches.length).to.equal(1)
      // eslint-disable-next-line
      expect(poaches[0].processed).to.exist
      expect(poaches[0].succ).to.equal(false)
      expect(poaches[0].reason).to.equal('Player traded')

      const rosterRows = await knex('rosters_players')
        .where({
          year: constants.season.year,
          week: constants.season.week,
          pid: player2.pid
        })
        .limit(1)

      const rosterRow = rosterRows[0]
      expect(rosterRow.slot).to.equal(constants.slots.PS)

      await checkLastTransaction({
        leagueId,
        type: constants.transactions.ROSTER_DEACTIVATE,
        value,
        year: constants.season.year,
        pid: player2.pid,
        teamId,
        userId
      })
    })

    // check to make sure cutlist players are removed
  })

  // trade with release players, make sure transactions are created

  // one for one trade

  // two for one trade with release

  // one for two trade with release

  // one for one pick exchange

  // two for one pick exchange

  // two players for two picks and two releases

  // three for one with no release (has room)

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
        pid: player1.pid,
        player_tid: teamId,
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

      const proposingTeamPlayers = [player1.pid]
      const acceptingTeamPlayers = [player2.pid]
      const request = chai_request.execute(server)
        .post('/api/leagues/1/trades')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          proposingTeamPlayers,
          acceptingTeamPlayers,
          propose_tid: 1,
          accept_tid: 2,
          leagueId: 1
        })

      await error(request, 'player has poaching claim')
    })

    it('deadline has passed', async function () {
      MockDate.set(constants.season.start.add('13', 'weeks').toISOString())
      const request = chai_request.execute(server)
        .post('/api/leagues/1/trades')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          proposingTeamPlayers: [],
          acceptingTeamPlayers: [],
          propose_tid: 1,
          accept_tid: 2,
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
  // - invalid release
  // - teamId doesn't belong to userId
  // - release player not on team
  // - player not on team
  // - some players not on team
  // - some release players not on team
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
