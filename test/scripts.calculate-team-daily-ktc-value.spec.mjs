/* global describe before beforeEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'
import dayjs from 'dayjs'

import knex from '#db'
import { transaction_types } from '#constants'
import calculate_team_daily_ktc_value, {
  price_every_league
} from '#scripts/calculate-team-daily-ktc-value.mjs'
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

const insert_transaction = async ({ transaction_id, tid, pid, type, date }) =>
  knex('transactions').insert({
    transaction_id,
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
        transaction_id: 101,
        tid: 1,
        pid: 'PLAY-ONE-000001',
        type: transaction_types.DRAFT,
        date: day_one
      })
      await insert_transaction({
        transaction_id: 102,
        tid: 2,
        pid: 'PLAY-TWO-000002',
        type: transaction_types.DRAFT,
        date: day_one
      })
      await insert_transaction({
        transaction_id: 103,
        tid: 3,
        pid: 'PLAY-THRE-000003',
        type: transaction_types.DRAFT,
        date: day_one
      })
      await insert_transaction({
        transaction_id: 104,
        tid: 3,
        pid: 'PLAY-FOUR-000004',
        type: transaction_types.DRAFT,
        date: day_one
      })

      // day two: team 1 trades PLAY-ONE to team 2
      await insert_transaction({
        transaction_id: 105,
        tid: 1,
        pid: 'PLAY-ONE-000001',
        type: transaction_types.TRADE,
        date: day_two
      })
      await knex('trades').insert({
        trade_id: 1,
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
        transaction_id: 106,
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
        transaction_id: 201,
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
        transaction_id: 202,
        tid: 1,
        pid: 'PLAY-ONE-000001',
        type: transaction_types.DRAFT,
        date: day_one
      })
      await insert_transaction({
        transaction_id: 203,
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

  // The driver, not the replay. A league whose transaction log contradicts
  // itself makes the replay THROW rather than return a shortfall, and before
  // this was isolated that throw escaped the loop and cost every league after
  // it -- which is how the auction mirror left league 1 unpriced for four days.
  describe('one league failing', function () {
    beforeEach(async function () {
      await knex('leagues').whereIn('league_id', [901, 902]).del()
      for (const league_id of [901, 902]) {
        await knex('leagues').insert({
          league_id,
          commissioner_user_id: 1,
          name: `league ${league_id}`,
          is_hosted: true
        })
      }
    })

    it('prices the other leagues and reports the thrower', async function () {
      const priced = []
      const shortfalls = await price_every_league({
        price: async ({ lid: league_lid }) => {
          if (league_lid === 901) throw new Error('no rfa signing for X__Y')
          priced.push(league_lid)
          return { lid: league_lid, shortfall: null }
        }
      })

      // The league AFTER the thrower still got priced -- the whole point.
      expect(priced).to.include(902)
      expect(priced).to.not.include(901)

      // And the failure is still reported, so the run exits non-zero.
      const thrown = shortfalls.filter((s) => s.includes('lid=901'))
      expect(thrown).to.have.length(1)
      expect(thrown[0]).to.contain('no rfa signing for X__Y')
    })

    it('reports a shortfall without swallowing it', async function () {
      const shortfalls = await price_every_league({
        price: async ({ lid: league_lid }) => ({
          lid: league_lid,
          shortfall: league_lid === 902 ? 'staleness on 902' : null
        })
      })
      expect(shortfalls).to.include('staleness on 902')
    })
  })

  // THE ONE INSTANT THE REST OF THIS FILE DELIBERATELY AVOIDS.
  //
  // The dates at the top are "chosen well away from a DST transition so the
  // node-local transaction dates and the UTC-session observation dates name the
  // same calendar day" -- which is an accurate description of a blind spot. Every
  // other test here picks local noon, where no timezone can disagree about the
  // day, so none of them could ever have caught a lookup that compares a
  // postgres-rendered date against a node-rendered one.
  //
  // A restricted free agency tag is matched to the bid that justifies it on
  // (pid, calendar day). The signing's day used to be rendered by postgres in
  // the SESSION timezone while the transaction's was rendered by dayjs in the
  // PROCESS timezone, so any signing between midnight in one zone and midnight
  // in the other resolved to two different days and the lookup missed. In
  // production that threw `no restricted free agency signing found` on two of
  // league 1's tags and left the whole league unpriced.
  //
  // 02:30Z is 21:30 the PREVIOUS day in America/New_York, which is the zone this
  // suite runs in. So this is the case, and it fails outright without the fix.
  describe('a signing whose instant falls on different days in different zones', function () {
    const tag_instant = '2024-03-01T02:30:00Z'
    const pid = 'PLAY-ONE-000001'

    // The day the replay files this transaction under, derived the same way the
    // replay derives it rather than written as a literal. It is 2024-02-29 --
    // the day BEFORE the instant's UTC date, which is the whole point of the
    // case and the reason a hand-written `day_one` here would miss.
    const tag_day = dayjs(tag_instant).format('YYYY-MM-DD')

    beforeEach(async function () {
      await knex('restricted_free_agency_bids').where({ lid }).del()
      await knex('restricted_free_agency_nominations')
        .where({ league_id: lid })
        .del()

      // Team 2 wins the player away from team 1, so both sides of the transfer
      // are exercised rather than a same-team re-signing that never reads
      // original_team_id.
      await knex('restricted_free_agency_nominations').insert({
        nomination_id: 9001,
        league_id: lid,
        player_id: pid,
        season_year: year,
        original_team_id: 1,
        nominated_at: tag_instant,
        announced_at: tag_instant,
        processed_at: tag_instant,
        winning_bid_id: 9001
      })
      await knex('restricted_free_agency_bids').insert({
        bid_id: 9001,
        pid,
        user_id: 1,
        bid_amount: 10,
        tid: 2,
        season_year: year,
        lid,
        is_successful: true,
        submitted: tag_instant,
        processed: tag_instant,
        // Load-bearing: original_team_id reaches the replay only through the
        // nomination, joined on this column. Leaving it null makes the losing
        // team resolve to null and the run throws for an unrelated reason.
        nomination_id: 9001
      })

      await knex('transactions').insert({
        transaction_id: 9001,
        user_id: 1,
        tid: 2,
        lid,
        pid,
        type: transaction_types.RESTRICTED_FREE_AGENCY_TAG,
        player_salary: 10,
        week: 1,
        season_year: year,
        occurred_at: tag_instant
      })
      await insert_valuation({
        pid,
        date: tag_day,
        keeptradecut_value: 1000
      })
    })

    it('resolves the signing rather than throwing on the day it renders as', async function () {
      // Before the fix this rejects with `no restricted free agency signing
      // found for PLAY-ONE-000001__2024-02-29` -- the node-rendered day --
      // while the signing sits in the index under the postgres-rendered
      // 2024-03-01.
      await calculate_team_daily_ktc_value({ lid })

      // Not-throwing is necessary and not sufficient: a refactor that turned
      // the missing-signing throw into a `continue` would keep this green while
      // every cross-team transfer silently stopped moving the player. So assert
      // the transfer the signing encodes actually happened -- team 2 won the
      // player and carries his value, team 1 lost him and carries none.
      const rows = await get_rows(tag_day)
      const by_team = new Map(rows.map((row) => [row.tid, row.ktc_value]))
      expect(by_team.get(2)).to.equal(1000)
      expect(by_team.get(1)).to.equal(0)

      // THE INPUT HAS TO BE ABLE TO FAIL, and asserting that the instant spans
      // SOME zone boundary is not enough to establish that. What the fix is
      // about is the two RENDERERS disagreeing, so ask both of them, here,
      // against whatever database this run is actually pointed at.
      //
      // That distinction is load-bearing rather than pedantic. `test:db:up`
      // only starts a container when nothing is already serving the port, so
      // the suite can land on a Postgres somebody else configured. Against one
      // running `timezone = America/New_York` both renderers would agree, the
      // pre-fix code would pass too, and this test would certify a fix it never
      // exercised -- silently, and in the direction that looks like success.
      const [rendered] = await knex('restricted_free_agency_bids')
        .where({ lid, is_successful: true })
        .select(
          'processed',
          knex.raw("TO_CHAR(processed, 'YYYY-MM-DD') AS postgres_day")
        )
      const node_day = dayjs(rendered.processed).format('YYYY-MM-DD')
      expect(
        rendered.postgres_day,
        'this database renders the fixture instant the same day node does, so the test cannot tell the fix from its absence'
      ).to.not.equal(node_day)

      // And the day the replay filed it under is node's, not postgres's.
      expect(tag_day).to.equal(node_day)
    })
  })
})
