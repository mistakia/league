/* global describe before it beforeEach afterEach */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'
import MockDate from 'mockdate'

import server from '#api'
import knex from '#db'
import league from '#db/fixtures/league.mjs'
import draft from '#db/fixtures/draft.mjs'
import {
  current_season,
  roster_slot_types,
  transaction_types
} from '#constants'
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

// Pick one player of the SAME position from each of teams 1 and 2, so a
// one-for-one BENCH swap is position-neutral.
//
// The draft fixture fills rosters at random and the league fixture caps DST
// and K at 3 apiece. An arbitrary pair can therefore hand the receiving team a
// fourth player at a capped position, and has_bench_space_for_position rejects
// the ACCEPT with 400 'No active roster space available for this position' --
// a flake that fires on roughly 1 run in 100 and reads as an unrelated
// regression on whatever commit CI happened to be testing.
//
// Both halves matter. Matching the two positions keeps the count the removal
// frees equal to the count the addition consumes. Requiring the roster row's
// player_position to agree with player.primary_position keeps those two
// counts on the same basis: the draft fixture writes
// rosters_players.player_position from secondary_position while
// validate_trade_slot_assignment reads primary_position, and a handful of
// players in the seed pool differ across the two.
const select_tradeable_pair = async () => {
  const roster_players_for_team = (tid) =>
    knex('rosters_players')
      .select('rosters_players.pid', 'rosters_players.player_position')
      .join('player', 'player.pid', 'rosters_players.pid')
      .where({
        'rosters_players.lid': 1,
        'rosters_players.tid': tid,
        'rosters_players.season_year': current_season.year,
        'rosters_players.week': current_season.week
      })
      .whereRaw('player.primary_position = rosters_players.player_position')

  const proposing_pool = await roster_players_for_team(1)
  const accepting_pool = await roster_players_for_team(2)

  const accepting_positions = new Set(
    accepting_pool.map((p) => p.player_position)
  )
  const proposing_row = proposing_pool.find((p) =>
    accepting_positions.has(p.player_position)
  )
  if (!proposing_row) {
    throw new Error('no shared position between team 1 and team 2 rosters')
  }
  const accepting_row = accepting_pool.find(
    (p) => p.player_position === proposing_row.player_position
  )

  return [proposing_row, accepting_row]
}

describe('API /trades', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
  })

  // MockDate is process-global, so a frozen clock left set here leaks into
  // whatever spec file mocha loads next. The 'deadline has passed' test below
  // advances 13 weeks past regular_season_start, which makes every later trade
  // proposal fail its own deadline check. CI's alphabetical order happens to put
  // trade-veto ahead of this file, so it does not fire today -- but running
  // `trade.spec.mjs trade-veto.spec.mjs` in that order fails trade-veto's
  // "returns players to their original rosters" with a 400, and any --grep run
  // or future spec sorting after this one inherits the same clock.
  afterEach(function () {
    MockDate.reset()
  })

  describe('post', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      await league(knex)
    })

    it('one-for-one player trade', async () => {
      await draft(knex)

      const [proposing_row, accepting_row] = await select_tradeable_pair()

      const proposingTeamPlayers = [proposing_row.pid]
      const acceptingTeamPlayers = [accepting_row.pid]

      // set values to zero
      await knex('transactions')
        .whereIn('pid', proposingTeamPlayers.concat(acceptingTeamPlayers))
        .update('player_salary', 0)

      // TODO - get trading player values

      // Proposing team sets slots for players they receive (from accepting team)
      const proposing_team_slots = {}
      proposing_team_slots[acceptingTeamPlayers[0]] = roster_slot_types.BENCH

      // Accepting team sets slots for players they receive (from proposing team)
      const accepting_team_slots = {}
      accepting_team_slots[proposingTeamPlayers[0]] = roster_slot_types.BENCH

      const proposeRes = await chai_request
        .execute(server)
        .post('/api/leagues/1/trades')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          proposingTeamPlayers,
          acceptingTeamPlayers,
          proposing_team_slots,
          accepting_team_slots,
          propose_tid: 1,
          accept_tid: 2,
          leagueId: 1
        })

      proposeRes.should.have.status(200)

      proposeRes.should.be.json
      proposeRes.body.propose_tid.should.be.equal(1)
      proposeRes.body.accept_tid.should.be.equal(2)
      proposeRes.body.userid.should.be.equal(1)
      proposeRes.body.season_year.should.be.equal(current_season.year)
      should.exist(proposeRes.body.offered)
      should.not.exist(proposeRes.body.cancelled)
      should.not.exist(proposeRes.body.accepted)
      should.not.exist(proposeRes.body.rejected)
      should.not.exist(proposeRes.body.vetoed)
      proposeRes.body.proposingTeamPlayers.should.be.eql(proposingTeamPlayers)
      proposeRes.body.acceptingTeamPlayers.should.be.eql(acceptingTeamPlayers)
      proposeRes.body.proposingTeamSlots.should.be.eql(proposing_team_slots)
      proposeRes.body.acceptingTeamSlots.should.be.eql(accepting_team_slots)

      const tradeid = proposeRes.body.uid

      // Verify slot assignments stored in database
      const stored_slots = await knex('trades_slots').where({
        trade_uid: tradeid
      })
      stored_slots.length.should.equal(
        proposingTeamPlayers.length + acceptingTeamPlayers.length
      )

      const acceptRes = await chai_request
        .execute(server)
        .post(`/api/leagues/1/trades/${tradeid}/accept`)
        .set('Authorization', `Bearer ${user2}`)

      acceptRes.should.have.status(200)

      acceptRes.should.be.json
      acceptRes.body.propose_tid.should.be.equal(1)
      acceptRes.body.accept_tid.should.be.equal(2)
      acceptRes.body.userid.should.be.equal(1)
      acceptRes.body.season_year.should.be.equal(current_season.year)
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

    it('trade preserves extension counts', async () => {
      await draft(knex)

      const [proposing_row, accepting_row] = await select_tradeable_pair()

      const proposingTeamPlayers = [proposing_row.pid]
      const acceptingTeamPlayers = [accepting_row.pid]

      // Set extension counts for both players
      await knex('rosters_players')
        .where({ pid: proposingTeamPlayers[0], tid: 1 })
        .update({ extensions: 3 })

      await knex('rosters_players')
        .where({ pid: acceptingTeamPlayers[0], tid: 2 })
        .update({ extensions: 2 })

      // Proposing team sets slots for players they receive (from accepting team)
      const proposing_team_slots = {}
      for (const pid of acceptingTeamPlayers) {
        proposing_team_slots[pid] = roster_slot_types.BENCH
      }

      // Accepting team sets slots for players they receive (from proposing team)
      const accepting_team_slots = {}
      for (const pid of proposingTeamPlayers) {
        accepting_team_slots[pid] = roster_slot_types.BENCH
      }

      // Create trade proposal
      const proposalRes = await chai_request
        .execute(server)
        .post('/api/leagues/1/trades')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          proposingTeamPlayers,
          acceptingTeamPlayers,
          proposing_team_slots,
          accepting_team_slots,
          propose_tid: 1,
          accept_tid: 2,
          leagueId: 1
        })

      proposalRes.should.have.status(200)
      should.exist(proposalRes.body.uid)
      proposalRes.body.proposingTeamSlots.should.be.eql(proposing_team_slots)
      proposalRes.body.acceptingTeamSlots.should.be.eql(accepting_team_slots)

      const tradeid = proposalRes.body.uid

      // Verify slot assignments stored in database
      const stored_slots = await knex('trades_slots').where({
        trade_uid: tradeid
      })
      stored_slots.length.should.equal(
        proposingTeamPlayers.length + acceptingTeamPlayers.length
      )

      // Accept trade
      const acceptRes = await chai_request
        .execute(server)
        .post(`/api/leagues/1/trades/${tradeid}/accept`)
        .set('Authorization', `Bearer ${user2}`)

      acceptRes.should.have.status(200)

      // Verify extension counts are preserved
      const proposingPlayerAfterTrade = await knex('rosters_players')
        .where({
          pid: proposingTeamPlayers[0],
          tid: 2,
          season_year: current_season.year,
          week: current_season.week
        })
        .first()

      const acceptingPlayerAfterTrade = await knex('rosters_players')
        .where({
          pid: acceptingTeamPlayers[0],
          tid: 1,
          season_year: current_season.year,
          week: current_season.week
        })
        .first()

      // Verify extensions preserved
      proposingPlayerAfterTrade.extensions.should.equal(3)
      acceptingPlayerAfterTrade.extensions.should.equal(2)
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
        slot: roster_slot_types.PS,
        transaction: transaction_types.DRAFT
      })

      await knex('poaches').insert({
        userid: 3,
        tid: 3,
        lid: 1,
        pid: player1.pid,
        player_tid: teamId,
        submitted: new Date()
      })

      // active player
      await knex('rosters_players')
        .update('slot', roster_slot_types.BENCH)
        .where('pid', player1.pid)
      await knex('transactions').insert({
        userid: userId,
        tid: teamId,
        lid: leagueId,
        pid: player1.pid,
        type: transaction_types.ROSTER_ACTIVATE,
        player_salary: 0,
        week: current_season.week,
        season_year: current_season.year,
        // This activation must read as EARLIER than the trade and deactivate
        // the test performs next. Rounding to an epoch second can round UP,
        // putting the fixture up to half a second in the future and making it
        // the last transaction.
        occurred_at: new Date()
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
        slot: roster_slot_types.PS,
        transaction: transaction_types.DRAFT,
        value
      })

      const proposingTeamPlayers = [player1.pid]
      const acceptingTeamPlayers = [player2.pid]

      // Proposing team sets slots for players they receive (from accepting team)
      const proposing_team_slots = {}
      for (const pid of acceptingTeamPlayers) {
        proposing_team_slots[pid] = roster_slot_types.BENCH
      }

      // Accepting team sets slots for players they receive (from proposing team)
      const accepting_team_slots = {}
      for (const pid of proposingTeamPlayers) {
        accepting_team_slots[pid] = roster_slot_types.BENCH
      }

      const proposeRes = await chai_request
        .execute(server)
        .post('/api/leagues/1/trades')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          proposingTeamPlayers,
          acceptingTeamPlayers,
          proposing_team_slots,
          accepting_team_slots,
          propose_tid: 1,
          accept_tid: 2,
          leagueId: 1
        })

      proposeRes.should.have.status(200)

      proposeRes.should.be.json
      proposeRes.body.propose_tid.should.be.equal(1)
      proposeRes.body.accept_tid.should.be.equal(2)
      proposeRes.body.userid.should.be.equal(1)
      proposeRes.body.season_year.should.be.equal(current_season.year)
      should.exist(proposeRes.body.offered)
      should.not.exist(proposeRes.body.cancelled)
      should.not.exist(proposeRes.body.accepted)
      should.not.exist(proposeRes.body.rejected)
      should.not.exist(proposeRes.body.vetoed)
      proposeRes.body.proposingTeamPlayers.should.be.eql(proposingTeamPlayers)
      proposeRes.body.acceptingTeamPlayers.should.be.eql(acceptingTeamPlayers)
      proposeRes.body.proposingTeamSlots.should.be.eql(proposing_team_slots)
      proposeRes.body.acceptingTeamSlots.should.be.eql(accepting_team_slots)

      const tradeid = proposeRes.body.uid

      // Verify slot assignments stored in database
      const stored_slots = await knex('trades_slots').where({
        trade_uid: tradeid
      })
      stored_slots.length.should.equal(
        proposingTeamPlayers.length + acceptingTeamPlayers.length
      )

      const acceptRes = await chai_request
        .execute(server)
        .post(`/api/leagues/1/trades/${tradeid}/accept`)
        .set('Authorization', `Bearer ${user2}`)

      acceptRes.should.have.status(200)

      acceptRes.should.be.json
      acceptRes.body.propose_tid.should.be.equal(1)
      acceptRes.body.accept_tid.should.be.equal(2)
      acceptRes.body.userid.should.be.equal(1)
      acceptRes.body.season_year.should.be.equal(current_season.year)
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

      const res = await chai_request
        .execute(server)
        .post('/api/teams/1/deactivate')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          deactivate_pid: player2.pid,
          leagueId
        })

      res.should.have.status(200)

      res.should.be.json

      res.body.tid.should.equal(teamId)
      res.body.pid.should.equal(player2.pid)
      res.body.slot.should.equal(roster_slot_types.PS)
      res.body.transaction.userid.should.equal(userId)
      res.body.transaction.tid.should.equal(teamId)
      res.body.transaction.lid.should.equal(leagueId)
      res.body.transaction.pid.should.equal(player2.pid)
      res.body.transaction.type.should.equal(
        transaction_types.ROSTER_DEACTIVATE
      )
      res.body.transaction.player_salary.should.equal(value)
      res.body.transaction.season_year.should.equal(current_season.year)
      // The server stamps the transaction while handling the request and the
      // assertion reads the clock after the response, so an exact equality
      // fails whenever a second boundary falls between the two. Reproduced
      // once in 30 isolated runs of this file.
      expect(
        Math.round(new Date(res.body.transaction.occurred_at).getTime() / 1000)
      ).to.be.closeTo(Math.round(Date.now() / 1000), 2)

      // verify poach is cancelled
      const poaches = await knex('poaches')
      expect(poaches.length).to.equal(1)

      expect(poaches[0].processed).to.exist
      expect(poaches[0].is_successful).to.equal(false)
      expect(poaches[0].reason).to.equal('Player traded')

      const rosterRows = await knex('rosters_players')
        .where({
          season_year: current_season.year,
          week: current_season.week,
          pid: player2.pid
        })
        .limit(1)

      const rosterRow = rosterRows[0]
      expect(rosterRow.slot).to.equal(roster_slot_types.PS)

      await checkLastTransaction({
        leagueId,
        type: transaction_types.ROSTER_DEACTIVATE,
        value,
        year: current_season.year,
        pid: player2.pid,
        teamId,
        userId
      })
    })

    it('trade with practice squad slot assignments', async () => {
      // Add two practice squad players
      const player1 = await selectPlayer({ rookie: true })
      const player2 = await selectPlayer({
        rookie: true,
        exclude_pids: [player1.pid]
      })

      await addPlayer({
        teamId: 1,
        leagueId: 1,
        userId: 1,
        player: player1,
        slot: roster_slot_types.PS,
        transaction: transaction_types.DRAFT
      })

      await addPlayer({
        teamId: 2,
        leagueId: 1,
        userId: 2,
        player: player2,
        slot: roster_slot_types.PS,
        transaction: transaction_types.DRAFT
      })

      const proposingTeamPlayers = [player1.pid]
      const acceptingTeamPlayers = [player2.pid]

      // Proposing team assigns player2 (receiving from accepting team) to practice squad
      const proposing_team_slots = {}
      proposing_team_slots[player2.pid] = roster_slot_types.PS

      // Accepting team assigns player1 (receiving from proposing team) to bench
      const accepting_team_slots = {}
      accepting_team_slots[player1.pid] = roster_slot_types.BENCH

      const proposeRes = await chai_request
        .execute(server)
        .post('/api/leagues/1/trades')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          proposingTeamPlayers,
          acceptingTeamPlayers,
          proposing_team_slots,
          accepting_team_slots,
          propose_tid: 1,
          accept_tid: 2,
          leagueId: 1
        })

      proposeRes.should.have.status(200)
      proposeRes.body.proposingTeamSlots.should.be.eql(proposing_team_slots)
      proposeRes.body.acceptingTeamSlots.should.be.eql(accepting_team_slots)

      const tradeid = proposeRes.body.uid

      // Verify slot assignments in database
      const stored_slots = await knex('trades_slots').where({
        trade_uid: tradeid
      })
      stored_slots.length.should.equal(2)

      const proposing_slot = stored_slots.find((s) => s.tid === 1)
      proposing_slot.pid.should.equal(player2.pid)
      proposing_slot.slot.should.equal(roster_slot_types.PS)

      const accepting_slot = stored_slots.find((s) => s.tid === 2)
      accepting_slot.pid.should.equal(player1.pid)
      accepting_slot.slot.should.equal(roster_slot_types.BENCH)

      // Accept trade (accepting team can override their slot if desired)
      const acceptRes = await chai_request
        .execute(server)
        .post(`/api/leagues/1/trades/${tradeid}/accept`)
        .set('Authorization', `Bearer ${user2}`)

      acceptRes.should.have.status(200)

      // Verify players moved to correct teams with correct slots
      const rosterRows = await knex('rosters_players')
        .whereIn('pid', [player1.pid, player2.pid])
        .where({ season_year: current_season.year, week: current_season.week })

      rosterRows.length.should.equal(2)

      const player1_row = rosterRows.find((r) => r.pid === player1.pid)
      const player2_row = rosterRows.find((r) => r.pid === player2.pid)

      // Player1 went to team 2 (accepting team) with BENCH slot
      player1_row.tid.should.equal(2)
      player1_row.slot.should.equal(roster_slot_types.BENCH)

      // Player2 went to team 1 (proposing team) with PS slot
      player2_row.tid.should.equal(1)
      player2_row.slot.should.equal(roster_slot_types.PS)
    })

    it('accepting team can override slot assignments', async () => {
      const player1 = await selectPlayer({ rookie: true })
      const player2 = await selectPlayer({
        rookie: true,
        exclude_pids: [player1.pid]
      })

      await addPlayer({
        teamId: 1,
        leagueId: 1,
        userId: 1,
        player: player1,
        slot: roster_slot_types.PS,
        transaction: transaction_types.DRAFT
      })

      await addPlayer({
        teamId: 2,
        leagueId: 1,
        userId: 2,
        player: player2,
        slot: roster_slot_types.PS,
        transaction: transaction_types.DRAFT
      })

      const proposingTeamPlayers = [player1.pid]
      const acceptingTeamPlayers = [player2.pid]

      // Initial slot assignments
      const proposing_team_slots = {}
      proposing_team_slots[player2.pid] = roster_slot_types.PS

      const accepting_team_slots = {}
      accepting_team_slots[player1.pid] = roster_slot_types.PS

      const proposeRes = await chai_request
        .execute(server)
        .post('/api/leagues/1/trades')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          proposingTeamPlayers,
          acceptingTeamPlayers,
          proposing_team_slots,
          accepting_team_slots,
          propose_tid: 1,
          accept_tid: 2,
          leagueId: 1
        })

      proposeRes.should.have.status(200)
      const tradeid = proposeRes.body.uid

      // Accepting team overrides their slot assignment to BENCH
      const accepting_team_slot_override = {}
      accepting_team_slot_override[player1.pid] = roster_slot_types.BENCH

      const acceptRes = await chai_request
        .execute(server)
        .post(`/api/leagues/1/trades/${tradeid}/accept`)
        .set('Authorization', `Bearer ${user2}`)
        .send({
          accepting_team_slots: accepting_team_slot_override
        })

      acceptRes.should.have.status(200)

      // Verify player1 was assigned to BENCH (overridden from PS)
      const player1_row = await knex('rosters_players')
        .where({
          pid: player1.pid,
          tid: 2,
          season_year: current_season.year,
          week: current_season.week
        })
        .first()

      player1_row.slot.should.equal(roster_slot_types.BENCH)

      // Verify player2 kept original PS assignment (proposing team slots are immutable)
      const player2_row = await knex('rosters_players')
        .where({
          pid: player2.pid,
          tid: 1,
          season_year: current_season.year,
          week: current_season.week
        })
        .first()

      player2_row.slot.should.equal(roster_slot_types.PS)
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
        slot: roster_slot_types.PS,
        transaction: transaction_types.DRAFT
      })

      await knex('poaches').insert({
        userid: 3,
        tid: 3,
        lid: 1,
        pid: player1.pid,
        player_tid: teamId,
        submitted: new Date()
      })

      const player2 = await selectPlayer({ rookie: true })
      await addPlayer({
        teamId: 2,
        leagueId,
        userId: 2,
        player: player2,
        slot: roster_slot_types.PS,
        transaction: transaction_types.DRAFT
      })

      const proposingTeamPlayers = [player1.pid]
      const acceptingTeamPlayers = [player2.pid]

      // Proposing team sets slots for players they receive (from accepting team)
      const proposing_team_slots = {}
      for (const pid of acceptingTeamPlayers) {
        proposing_team_slots[pid] = roster_slot_types.BENCH
      }

      // Accepting team sets slots for players they receive (from proposing team)
      const accepting_team_slots = {}
      for (const pid of proposingTeamPlayers) {
        accepting_team_slots[pid] = roster_slot_types.BENCH
      }

      const request = chai_request
        .execute(server)
        .post('/api/leagues/1/trades')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          proposingTeamPlayers,
          acceptingTeamPlayers,
          proposing_team_slots,
          accepting_team_slots,
          propose_tid: 1,
          accept_tid: 2,
          leagueId: 1
        })

      await error(request, 'player has poaching claim')
    })

    it('deadline has passed', async function () {
      MockDate.set(
        current_season.regular_season_start.add('13', 'weeks').toISOString()
      )
      const request = chai_request
        .execute(server)
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
