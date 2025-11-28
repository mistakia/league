/* global describe before it beforeEach */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'
import MockDate from 'mockdate'

import server from '#api'
import knex from '#db'
import league from '#db/seeds/league.mjs'
import {
  current_season,
  roster_slot_types,
  transaction_types,
  player_nfl_status,
  player_nfl_injury_status
} from '#constants'
import { user1, user2 } from './fixtures/token.mjs'
import {
  addPlayer,
  selectPlayer,
  checkLastTransaction,
  notLoggedIn,
  missing,
  invalid,
  error,
  fillRoster
} from './utils/index.mjs'

process.env.NODE_ENV = 'test'

chai.should()
chai.use(chai_http)
const expect = chai.expect
const { regular_season_start } = current_season

// Track used player IDs across tests to avoid duplicate game collisions
const used_pids = []

// Helper to select a player and track it to avoid collisions
async function select_player_with_tracking(options = {}) {
  const player = await selectPlayer({
    ...options,
    exclude_pids: [...used_pids, ...(options.exclude_pids || [])]
  })
  used_pids.push(player.pid)
  return player
}

describe('API /teams - reserve', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
  })

  describe('post', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      await league(knex)
    })

    it('move player to reserve - short term reserve', async () => {
      MockDate.set(
        regular_season_start.clone().subtract('1', 'week').toISOString()
      )
      const player = await select_player_with_tracking()
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const value = 2
      await addPlayer({
        teamId,
        leagueId,
        userId,
        player,
        slot: roster_slot_types.BENCH,
        transaction: transaction_types.DRAFT,
        value
      })

      await knex('player')
        .update({
          nfl_status: player_nfl_status.INJURED_RESERVE
        })
        .where({
          pid: player.pid
        })

      const res = await chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          reserve_pid: player.pid,
          leagueId,
          slot: roster_slot_types.RESERVE_SHORT_TERM
        })

      res.should.have.status(200)

      res.should.be.json

      res.body.tid.should.equal(teamId)
      res.body.pid.should.equal(player.pid)
      res.body.slot.should.equal(roster_slot_types.RESERVE_SHORT_TERM)
      res.body.transaction.userid.should.equal(userId)
      res.body.transaction.tid.should.equal(teamId)
      res.body.transaction.lid.should.equal(leagueId)
      res.body.transaction.pid.should.equal(player.pid)
      res.body.transaction.type.should.equal(transaction_types.RESERVE_IR)
      res.body.transaction.value.should.equal(value)
      res.body.transaction.year.should.equal(current_season.year)
      res.body.transaction.timestamp.should.equal(Math.round(Date.now() / 1000))

      const rosterRows = await knex('rosters_players')
        .where({
          year: current_season.year,
          week: current_season.week,
          pid: player.pid
        })
        .limit(1)

      const rosterRow = rosterRows[0]
      expect(rosterRow.slot).to.equal(roster_slot_types.RESERVE_SHORT_TERM)

      await checkLastTransaction({
        leagueId,
        type: transaction_types.RESERVE_IR,
        value,
        year: current_season.year,
        pid: player.pid,
        teamId,
        userId
      })
    })

    it('move player from reserve/ir to reserve/cov', async () => {
      // TODO
    })

    // move player to reserve/cov with full reserve slots
  })

  describe('errors', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      await league(knex)
    })

    it('not logged in', async () => {
      const request = chai_request.execute(server).post('/api/teams/1/reserve')
      await notLoggedIn(request)
    })

    it('missing reserve_pid', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          slot: roster_slot_types.RESERVE_SHORT_TERM
        })

      await missing(request, 'reserve_pid')
    })

    it('missing leagueId', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          reserve_pid: 'x',
          slot: roster_slot_types.RESERVE_SHORT_TERM
        })

      await missing(request, 'leagueId')
    })

    it('missing slot', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          reserve_pid: 'x'
        })

      await missing(request, 'slot')
    })

    it('invalid slot', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          reserve_pid: 'x',
          slot: 'x'
        })

      await invalid(request, 'slot')
    })

    it('invalid player - non-existant', async () => {
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          reserve_pid: 'x',
          slot: roster_slot_types.RESERVE_SHORT_TERM
        })

      await invalid(request, 'player')
    })

    it('invalid player - not on active roster', async () => {
      const player = await select_player_with_tracking()
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          reserve_pid: player.pid,
          slot: roster_slot_types.RESERVE_SHORT_TERM
        })

      await error(request, 'player not on roster')
    })

    it('teamId does not belong to userId', async () => {
      const player = await select_player_with_tracking()
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user2}`)
        .send({
          leagueId: 1,
          reserve_pid: player.pid,
          slot: roster_slot_types.RESERVE_SHORT_TERM
        })

      await invalid(request, 'teamId')
    })

    it('player already on reserve/ir', async () => {
      const player = await select_player_with_tracking()
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const value = 2
      await addPlayer({
        teamId,
        leagueId,
        userId,
        player,
        slot: roster_slot_types.RESERVE_SHORT_TERM,
        transaction: transaction_types.DRAFT,
        value
      })
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          reserve_pid: player.pid,
          slot: roster_slot_types.RESERVE_SHORT_TERM
        })

      await error(request, 'player already on reserve')
    })

    it('player already on reserve/cov', async () => {
      const player = await select_player_with_tracking()
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const value = 2
      await addPlayer({
        teamId,
        leagueId,
        userId,
        player,
        slot: roster_slot_types.COV,
        transaction: transaction_types.DRAFT,
        value
      })
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          reserve_pid: player.pid,
          slot: roster_slot_types.COV
        })

      await error(request, 'player already on reserve')
    })

    it('player not on reserve/short term reserve', async () => {
      MockDate.set(regular_season_start.clone().add('1', 'week').toISOString())
      const player = await select_player_with_tracking({
        injury_status: null,
        nfl_status: player_nfl_status.ACTIVE
      })
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const value = 2
      await addPlayer({
        teamId,
        leagueId,
        userId,
        player,
        slot: roster_slot_types.BENCH,
        transaction: transaction_types.DRAFT,
        value
      })
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          reserve_pid: player.pid,
          slot: roster_slot_types.RESERVE_SHORT_TERM
        })

      await error(request, 'player not eligible for Reserve')
    })

    it('player not on reserve/cov - no status', async () => {
      const player = await select_player_with_tracking()
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const value = 2
      await addPlayer({
        teamId,
        leagueId,
        userId,
        player,
        slot: roster_slot_types.BENCH,
        transaction: transaction_types.DRAFT,
        value
      })
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          reserve_pid: player.pid,
          slot: roster_slot_types.COV
        })

      await error(request, 'player not eligible for Reserve/COV')
    })

    it('player not on reserve/cov - ir', async () => {
      MockDate.set(regular_season_start.clone().add('1', 'week').toISOString())
      const player = await select_player_with_tracking()
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const value = 2
      await addPlayer({
        teamId,
        leagueId,
        userId,
        player,
        slot: roster_slot_types.BENCH,
        transaction: transaction_types.DRAFT,
        value
      })
      await knex('player')
        .update({
          nfl_status: player_nfl_status.INJURED_RESERVE
        })
        .where({
          pid: player.pid
        })
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          reserve_pid: player.pid,
          slot: roster_slot_types.COV
        })

      await error(request, 'player not eligible for Reserve/COV')
    })

    it('exceeds ir roster limits', async () => {
      MockDate.set(
        regular_season_start.clone().subtract('1', 'week').toISOString()
      )
      const teamId = 1
      const leagueId = 1
      await fillRoster({ leagueId, teamId })

      const players = await knex('rosters_players')
        .where({
          lid: leagueId,
          tid: teamId,
          week: current_season.week,
          year: current_season.year
        })
        .whereNot('slot', roster_slot_types.RESERVE_SHORT_TERM)
        .limit(1)

      const pid = players[0].pid
      await knex('player')
        .update({
          nfl_status: player_nfl_status.INJURED_RESERVE
        })
        .where({
          pid
        })
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          leagueId: 1,
          reserve_pid: pid,
          slot: roster_slot_types.RESERVE_SHORT_TERM
        })

      await error(request, 'exceeds roster limits')
    })

    it('player is a locked starter', async () => {
      // TODO
    })

    it('player is protected', async () => {
      const player = await select_player_with_tracking()
      await addPlayer({
        leagueId: 1,
        player,
        teamId: 1,
        userId: 1,
        slot: roster_slot_types.PSP
      })
      await knex('player')
        .update({
          nfl_status: player_nfl_status.INJURED_RESERVE
        })
        .where({
          pid: player.pid
        })
      const request = chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          reserve_pid: player.pid,
          slot: roster_slot_types.RESERVE_SHORT_TERM,
          leagueId: 1
        })

      await error(request, 'protected players are not reserve eligible')
    })

    it('player not rostered on previous week roster', async () => {
      MockDate.set(regular_season_start.clone().add('2', 'week').toISOString())
      const player = await select_player_with_tracking()
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const value = 2
      await addPlayer({
        teamId,
        leagueId,
        userId,
        player,
        slot: roster_slot_types.BENCH,
        transaction: transaction_types.ROSTER_ADD,
        value
      })

      await knex('player')
        .update({
          nfl_status: player_nfl_status.INJURED_RESERVE
        })
        .where({
          pid: player.pid
        })

      const request = chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          reserve_pid: player.pid,
          leagueId,
          slot: roster_slot_types.RESERVE_SHORT_TERM
        })

      await error(request, 'not eligible, not rostered long enough')
    })

    it('practice squad player without active poaching claim', async () => {
      const player = await select_player_with_tracking()
      await addPlayer({
        leagueId: 1,
        player,
        teamId: 1,
        userId: 1,
        slot: roster_slot_types.PS
      })
      await knex('player')
        .update({
          nfl_status: player_nfl_status.INJURED_RESERVE
        })
        .where({
          pid: player.pid
        })

      const request = chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          reserve_pid: player.pid,
          slot: roster_slot_types.RESERVE_SHORT_TERM,
          leagueId: 1
        })

      await error(
        request,
        'practice squad players can only be placed on reserve if they have an active poaching claim'
      )
    })

    it('practice squad drafted player without active poaching claim', async () => {
      const player = await select_player_with_tracking()
      await addPlayer({
        leagueId: 1,
        player,
        teamId: 1,
        userId: 1,
        slot: roster_slot_types.PSD
      })
      await knex('player')
        .update({
          nfl_status: player_nfl_status.INJURED_RESERVE
        })
        .where({
          pid: player.pid
        })

      const request = chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          reserve_pid: player.pid,
          slot: roster_slot_types.RESERVE_SHORT_TERM,
          leagueId: 1
        })

      await error(
        request,
        'practice squad players can only be placed on reserve if they have an active poaching claim'
      )
    })
  })

  describe('historical grace period', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      await league(knex)
      // Clean up test games and related gamelogs to avoid duplicate key constraints
      // Delete games with v='OPP' (test opponent) for current season year
      const test_game_esbids = await knex('nfl_games')
        .select('esbid')
        .where('year', current_season.year)
        .where('v', 'OPP')

      if (test_game_esbids.length > 0) {
        const esbids = test_game_esbids.map((row) => row.esbid)

        // Delete player_gamelogs first (foreign key constraint)
        await knex('player_gamelogs').whereIn('esbid', esbids).del()

        // Then delete games
        await knex('nfl_games').whereIn('esbid', esbids).del()
      }
    })

    it('player with prior week OUT status eligible before final practice day', async () => {
      // Set to week 2, Tuesday (early in the week, before Friday final practice)
      MockDate.set(regular_season_start.clone().add('2', 'week').toISOString())

      const player = await select_player_with_tracking({ pos: 'RB' })
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const value = 2

      // Update player to ACTIVE with no injury status
      await knex('player')
        .update({
          nfl_status: player_nfl_status.ACTIVE,
          injury_status: null
        })
        .where({ pid: player.pid })

      // Create prior week roster so the "not rostered long enough" check has data
      const prior_week = current_season.week - 1
      const prior_roster_result = await knex('rosters')
        .insert({
          tid: teamId,
          lid: leagueId,
          week: prior_week,
          year: current_season.year
        })
        .returning('uid')

      const prior_roster_uid =
        prior_roster_result[0].uid || prior_roster_result[0]

      // Add player to prior week roster
      await knex('rosters_players').insert({
        rid: prior_roster_uid,
        pid: player.pid,
        slot: roster_slot_types.BENCH,
        pos: player.pos,
        tid: teamId,
        lid: leagueId,
        week: prior_week,
        year: current_season.year
      })

      // Add player to roster (will be added to current week 5 roster)
      // Use TRADE to bypass "not rostered long enough" check
      await addPlayer({
        teamId,
        leagueId,
        userId,
        player,
        slot: roster_slot_types.BENCH,
        transaction: transaction_types.TRADE,
        value
      })

      // Create prior week's game (week 4)
      const prior_week_esbid = `${current_season.year}${String(prior_week).padStart(2, '0')}99`

      await knex('nfl_games').insert({
        esbid: prior_week_esbid,
        week: prior_week,
        year: current_season.year,
        day: 'SUN',
        seas_type: 'REG',
        h: player.current_nfl_team,
        v: 'OPP',
        timestamp: Math.round(Date.now() / 1000) - 7 * 24 * 60 * 60 // 1 week ago from mocked date
      })

      // Create gamelog for prior week with active = false (player was inactive)
      await knex('player_gamelogs').insert({
        esbid: prior_week_esbid,
        pid: player.pid,
        tm: player.current_nfl_team,
        opp: 'OPP',
        pos: player.pos,
        year: current_season.year,
        active: false
      })

      // Add current week game schedule
      const current_week_esbid = `${current_season.year}${String(current_season.week).padStart(2, '0')}10`

      // Calculate game date/time (Sunday 1PM EST, 3 days from mocked Tuesday)
      const gameDate = current_season.now.add(5, 'day') // Tuesday + 5 = Sunday

      await knex('nfl_games').insert({
        esbid: current_week_esbid,
        week: current_season.week,
        year: current_season.year,
        day: 'SUN',
        seas_type: 'REG',
        h: player.current_nfl_team,
        v: 'OPP',
        date: gameDate.format('YYYY/MM/DD'),
        time_est: '13:00:00',
        timestamp: Math.round(Date.now() / 1000) + 3 * 24 * 60 * 60 // 3 days from now (Sunday)
      })

      const res = await chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          reserve_pid: player.pid,
          leagueId,
          slot: roster_slot_types.RESERVE_SHORT_TERM
        })

      res.should.have.status(200)
      res.body.pid.should.equal(player.pid)
      res.body.slot.should.equal(roster_slot_types.RESERVE_SHORT_TERM)

      MockDate.reset()
    })

    it('player with prior week OUT not eligible after final practice day when cleared', async () => {
      // Set to week 5, Friday (late in the week, on or after Friday final practice day)
      // regular_season_start is Tuesday, so +3 days = Friday
      MockDate.set(
        regular_season_start.clone().add(5, 'week').add(3, 'day').toISOString()
      )

      const player = await select_player_with_tracking({ pos: 'WR' })
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const value = 2

      // Update player to ACTIVE with no injury status
      await knex('player')
        .update({
          nfl_status: player_nfl_status.ACTIVE,
          injury_status: null
        })
        .where({ pid: player.pid })

      // Add player to roster (will be added to current week 5 roster)
      // Use TRADE to bypass "not rostered long enough" check
      await addPlayer({
        teamId,
        leagueId,
        userId,
        player,
        slot: roster_slot_types.BENCH,
        transaction: transaction_types.TRADE,
        value
      })

      // Create prior week's game (week 4)
      const prior_week = current_season.week - 1
      const prior_week_esbid = `${current_season.year}${String(prior_week).padStart(2, '0')}98`

      await knex('nfl_games').insert({
        esbid: prior_week_esbid,
        week: prior_week,
        year: current_season.year,
        day: 'SUN',
        seas_type: 'REG',
        h: player.current_nfl_team,
        v: 'OPP',
        timestamp: 1640000000 // Static timestamp for prior week game
      })

      // Create gamelog for prior week with active = false (player was inactive)
      await knex('player_gamelogs').insert({
        esbid: prior_week_esbid,
        pid: player.pid,
        tm: player.current_nfl_team,
        opp: 'OPP',
        pos: player.pos,
        year: current_season.year,
        active: false
      })

      // Add current week game schedule for Sunday game with unique esbid
      const current_week_esbid = `${current_season.year}${String(current_season.week).padStart(2, '0')}21`
      const gameDate = current_season.now.add(2, 'day') // Friday + 2 = Sunday

      await knex('nfl_games').insert({
        esbid: current_week_esbid,
        week: current_season.week,
        year: current_season.year,
        day: 'SUN',
        seas_type: 'REG',
        h: player.current_nfl_team,
        v: 'OPP',
        date: gameDate.format('YYYY/MM/DD'),
        time_est: '13:00:00',
        timestamp: 1640700000 // Static timestamp for current week game
      })

      const request = chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          reserve_pid: player.pid,
          leagueId,
          slot: roster_slot_types.RESERVE_SHORT_TERM
        })

      await error(request, 'player not eligible for Reserve')

      MockDate.reset()
    })

    it('player with prior week OUT and current QUESTIONABLE not eligible after final practice day', async () => {
      // Set to week 5, Friday (late in the week, on or after Friday final practice day)
      // regular_season_start is Tuesday, so +3 days = Friday
      MockDate.set(
        regular_season_start.clone().add(5, 'week').add(3, 'day').toISOString()
      )

      const player = await select_player_with_tracking()
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const value = 2

      // Update player to ACTIVE with QUESTIONABLE injury status
      await knex('player')
        .update({
          nfl_status: player_nfl_status.ACTIVE,
          injury_status: player_nfl_injury_status.QUESTIONABLE
        })
        .where({ pid: player.pid })

      // Add player to roster (will be added to current week 5 roster)
      // Use TRADE to bypass "not rostered long enough" check
      await addPlayer({
        teamId,
        leagueId,
        userId,
        player,
        slot: roster_slot_types.BENCH,
        transaction: transaction_types.TRADE,
        value
      })

      // Create prior week's game (week 4)
      const prior_week = current_season.week - 1
      const prior_week_esbid = `${current_season.year}${String(prior_week).padStart(2, '0')}97`

      await knex('nfl_games').insert({
        esbid: prior_week_esbid,
        week: prior_week,
        year: current_season.year,
        day: 'SUN',
        seas_type: 'REG',
        h: player.current_nfl_team,
        v: 'OPP',
        timestamp: 1640000000 // Static timestamp for prior week game
      })

      // Create gamelog for prior week with active = false (player was inactive)
      await knex('player_gamelogs').insert({
        esbid: prior_week_esbid,
        pid: player.pid,
        tm: player.current_nfl_team,
        opp: 'OPP',
        pos: player.pos,
        year: current_season.year,
        active: false
      })

      // Add current week game schedule for Sunday game with unique esbid
      const current_week_esbid = `${current_season.year}${String(current_season.week).padStart(2, '0')}31`
      const gameDate = current_season.now.add(2, 'day') // Friday + 2 = Sunday

      await knex('nfl_games').insert({
        esbid: current_week_esbid,
        week: current_season.week,
        year: current_season.year,
        day: 'SUN',
        seas_type: 'REG',
        h: player.current_nfl_team,
        v: 'OPP',
        date: gameDate.format('YYYY/MM/DD'),
        time_est: '13:00:00',
        timestamp: 1640700000 // Static timestamp for current week game
      })

      const request = chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          reserve_pid: player.pid,
          leagueId,
          slot: roster_slot_types.RESERVE_SHORT_TERM
        })

      await error(request, 'player not eligible for Reserve')

      MockDate.reset()
    })

    it('player with prior week OUT eligible before Wednesday for Thursday game', async () => {
      // Set to week 5, Tuesday (early in the week, before Wednesday final practice for Thursday game)
      // regular_season_start is already Tuesday, so week 5 = +5 weeks, +0 days
      MockDate.set(regular_season_start.clone().add(5, 'week').toISOString())

      const player = await select_player_with_tracking({ pos: 'QB' })
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const value = 2

      // Update player to ACTIVE with no injury status
      await knex('player')
        .update({
          nfl_status: player_nfl_status.ACTIVE,
          injury_status: null
        })
        .where({ pid: player.pid })

      // Add player to roster (will be added to current week 5 roster)
      // Use TRADE to bypass "not rostered long enough" check
      await addPlayer({
        teamId,
        leagueId,
        userId,
        player,
        slot: roster_slot_types.BENCH,
        transaction: transaction_types.TRADE,
        value
      })

      // Create prior week's game (week 4)
      const prior_week = current_season.week - 1
      const prior_week_esbid = `${current_season.year}${String(prior_week).padStart(2, '0')}96`

      await knex('nfl_games').insert({
        esbid: prior_week_esbid,
        week: prior_week,
        year: current_season.year,
        day: 'SUN',
        seas_type: 'REG',
        h: player.current_nfl_team,
        v: 'OPP',
        timestamp: 1640000000 // Static timestamp for prior week game
      })

      // Create gamelog for prior week with active = false (player was inactive)
      await knex('player_gamelogs').insert({
        esbid: prior_week_esbid,
        pid: player.pid,
        tm: player.current_nfl_team,
        opp: 'OPP',
        pos: player.pos,
        year: current_season.year,
        active: false
      })

      // Add current week game schedule for Thursday game with unique esbid
      const current_week_esbid = `${current_season.year}${String(current_season.week).padStart(2, '0')}41`
      const gameDate = current_season.now.add(2, 'day') // Tuesday + 2 = Thursday

      await knex('nfl_games').insert({
        esbid: current_week_esbid,
        week: current_season.week,
        year: current_season.year,
        day: 'THU',
        seas_type: 'REG',
        h: player.current_nfl_team,
        v: 'OPP',
        date: gameDate.format('YYYY/MM/DD'),
        time_est: '20:15:00',
        timestamp: 1640700000 // Static timestamp for current week game
      })

      const res = await chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          reserve_pid: player.pid,
          leagueId,
          slot: roster_slot_types.RESERVE_SHORT_TERM
        })

      res.should.have.status(200)
      res.body.pid.should.equal(player.pid)
      res.body.slot.should.equal(roster_slot_types.RESERVE_SHORT_TERM)

      MockDate.reset()
    })
  })

  describe('practice squad with active poach', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      await league(knex)
    })

    it('practice squad player with active poaching claim can be reserved', async () => {
      MockDate.set(
        regular_season_start.clone().subtract('1', 'week').toISOString()
      )
      const player = await select_player_with_tracking()
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const value = 2

      await addPlayer({
        teamId,
        leagueId,
        userId,
        player,
        slot: roster_slot_types.PS,
        transaction: transaction_types.DRAFT,
        value
      })

      // Create active poaching claim
      await knex('poaches').insert({
        userid: 2,
        tid: 2,
        lid: leagueId,
        pid: player.pid,
        player_tid: teamId,
        submitted: Math.round(Date.now() / 1000)
      })

      await knex('player')
        .update({
          nfl_status: player_nfl_status.INJURED_RESERVE
        })
        .where({
          pid: player.pid
        })

      const res = await chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          reserve_pid: player.pid,
          leagueId,
          slot: roster_slot_types.RESERVE_SHORT_TERM
        })

      res.should.have.status(200)
      res.should.be.json
      res.body.tid.should.equal(teamId)
      res.body.pid.should.equal(player.pid)
      res.body.slot.should.equal(roster_slot_types.RESERVE_SHORT_TERM)
    })

    it('practice squad drafted player with active poaching claim can be reserved', async () => {
      MockDate.set(
        regular_season_start.clone().subtract('1', 'week').toISOString()
      )
      const player = await select_player_with_tracking()
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const value = 2

      await addPlayer({
        teamId,
        leagueId,
        userId,
        player,
        slot: roster_slot_types.PSD,
        transaction: transaction_types.DRAFT,
        value
      })

      // Create active poaching claim
      await knex('poaches').insert({
        userid: 2,
        tid: 2,
        lid: leagueId,
        pid: player.pid,
        player_tid: teamId,
        submitted: Math.round(Date.now() / 1000)
      })

      await knex('player')
        .update({
          nfl_status: player_nfl_status.INJURED_RESERVE
        })
        .where({
          pid: player.pid
        })

      const res = await chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          reserve_pid: player.pid,
          leagueId,
          slot: roster_slot_types.RESERVE_SHORT_TERM
        })

      res.should.have.status(200)
      res.should.be.json
      res.body.tid.should.equal(teamId)
      res.body.pid.should.equal(player.pid)
      res.body.slot.should.equal(roster_slot_types.RESERVE_SHORT_TERM)
    })
  })

  describe('practice status eligibility', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      await league(knex)
    })

    it('player with DNP practice status should be eligible', async () => {
      MockDate.set(regular_season_start.clone().add('1', 'week').toISOString())
      const player = await select_player_with_tracking()
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const value = 2
      await addPlayer({
        teamId,
        leagueId,
        userId,
        player,
        slot: roster_slot_types.BENCH,
        transaction: transaction_types.TRADE,
        value
      })

      // Set player as ACTIVE with no injury status
      await knex('player')
        .update({
          nfl_status: player_nfl_status.ACTIVE,
          injury_status: null
        })
        .where({
          pid: player.pid
        })

      // Add DNP practice status
      await knex('practice').insert({
        pid: player.pid,
        week: current_season.week,
        year: current_season.year,
        w: 'DNP'
      })

      const res = await chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          reserve_pid: player.pid,
          leagueId,
          slot: roster_slot_types.RESERVE_SHORT_TERM
        })

      res.should.have.status(200)
      res.body.pid.should.equal(player.pid)
      res.body.slot.should.equal(roster_slot_types.RESERVE_SHORT_TERM)

      MockDate.reset()
    })

    it('player with LP practice status should be eligible', async () => {
      MockDate.set(regular_season_start.clone().add('1', 'week').toISOString())
      const player = await select_player_with_tracking()
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const value = 2
      await addPlayer({
        teamId,
        leagueId,
        userId,
        player,
        slot: roster_slot_types.BENCH,
        transaction: transaction_types.TRADE,
        value
      })

      // Set player as ACTIVE with no injury status
      await knex('player')
        .update({
          nfl_status: player_nfl_status.ACTIVE,
          injury_status: null
        })
        .where({
          pid: player.pid
        })

      // Add LP practice status
      await knex('practice').insert({
        pid: player.pid,
        week: current_season.week,
        year: current_season.year,
        th: 'LP'
      })

      const res = await chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          reserve_pid: player.pid,
          leagueId,
          slot: roster_slot_types.RESERVE_SHORT_TERM
        })

      res.should.have.status(200)
      res.body.pid.should.equal(player.pid)
      res.body.slot.should.equal(roster_slot_types.RESERVE_SHORT_TERM)

      MockDate.reset()
    })

    it('player with FULL practice status and no injury should not be eligible', async () => {
      MockDate.set(regular_season_start.clone().add('1', 'week').toISOString())
      const player = await select_player_with_tracking()
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const value = 2
      await addPlayer({
        teamId,
        leagueId,
        userId,
        player,
        slot: roster_slot_types.BENCH,
        transaction: transaction_types.TRADE,
        value
      })

      // Set player as ACTIVE with no injury status
      await knex('player')
        .update({
          nfl_status: player_nfl_status.ACTIVE,
          injury_status: null
        })
        .where({
          pid: player.pid
        })

      // Add FULL practice status
      await knex('practice').insert({
        pid: player.pid,
        week: current_season.week,
        year: current_season.year,
        w: 'FULL'
      })

      const request = chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          reserve_pid: player.pid,
          leagueId,
          slot: roster_slot_types.RESERVE_SHORT_TERM
        })

      await error(request, 'player not eligible for Reserve')

      MockDate.reset()
    })

    it('player with no practice data and OUT injury should be eligible', async () => {
      MockDate.set(regular_season_start.clone().add('1', 'week').toISOString())
      const player = await select_player_with_tracking()
      const teamId = 1
      const leagueId = 1
      const userId = 1
      const value = 2
      await addPlayer({
        teamId,
        leagueId,
        userId,
        player,
        slot: roster_slot_types.BENCH,
        transaction: transaction_types.TRADE,
        value
      })

      // Set player as ACTIVE with OUT injury status
      await knex('player')
        .update({
          nfl_status: player_nfl_status.ACTIVE,
          injury_status: player_nfl_injury_status.OUT
        })
        .where({
          pid: player.pid
        })

      // No practice data inserted

      const res = await chai_request
        .execute(server)
        .post('/api/teams/1/reserve')
        .set('Authorization', `Bearer ${user1}`)
        .send({
          reserve_pid: player.pid,
          leagueId,
          slot: roster_slot_types.RESERVE_SHORT_TERM
        })

      res.should.have.status(200)
      res.body.pid.should.equal(player.pid)
      res.body.slot.should.equal(roster_slot_types.RESERVE_SHORT_TERM)

      MockDate.reset()
    })
  })
})
