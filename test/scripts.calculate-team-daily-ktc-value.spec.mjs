/* global describe before beforeEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'
import dayjs from 'dayjs'

import knex from '#db'
import { transaction_types } from '#constants'
import calculate_team_daily_ktc_value from '#scripts/calculate-team-daily-ktc-value.mjs'
import { epoch_to_timestamptz } from '#libs-shared'

process.env.NODE_ENV = 'test'

chai.should()
const expect = chai.expect

const lid = 1
const year = 2024

// Chosen well away from a DST transition so the node-local transaction dates and
// the UTC-session observation dates name the same calendar day.
const day_one = '2024-03-01'
const day_two = '2024-03-02'
const day_three = '2024-03-03'

const local_noon = (date) => dayjs(`${date} 12:00:00`).unix()
const observed_at = (date) => `${date}T12:00:00Z`

const insert_transaction = async ({ uid, tid, pid, type, date }) =>
  knex('transactions').insert({
    uid,
    user_id: 1,
    tid,
    lid,
    pid,
    type,
    player_salary: 0,
    week: 1,
    season_year: year,
    occurred_at: epoch_to_timestamptz(local_noon(date))
  })

const insert_valuation = async ({ pid, date, keeptradecut_value }) =>
  knex('keeptradecut_valuations').insert({
    pid,
    is_superflex: true,
    observed_at: observed_at(date),
    keeptradecut_value
  })

const get_rows = async (date) =>
  knex('league_team_daily_values').where({ lid, date }).orderBy('tid', 'asc')

describe('SCRIPTS - calculate team daily ktc value', function () {
  this.timeout(60 * 1000)

  before(async function () {
    MockDate.set(dayjs(`${day_three} 18:00:00`).toISOString())
  })

  beforeEach(async function () {
    for (const table of [
      'league_team_daily_values',
      'keeptradecut_valuations',
      'trades_transactions',
      'trades_players',
      'trades_picks',
      'trades',
      'transactions',
      'teams'
    ]) {
      await knex(table).del()
    }

    for (const team_id of [1, 2, 3]) {
      await knex('teams').insert({
        team_id,
        season_year: year,
        lid,
        name: `team ${team_id}`,
        abbreviation: `T${team_id}`,
        salary_cap: 200,
        free_agent_acquisition_budget_balance: 200
      })
    }
  })

  describe('roster reconstruction', function () {
    beforeEach(async function () {
      // day one: each team drafts. PLAY-FOUR is never ranked by keeptradecut.
      await insert_transaction({
        uid: 101,
        tid: 1,
        pid: 'PLAY-ONE-000001',
        type: transaction_types.DRAFT,
        date: day_one
      })
      await insert_transaction({
        uid: 102,
        tid: 2,
        pid: 'PLAY-TWO-000002',
        type: transaction_types.DRAFT,
        date: day_one
      })
      await insert_transaction({
        uid: 103,
        tid: 3,
        pid: 'PLAY-THRE-000003',
        type: transaction_types.DRAFT,
        date: day_one
      })
      await insert_transaction({
        uid: 104,
        tid: 3,
        pid: 'PLAY-FOUR-000004',
        type: transaction_types.DRAFT,
        date: day_one
      })

      // day two: team 1 trades PLAY-ONE to team 2
      await insert_transaction({
        uid: 105,
        tid: 1,
        pid: 'PLAY-ONE-000001',
        type: transaction_types.TRADE,
        date: day_two
      })
      await knex('trades').insert({
        uid: 1,
        propose_tid: 1,
        accept_tid: 2,
        lid,
        user_id: 1,
        season_year: year,
        offered: epoch_to_timestamptz(local_noon(day_two)),
        accepted: epoch_to_timestamptz(local_noon(day_two))
      })
      await knex('trades_players').insert({
        trade_id: 1,
        tid: 1,
        pid: 'PLAY-ONE-000001'
      })
      await knex('trades_transactions').insert({
        trade_id: 1,
        transaction_id: 105
      })

      // day three: an unrelated add, which is what makes day two emit
      await insert_transaction({
        uid: 106,
        tid: 1,
        pid: 'PLAY-FIVE-000005',
        type: transaction_types.DRAFT,
        date: day_three
      })

      // PLAY-ONE has no observation on day two -- an interior gap in an
      // otherwise continuous series, not a departure from the ranked universe.
      await insert_valuation({
        pid: 'PLAY-ONE-000001',
        date: day_one,
        keeptradecut_value: 1000
      })
      await insert_valuation({
        pid: 'PLAY-ONE-000001',
        date: day_three,
        keeptradecut_value: 1000
      })
      for (const date of [day_one, day_two, day_three]) {
        await insert_valuation({
          pid: 'PLAY-TWO-000002',
          date,
          keeptradecut_value: 500
        })
        await insert_valuation({
          pid: 'PLAY-THRE-000003',
          date,
          keeptradecut_value: 200
        })
      }
    })

    it('values day one from the end-of-day roster', async function () {
      await calculate_team_daily_ktc_value({ lid })

      const rows = await get_rows(day_one)
      rows.length.should.equal(3)
      rows[0].ktc_value.should.equal(1000)
      rows[1].ktc_value.should.equal(500)
      rows[2].ktc_value.should.equal(200)
    })

    it('applies an accepted trade to both rosters', async function () {
      await calculate_team_daily_ktc_value({ lid })

      const rows = await get_rows(day_two)
      const by_tid = Object.fromEntries(rows.map((row) => [row.tid, row]))

      // PLAY-ONE left team 1 and its carried-forward 1000 lands on team 2
      by_tid[1].ktc_value.should.equal(0)
      by_tid[2].ktc_value.should.equal(1500)
      by_tid[3].ktc_value.should.equal(200)
    })

    it('carries a valuation forward across an interior series gap', async function () {
      await calculate_team_daily_ktc_value({ lid })

      const rows = await get_rows(day_two)
      const day_total = rows.reduce((acc, row) => acc + row.ktc_value, 0)

      // 1000 + 500 + 200, with PLAY-FOUR and PLAY-FIVE contributing nothing
      // because keeptradecut does not rank them at all
      day_total.should.equal(1700)
    })

    it('emits a row for a team whose value is zero', async function () {
      await calculate_team_daily_ktc_value({ lid })

      const rows = await get_rows(day_two)
      rows.length.should.equal(3)

      const zero_row = rows.find((row) => row.tid === 1)
      expect(zero_row).to.not.equal(undefined)
      zero_row.ktc_value.should.equal(0)
      Number(zero_row.ktc_share).should.equal(0)
    })

    it('computes shares against the full team population', async function () {
      await calculate_team_daily_ktc_value({ lid })

      for (const date of [day_one, day_two]) {
        const rows = await get_rows(date)
        const share_total = rows.reduce(
          (acc, row) => acc + Number(row.ktc_share),
          0
        )
        // ktc_share is numeric(6,5), so each row rounds to five decimal places
        share_total.should.be.closeTo(1, 1e-4)
      }
    })

    it('emits the final transaction own day', async function () {
      // The replay emits a day only on a date TRANSITION, so the last date it
      // sees has nothing following it to trigger the emission. Left unflushed,
      // the newest written day trails the last transaction by one — which is
      // what desynchronized the trailing-gap filler (anchored on the last
      // transaction) from the staleness oracle (anchored on max(date)) and
      // fired signal #125844 as a false alarm. day_three carries the fixture's
      // last transaction, so it is the day that used to go missing.
      await calculate_team_daily_ktc_value({ lid })

      const rows = await get_rows(day_three)
      rows.length.should.equal(
        3,
        'the last transaction own day was not emitted'
      )

      const max_date = await knex('league_team_daily_values')
        .where({ lid })
        .max('date as max_date')
        .first()
      dayjs(max_date.max_date).format('YYYY-MM-DD').should.equal(day_three)
    })
  })

  describe('absent teams', function () {
    it('throws naming the team and transaction on an add for an unknown team', async function () {
      await insert_transaction({
        uid: 201,
        tid: 99,
        pid: 'PLAY-ONE-000001',
        type: transaction_types.DRAFT,
        date: day_one
      })

      let error
      try {
        await calculate_team_daily_ktc_value({ lid })
      } catch (err) {
        error = err
      }

      expect(error).to.not.equal(undefined)
      error.message.should.include('team 99')
      error.message.should.include('roster add')
      error.message.should.include('201')
    })

    it('tolerates a release for a decommissioned team', async function () {
      await insert_transaction({
        uid: 202,
        tid: 1,
        pid: 'PLAY-ONE-000001',
        type: transaction_types.DRAFT,
        date: day_one
      })
      await insert_transaction({
        uid: 203,
        tid: 99,
        pid: 'PLAY-ONE-000001',
        type: transaction_types.ROSTER_RELEASE,
        date: day_two
      })

      await insert_valuation({
        pid: 'PLAY-ONE-000001',
        date: day_one,
        keeptradecut_value: 1000
      })

      const result = await calculate_team_daily_ktc_value({ lid })
      expect(result.lid).to.equal(lid)
    })
  })
})
