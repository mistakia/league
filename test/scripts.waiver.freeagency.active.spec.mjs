/* global describe before beforeEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'
import knex from '#db'

import league from '#db/fixtures/league.mjs'
import { current_season, transaction_types, waiver_types } from '#constants'
import { Errors, epoch_to_timestamptz } from '#libs-shared'
import {
  selectPlayer,
  checkLastTransaction,
  checkRoster
} from './utils/index.mjs'
import run from '#scripts/process-waivers-free-agency-active.mjs'

process.env.NODE_ENV = 'test'

chai.should()
const expect = chai.expect
const { regular_season_start } = current_season

describe('SCRIPTS /waivers - free agency - active roster', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
  })

  describe('process', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      MockDate.set(regular_season_start.subtract('1', 'month').toISOString())
      await league(knex)
    })

    it('process single faab waiver', async () => {
      MockDate.set(regular_season_start.add('1', 'month').day(4).toISOString())
      const player = await selectPlayer()
      const teamId = 1
      const leagueId = 1
      const value = 10
      await knex('waivers').insert({
        tid: teamId,
        user_id: 1,
        lid: leagueId,
        pid: player.pid,
        priority_order: 9999,
        submitted: new Date(),
        bid_amount: value,
        type: waiver_types.FREE_AGENCY
      })

      let error
      try {
        await run()
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      // check waivers
      const waivers = await knex('waivers')
      expect(waivers.length).to.equal(1)
      expect(waivers[0].pid).to.equal(player.pid)
      expect(waivers[0].is_successful).to.equal(true)
      expect(waivers[0].reason).to.equal(null)
      expect(waivers[0].processed.getTime()).to.equal(Date.now())
      expect(waivers[0].cancelled).to.equal(null)

      // check team waiver order
      const teams = await knex('teams').where({
        lid: 1,
        season_year: current_season.year
      })
      const team1 = teams.find((t) => t.team_id === 1)
      const team2 = teams.find((t) => t.team_id === 2)
      const team3 = teams.find((t) => t.team_id === 3)
      const team4 = teams.find((t) => t.team_id === 4)
      expect(team1.waiver_order).to.equal(1)
      expect(team2.waiver_order).to.equal(2)
      expect(team3.waiver_order).to.equal(3)
      expect(team4.waiver_order).to.equal(4)

      // verify roster
      await checkRoster({
        teamId,
        pid: player.pid,
        leagueId
      })

      // verify transaction
      await checkLastTransaction({
        leagueId,
        pid: player.pid,
        teamId,
        userId: 1,
        value,
        type: transaction_types.ROSTER_ADD
      })

      // verify team faab budget
      expect(team1.free_agent_acquisition_budget_balance).to.equal(200 - value)
    })

    it('process multiple faab waivers', async () => {
      MockDate.set(regular_season_start.add('1', 'month').day(4).toISOString())
      const leagueId = 1
      const exclude_pids = []
      const player1 = await selectPlayer()
      exclude_pids.push(player1.pid)
      const value1 = 180
      await knex('waivers').insert({
        tid: 1,
        user_id: 1,
        lid: leagueId,
        pid: player1.pid,
        priority_order: 9999,
        submitted: new Date(),
        bid_amount: value1,
        type: waiver_types.FREE_AGENCY
      })

      await knex('waivers').insert({
        tid: 2,
        user_id: 1,
        lid: leagueId,
        pid: player1.pid,
        priority_order: 9999,
        submitted: new Date(),
        bid_amount: 80,
        type: waiver_types.FREE_AGENCY
      })

      const player2 = await selectPlayer({ exclude_pids })
      exclude_pids.push(player2.pid)
      const value2 = 80
      await knex('waivers').insert({
        tid: 2,
        user_id: 1,
        lid: leagueId,
        pid: player2.pid,
        priority_order: 9999,
        submitted: new Date(),
        bid_amount: value2,
        type: waiver_types.FREE_AGENCY
      })

      const player3 = await selectPlayer({ exclude_pids })
      exclude_pids.push(player3.pid)
      const value3 = 20
      await knex('waivers').insert({
        tid: 1,
        user_id: 1,
        lid: leagueId,
        pid: player3.pid,
        priority_order: 9999,
        submitted: new Date(),
        bid_amount: 30,
        type: waiver_types.FREE_AGENCY
      })
      await knex('waivers').insert({
        tid: 2,
        user_id: 1,
        lid: leagueId,
        pid: player3.pid,
        priority_order: 9999,
        submitted: new Date(),
        bid_amount: value3,
        type: waiver_types.FREE_AGENCY
      })

      const player4 = await selectPlayer({ exclude_pids })
      exclude_pids.push(player4.pid)
      const value4 = 2
      await knex('waivers').insert({
        tid: 1,
        user_id: 1,
        lid: leagueId,
        pid: player4.pid,
        priority_order: 9999,
        submitted: new Date(),
        bid_amount: value4,
        type: waiver_types.FREE_AGENCY
      })
      await knex('waivers').insert({
        tid: 4,
        user_id: 1,
        lid: leagueId,
        pid: player4.pid,
        priority_order: 9999,
        submitted: new Date(),
        bid_amount: value4,
        type: waiver_types.FREE_AGENCY
      })

      let error
      try {
        await run()
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      // check waivers
      const waivers = await knex('waivers').orderBy('uid')
      expect(waivers.length).to.equal(7)
      expect(waivers[0].pid).to.equal(player1.pid)
      expect(waivers[0].is_successful).to.equal(true)
      expect(waivers[0].reason).to.equal(null)
      expect(waivers[0].processed.getTime()).to.equal(Date.now())
      expect(waivers[0].cancelled).to.equal(null)

      expect(waivers[1].is_successful).to.equal(false)
      expect(waivers[1].reason).to.equal('Player already claimed')
      expect(waivers[1].pid).to.equal(player1.pid)

      expect(waivers[2].is_successful).to.equal(true)
      expect(waivers[2].reason).to.equal(null)
      expect(waivers[2].pid).to.equal(player2.pid)

      expect(waivers[3].is_successful).to.equal(false)
      expect(waivers[3].reason).to.equal(
        'exceeds available free agent auction budget'
      )
      expect(waivers[3].pid).to.equal(player3.pid)

      expect(waivers[4].is_successful).to.equal(true)
      expect(waivers[4].reason).to.equal(null)
      expect(waivers[4].pid).to.equal(player3.pid)

      expect(waivers[5].is_successful).to.equal(true)
      expect(waivers[5].reason).to.equal(null)
      expect(waivers[5].pid).to.equal(player4.pid)

      expect(waivers[6].is_successful).to.equal(false)
      expect(waivers[6].reason).to.equal('Player already claimed')
      expect(waivers[6].pid).to.equal(player4.pid)

      // check team waiver order
      const teams = await knex('teams').where({
        lid: 1,
        season_year: current_season.year
      })
      const team1 = teams.find((t) => t.team_id === 1)
      const team2 = teams.find((t) => t.team_id === 2)
      const team3 = teams.find((t) => t.team_id === 3)
      const team4 = teams.find((t) => t.team_id === 4)
      expect(team1.waiver_order).to.equal(12)
      expect(team2.waiver_order).to.equal(1)
      expect(team3.waiver_order).to.equal(2)
      expect(team4.waiver_order).to.equal(3)

      // verify roster
      await checkRoster({
        teamId: 1,
        pid: player1.pid,
        leagueId
      })

      await checkRoster({
        teamId: 2,
        pid: player2.pid,
        leagueId
      })

      await checkRoster({
        teamId: 2,
        pid: player3.pid,
        leagueId
      })

      await checkRoster({
        teamId: 1,
        pid: player4.pid,
        leagueId
      })

      // verify transactions
      const transactions = await knex('transactions')
        .where('lid', leagueId)
        .orderBy('uid')
      expect(transactions.length).to.equal(4)
      expect(transactions[0].pid).to.equal(player1.pid)
      expect(transactions[0].tid).to.equal(1)
      expect(transactions[0].player_salary).to.equal(value1)
      expect(transactions[0].type).to.equal(transaction_types.ROSTER_ADD)

      expect(transactions[1].pid).to.equal(player2.pid)
      expect(transactions[1].tid).to.equal(2)
      expect(transactions[1].player_salary).to.equal(value2)
      expect(transactions[1].type).to.equal(transaction_types.ROSTER_ADD)

      expect(transactions[2].pid).to.equal(player3.pid)
      expect(transactions[2].tid).to.equal(2)
      expect(transactions[2].player_salary).to.equal(value3)
      expect(transactions[2].type).to.equal(transaction_types.ROSTER_ADD)

      expect(transactions[3].pid).to.equal(player4.pid)
      expect(transactions[3].tid).to.equal(1)
      expect(transactions[3].player_salary).to.equal(value4)
      expect(transactions[3].type).to.equal(transaction_types.ROSTER_ADD)
    })

    it('no waivers ready to process', async () => {
      MockDate.set(regular_season_start.add('1', 'month').day(4).toISOString())
      const player = await selectPlayer()
      const leagueId = 1
      await knex('transactions').insert({
        user_id: 2,
        tid: 2,
        lid: leagueId,
        pid: player.pid,
        type: transaction_types.ROSTER_RELEASE,
        player_salary: 0,
        week: current_season.week,
        season_year: current_season.year,
        occurred_at: epoch_to_timestamptz(Math.round(Date.now() / 1000))
      })

      const teamId = 1
      const value = 10
      await knex('waivers').insert({
        tid: teamId,
        user_id: 1,
        lid: leagueId,
        pid: player.pid,
        priority_order: 9999,
        submitted: new Date(),
        bid_amount: value,
        type: waiver_types.FREE_AGENCY
      })

      let error
      try {
        await run()
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      const waivers = await knex('waivers').orderBy('uid')
      expect(waivers.length).to.equal(1)
      expect(waivers[0].pid).to.equal(player.pid)
      expect(waivers[0].is_successful).to.equal(null)
      expect(waivers[0].reason).to.equal(null)
      expect(waivers[0].processed).to.equal(null)
      expect(waivers[0].cancelled).to.equal(null)
    })
  })

  describe('errors', function () {
    beforeEach(async function () {
      this.timeout(60 * 1000)
      MockDate.set(regular_season_start.subtract('1', 'month').toISOString())
      await league(knex)
    })

    it('no waivers to process', async () => {
      MockDate.set(regular_season_start.add('1', 'month').day(4).toISOString())
      let error
      try {
        await run()
      } catch (err) {
        error = err
      }

      expect(error).to.be.instanceof(Errors.EmptyFreeAgencyWaivers)
      expect(error.message).to.equal('no free agency waivers to process')
    })

    it('release player not on team', async () => {
      // TODO
    })

    it('exceeds roster limits', async () => {
      // TODO
    })

    it('exceeds faab', async () => {
      // TODO
    })
  })
})
