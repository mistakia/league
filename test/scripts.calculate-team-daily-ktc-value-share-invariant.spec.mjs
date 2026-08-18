/* global describe before beforeEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'
import dayjs from 'dayjs'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import { transaction_types, current_season } from '#constants'
import calculate_team_daily_ktc_value from '#scripts/calculate-team-daily-ktc-value.mjs'
import { epoch_to_timestamptz } from '#libs-shared'

process.env.NODE_ENV = 'test'

chai.should()

const lid = 1

// `total_share` is the Article XXII deposit divisor, so a day whose shares do
// not sum to one prices somebody's league entry wrong. These two tests cover the
// two ways league 1's table had drifted away from that invariant, both of which
// are properties of the WRITE rather than of any one day's arithmetic.

// The interpolation loop walks forward from a transaction in five-day steps and
// can step onto a day that a later transaction then has emitted again as an
// end-of-day roster. These dates place one such step exactly on `boundary_date`:
// the gap from `first_date` is ten days, so the second cursor step lands on
// `boundary_date` at noon while that day's own transaction is at six.
const first_date = '2026-03-01'
const boundary_date = '2026-03-11'
const last_date = '2026-03-12'

const DECOMMISSIONED_TEAM_ID = 11
const SURVIVING_TEAM_ID = 1
const NUM_TEAMS_AFTER = 10

const PLAYER_KEPT = 'PLAY-KEPT-000001'
const PLAYER_LOST = 'PLAY-LOST-000002'
const PLAYER_VALUE = 1000

const observed_at = (date) => `${date}T12:00:00Z`

const insert_transaction = async ({ uid, tid, pid, date, time, season_year }) =>
  knex('transactions').insert({
    transaction_id,
    user_id: 1,
    tid,
    lid,
    pid,
    type: transaction_types.DRAFT,
    player_salary: 0,
    week: 1,
    season_year,
    occurred_at: epoch_to_timestamptz(dayjs(`${date} ${time}`).unix())
  })

const insert_keeptradecut_valuation = async ({ pid, date }) =>
  knex('keeptradecut_valuations').insert({
    pid,
    is_superflex: true,
    observed_at: observed_at(date),
    keeptradecut_value: PLAYER_VALUE
  })

const get_rows = async (date) =>
  knex('league_team_daily_values').where({ lid, date }).orderBy('tid', 'asc')

describe('SCRIPTS - calculate team daily ktc value - share invariant', function () {
  this.timeout(60 * 1000)

  let season_year

  before(async function () {
    MockDate.set(dayjs(`${last_date} 18:00:00`).toISOString())
  })

  beforeEach(async function () {
    await league(knex)

    season_year = current_season.year
    const season = await knex('seasons').where({ lid, season_year }).first()

    // The following season runs two teams short, which is the shape league 1
    // took in 2023. The teams index is rebuilt from the `teams` rows of each
    // transaction's own season, so this is what decommissions a team mid-replay.
    await knex('seasons').insert({ ...season, season_year: season_year + 1 })
    const teams = await knex('teams')
      .where({ lid, season_year })
      .whereNot('team_id', '>', NUM_TEAMS_AFTER)
    await knex('teams').insert(
      teams.map((team) => ({ ...team, season_year: season_year + 1 }))
    )

    await knex('league_team_daily_values').where({ lid }).del()
    await knex('keeptradecut_valuations').del()

    // One player on a team that survives the contraction and one on a team that
    // does not, both ranked, so the two team populations produce two different
    // day totals. With the lost team's value absent from the smaller
    // denominator, a row computed against the larger one is detectable in the
    // day's share sum rather than merely being a duplicate.
    await insert_transaction({
      uid: 401,
      tid: SURVIVING_TEAM_ID,
      pid: PLAYER_KEPT,
      date: first_date,
      time: '12:00:00',
      season_year
    })
    await insert_transaction({
      uid: 402,
      tid: DECOMMISSIONED_TEAM_ID,
      pid: PLAYER_LOST,
      date: first_date,
      time: '12:00:01',
      season_year
    })

    // Late enough in the day that the interpolation cursor's noon step for this
    // date falls before it, which is what makes the day emitted twice.
    await insert_transaction({
      uid: 403,
      tid: SURVIVING_TEAM_ID,
      pid: 'PLAY-THRE-000003',
      date: boundary_date,
      time: '18:00:00',
      season_year: season_year + 1
    })
    await insert_transaction({
      uid: 404,
      tid: SURVIVING_TEAM_ID,
      pid: 'PLAY-FOUR-000004',
      date: last_date,
      time: '12:00:00',
      season_year: season_year + 1
    })

    for (const pid of [PLAYER_KEPT, PLAYER_LOST]) {
      for (const date of [first_date, boundary_date, last_date]) {
        await insert_keeptradecut_valuation({ pid, date })
      }
    }
  })

  it('emits one team population for a day emitted twice', async function () {
    await calculate_team_daily_ktc_value({ lid })

    const rows = await get_rows(boundary_date)
    rows.length.should.equal(NUM_TEAMS_AFTER)
    rows
      .map((row) => row.tid)
      .should.not.include(
        DECOMMISSIONED_TEAM_ID,
        'a team absent from the day final roster kept a row from an earlier emission'
      )

    const share_total = rows.reduce(
      (acc, row) => acc + Number(row.total_share),
      0
    )
    share_total.should.be.closeTo(1, 1e-4)

    const ktc_share_total = rows.reduce(
      (acc, row) => acc + Number(row.ktc_share),
      0
    )
    ktc_share_total.should.be.closeTo(1, 1e-4)
  })

  it('removes rows from a date the replay no longer emits', async function () {
    // A day an older replay wrote and this one does not reach, plus a row on a
    // day it does. Nothing else in the pipeline deletes, so a row the run does
    // not emit survives forever unless the writer owns its own range.
    const stale_date = '2020-01-01'
    await knex('league_team_daily_values').insert([
      {
        lid,
        tid: SURVIVING_TEAM_ID,
        date: stale_date,
        observed_at: `${stale_date}T12:00:00Z`,
        ktc_value: 500,
        ktc_share: 1,
        pick_value: null,
        total_value: null,
        total_share: null
      },
      {
        lid,
        tid: DECOMMISSIONED_TEAM_ID,
        date: boundary_date,
        observed_at: `${boundary_date}T12:00:00Z`,
        ktc_value: 500,
        ktc_share: 0.5,
        pick_value: null,
        total_value: null,
        total_share: null
      }
    ])

    await calculate_team_daily_ktc_value({ lid })

    const stale_rows = await get_rows(stale_date)
    stale_rows.length.should.equal(0)

    const null_rows = await knex('league_team_daily_values')
      .where({ lid })
      .whereNull('total_share')
    null_rows.length.should.equal(0)
  })

  it('reports no shortfall on a run whose every day balances', async function () {
    // The two players added on `boundary_date` and `last_date` are unranked in
    // the shared fixture, which the coverage oracle reads as a partial
    // keeptradecut import once the replay emits the final transaction's own
    // day. Rank them here so this test's run is fully covered — its subject is
    // the SHARE invariant, and an unrelated coverage shortfall would mask it.
    for (const pid of ['PLAY-THRE-000003', 'PLAY-FOUR-000004']) {
      for (const date of [first_date, boundary_date, last_date]) {
        await insert_keeptradecut_valuation({ pid, date })
      }
    }

    // The share oracle reads the table back, so it is the run's own verdict on
    // the invariant the two tests above assert row by row. It cannot be driven
    // red from a test -- the run owns every row for the league, so a row written
    // beforehand is deleted before the oracle looks -- which is the point: it
    // fires only on a defect inside the write itself, and the mutation that
    // proves it (restoring the per-team dedup) turns this red along with the
    // first test.
    const result = await calculate_team_daily_ktc_value({ lid })
    chai.expect(result.shortfall).to.equal(null)
  })

  it('reports a recent day whose rosters mostly resolve to no valuation', async function () {
    // The coverage oracle is the job's guard against a partial keeptradecut
    // import, which skews a whole day's shares rather than one team's value --
    // a player missing from one team's numerator is missing from every team's
    // denominator too. Two more rostered players with no ranking anywhere take
    // the day under the floor.
    for (const [uid, pid] of [
      [405, 'PLAY-FIVE-000005'],
      [406, 'PLAY-SIX-000006']
    ]) {
      await insert_transaction({
        uid,
        tid: SURVIVING_TEAM_ID,
        pid,
        date: first_date,
        time: '12:00:02',
        season_year
      })
    }

    const { shortfall } = await calculate_team_daily_ktc_value({ lid })
    chai.expect(shortfall).to.be.a('string')
    shortfall.should.include('keeptradecut coverage below')
  })
})
