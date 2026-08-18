/* global describe before beforeEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'
import dayjs from 'dayjs'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import { transaction_types, current_season } from '#constants'
import calculate_team_daily_ktc_value from '#scripts/calculate-team-daily-ktc-value.mjs'
import { ASSET_TYPE } from '#libs-server/roster-asset-lineage/constants.mjs'
import { epoch_to_timestamptz } from '#libs-shared'

process.env.NODE_ENV = 'test'

chai.should()

const lid = 1

// Inside the season the league fixture builds, and well away from a DST
// transition, so the node-local transaction dates and the UTC-session
// observation dates name the same calendar day.
const day_one = '2026-03-01'
const day_two = '2026-03-02'
const day_three = '2026-03-03'

// ktc_pick_at resolves a pick against the last observation at or before
// MIDNIGHT UTC of the day being valued, so a series that starts on day one is
// not yet readable on day one. Seeding the day before is what makes day one a
// day the fixture can assert on rather than a silent null.
const day_before = '2026-02-28'

// Scoped to this file. keeptradecut registers pick rankings as synthetic
// players in `keeptradecut_pick`. Round 5 deliberately gets no row: the table
// constrains round to 1-4, and that absence is what makes a late pick
// unvaluable rather than a hole in the import.
const PICK_PID_ROUND_ONE = 'TEST-DAILYPICK-000001'
const PICK_PID_ROUND_TWO = 'TEST-DAILYPICK-000002'

const PICK_SLOT_MID = 2
const ROUND_ONE_VALUE = 4000
const ROUND_TWO_VALUE = 1000
const PLAYER_VALUE = 1000

// The league fixture builds the season the mocked clock is in; the picks under
// test belong to the following draft, as a future pick does.
let season_year
let pick_year
let league_format_id

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
    season_year,
    occurred_at: epoch_to_timestamptz(local_noon(date))
  })

const insert_keeptradecut_valuation = async ({
  pid,
  date,
  keeptradecut_value
}) =>
  knex('keeptradecut_valuations').insert({
    pid,
    is_superflex: true,
    observed_at: observed_at(date),
    keeptradecut_value
  })

// A pick holding as the roster-asset lineage records one: an ownership window
// carrying no `period_end` while the team still holds the pick.
const insert_pick_holding = async ({
  tid,
  pick_round,
  pick_draft_overall_position = null,
  period_start,
  period_end = null
}) =>
  knex('roster_asset_holding').insert({
    lid,
    tid,
    asset_type: ASSET_TYPE.PICK,
    pick_year,
    pick_round,
    pick_original_owner_tid: tid,
    pick_draft_overall_position,
    period_start: `${period_start} 12:00:00`,
    period_end: period_end ? `${period_end} 12:00:00` : null,
    league_format_id
  })

const get_rows = async (date) =>
  knex('league_team_daily_values').where({ lid, date }).orderBy('tid', 'asc')

const rows_by_team_id = async (date) =>
  Object.fromEntries((await get_rows(date)).map((row) => [row.tid, row]))

describe('SCRIPTS - calculate team daily ktc value - draft picks', function () {
  this.timeout(60 * 1000)

  before(async function () {
    MockDate.set(dayjs(`${day_three} 18:00:00`).toISOString())
  })

  beforeEach(async function () {
    // Builds the league, its `seasons` row and its teams, and clears
    // roster_asset_holding along with every other league-scoped table.
    await league(knex)

    season_year = current_season.year
    const season = await knex('seasons').where({ lid, season_year }).first()
    league_format_id = season.league_format_id

    // The pick's own season decides the league size its overall position is
    // bucketed against, so give that season a row of its own rather than
    // letting the calculation fall back.
    pick_year = season_year + 1
    await knex('seasons').insert({ ...season, season_year: pick_year })

    await knex('league_team_daily_values').where({ lid }).del()
    await knex('keeptradecut_valuations').del()
    await knex('keeptradecut_pick').del()

    for (const [pid, round, value] of [
      [PICK_PID_ROUND_ONE, 1, ROUND_ONE_VALUE],
      [PICK_PID_ROUND_TWO, 2, ROUND_TWO_VALUE]
    ]) {
      await knex('keeptradecut_pick').insert({
        pid,
        ktc_player_id: 900000 + round,
        ktc_player_name: pid,
        season_year: pick_year,
        round,
        slot: PICK_SLOT_MID,
        created_at: new Date(),
        updated_at: new Date()
      })
      for (const date of [day_before, day_one, day_two, day_three]) {
        await insert_keeptradecut_valuation({
          pid,
          date,
          keeptradecut_value: value
        })
      }
    }

    // One ranked player on team 1, so the player half of the calculation is
    // non-zero and the two shares can be told apart. A day is emitted when the
    // NEXT day's first transaction arrives, so each day under test needs a
    // transaction of its own and one more has to follow it.
    await insert_transaction({
      transaction_id: 301,
      tid: 1,
      pid: 'PLAY-ONE-000001',
      type: transaction_types.DRAFT,
      date: day_one
    })
    await insert_transaction({
      transaction_id: 302,
      tid: 4,
      pid: 'PLAY-TWO-000002',
      type: transaction_types.DRAFT,
      date: day_two
    })
    await insert_transaction({
      transaction_id: 303,
      tid: 4,
      pid: 'PLAY-THRE-000003',
      type: transaction_types.DRAFT,
      date: day_three
    })
    for (const date of [day_one, day_two, day_three]) {
      await insert_keeptradecut_valuation({
        pid: 'PLAY-ONE-000001',
        date,
        keeptradecut_value: PLAYER_VALUE
      })
    }
  })

  it('adds a held pick to pick_value and total_value', async function () {
    await insert_pick_holding({ tid: 2, pick_round: 1, period_start: day_one })

    await calculate_team_daily_ktc_value({ lid })

    const by_tid = await rows_by_team_id(day_two)
    by_tid[2].pick_value.should.equal(ROUND_ONE_VALUE)
    by_tid[2].ktc_value.should.equal(0)
    by_tid[2].total_value.should.equal(ROUND_ONE_VALUE)

    by_tid[1].pick_value.should.equal(0)
    by_tid[1].ktc_value.should.equal(PLAYER_VALUE)
    by_tid[1].total_value.should.equal(PLAYER_VALUE)
  })

  it('leaves ktc_value and ktc_share as the player-only series', async function () {
    await insert_pick_holding({ tid: 2, pick_round: 1, period_start: day_one })

    await calculate_team_daily_ktc_value({ lid })

    const by_tid = await rows_by_team_id(day_two)
    // team 1 is the entire player market that day, so its player-only share is
    // 1 even though it holds a minority of the league's total value
    Number(by_tid[1].ktc_share).should.equal(1)
    Number(by_tid[2].ktc_share).should.equal(0)
    Number(by_tid[1].total_share).should.be.closeTo(
      PLAYER_VALUE / (PLAYER_VALUE + ROUND_ONE_VALUE),
      1e-4
    )
  })

  it('computes total_share against the day total including picks', async function () {
    await insert_pick_holding({ tid: 2, pick_round: 1, period_start: day_one })
    await insert_pick_holding({ tid: 3, pick_round: 2, period_start: day_one })

    await calculate_team_daily_ktc_value({ lid })

    for (const date of [day_one, day_two]) {
      const rows = await get_rows(date)
      const share_total = rows.reduce(
        (acc, row) => acc + Number(row.total_share),
        0
      )
      // total_share is numeric(6,5), so each row rounds to five decimal places
      share_total.should.be.closeTo(1, 1e-4)
    }

    const day_total = PLAYER_VALUE + ROUND_ONE_VALUE + ROUND_TWO_VALUE
    const by_tid = await rows_by_team_id(day_two)
    by_tid[3].total_value.should.equal(ROUND_TWO_VALUE)
    Number(by_tid[3].total_share).should.be.closeTo(
      ROUND_TWO_VALUE / day_total,
      1e-4
    )
  })

  it('prices a round with no keeptradecut series at zero', async function () {
    await insert_pick_holding({ tid: 3, pick_round: 5, period_start: day_one })

    await calculate_team_daily_ktc_value({ lid })

    const by_tid = await rows_by_team_id(day_two)
    by_tid[3].pick_value.should.equal(0)
    by_tid[3].total_value.should.equal(0)
  })

  it('moves a traded pick between teams at its period boundary', async function () {
    // team 2 holds the pick through the end of day one, team 3 from day two on
    await insert_pick_holding({
      tid: 2,
      pick_round: 1,
      period_start: day_one,
      period_end: day_two
    })
    await insert_pick_holding({ tid: 3, pick_round: 1, period_start: day_two })

    await calculate_team_daily_ktc_value({ lid })

    const day_one_rows = await rows_by_team_id(day_one)
    day_one_rows[2].pick_value.should.equal(ROUND_ONE_VALUE)
    day_one_rows[3].pick_value.should.equal(0)

    const day_two_rows = await rows_by_team_id(day_two)
    day_two_rows[2].pick_value.should.equal(0)
    day_two_rows[3].pick_value.should.equal(ROUND_ONE_VALUE)
  })

  it('reports zero pick value for a league whose lineage holds no picks', async function () {
    await calculate_team_daily_ktc_value({ lid })

    const rows = await get_rows(day_two)
    rows.length.should.be.greaterThan(0)
    for (const row of rows) {
      row.pick_value.should.equal(0)
      row.total_value.should.equal(row.ktc_value)
    }
  })
})
