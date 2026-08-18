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

// The replay reconstructs each day's rosters from the transaction log, and the
// log does not state every departure. A poach is recorded only against the team
// that GAINS the player, so the losing team keeps him unless the replay enforces
// the one-roster invariant itself.

const day_one = '2026-03-01'
const day_two = '2026-03-02'
const day_three = '2026-03-03'
const day_four = '2026-03-04'

const LOSING_TEAM_ID = 1
const GAINING_TEAM_ID = 2
const POACHED_PLAYER = 'PLAY-POAC-000001'
const PLAYER_VALUE = 1000

const insert_transaction = async ({ uid, tid, pid, type, date }) =>
  knex('transactions').insert({
    transaction_id,
    user_id: 1,
    tid,
    lid,
    pid,
    type,
    player_salary: 0,
    week: 1,
    season_year: current_season.year,
    occurred_at: epoch_to_timestamptz(dayjs(`${date} 12:00:00`).unix())
  })

const rows_by_team_id = async (date) =>
  Object.fromEntries(
    (await knex('league_team_daily_values').where({ lid, date })).map((row) => [
      row.tid,
      row
    ])
  )

describe('SCRIPTS - calculate team daily ktc value - roster reconstruction', function () {
  this.timeout(60 * 1000)

  before(async function () {
    MockDate.set(dayjs(`${day_four} 18:00:00`).toISOString())
  })

  beforeEach(async function () {
    await league(knex)
    await knex('league_team_daily_values').where({ lid }).del()
    await knex('keeptradecut_valuations').del()

    for (const date of [day_one, day_two, day_three, day_four]) {
      await knex('keeptradecut_valuations').insert({
        pid: POACHED_PLAYER,
        is_superflex: true,
        observed_at: `${date}T12:00:00Z`,
        keeptradecut_value: PLAYER_VALUE
      })
    }
  })

  it('moves a poached player off the team he was poached from', async function () {
    await insert_transaction({
      uid: 501,
      tid: LOSING_TEAM_ID,
      pid: POACHED_PLAYER,
      type: transaction_types.DRAFT,
      date: day_one
    })
    // The poach names only the gaining team, which is the whole difficulty.
    await insert_transaction({
      uid: 502,
      tid: GAINING_TEAM_ID,
      pid: POACHED_PLAYER,
      type: transaction_types.POACHED,
      date: day_two
    })
    // A day is emitted when the following day's first transaction arrives.
    await insert_transaction({
      uid: 503,
      tid: GAINING_TEAM_ID,
      pid: 'PLAY-OTHR-000002',
      type: transaction_types.DRAFT,
      date: day_three
    })

    await calculate_team_daily_ktc_value({ lid })

    const before_poach = await rows_by_team_id(day_one)
    before_poach[LOSING_TEAM_ID].ktc_value.should.equal(PLAYER_VALUE)
    before_poach[GAINING_TEAM_ID].ktc_value.should.equal(0)

    const after_poach = await rows_by_team_id(day_two)
    after_poach[GAINING_TEAM_ID].ktc_value.should.equal(PLAYER_VALUE)
    after_poach[LOSING_TEAM_ID].ktc_value.should.equal(
      0,
      'the team he was poached from still carries his value'
    )

    // The sharpest assertion of the three: with the player counted twice the
    // league total doubles, which is what silently moved every team's share.
    const day_total = Object.values(after_poach).reduce(
      (acc, row) => acc + row.ktc_value,
      0
    )
    day_total.should.equal(PLAYER_VALUE)
  })

  it('returns a super-priority reclaim to the original team', async function () {
    // The other half of the poach flow. It was latent while the poach itself
    // went unapplied -- the player never left, so nothing had to bring him back
    // -- and became live the moment that was fixed.
    await insert_transaction({
      uid: 521,
      tid: LOSING_TEAM_ID,
      pid: POACHED_PLAYER,
      type: transaction_types.DRAFT,
      date: day_one
    })
    await insert_transaction({
      uid: 522,
      tid: GAINING_TEAM_ID,
      pid: POACHED_PLAYER,
      type: transaction_types.POACHED,
      date: day_two
    })
    await insert_transaction({
      uid: 523,
      tid: LOSING_TEAM_ID,
      pid: POACHED_PLAYER,
      type: transaction_types.SUPER_PRIORITY,
      date: day_three
    })
    await insert_transaction({
      uid: 524,
      tid: GAINING_TEAM_ID,
      pid: 'PLAY-OTHR-000002',
      type: transaction_types.DRAFT,
      date: day_four
    })

    await calculate_team_daily_ktc_value({ lid })

    const reclaimed = await rows_by_team_id(day_three)
    reclaimed[LOSING_TEAM_ID].ktc_value.should.equal(PLAYER_VALUE)
    reclaimed[GAINING_TEAM_ID].ktc_value.should.equal(0)
  })

  it('keeps one roster per player across a re-add by another team', async function () {
    // The same invariant reached through an ordinary add rather than a poach:
    // whatever the log does or does not say about the departure, a player
    // contributes to exactly one team on any day.
    await insert_transaction({
      uid: 511,
      tid: LOSING_TEAM_ID,
      pid: POACHED_PLAYER,
      type: transaction_types.DRAFT,
      date: day_one
    })
    await insert_transaction({
      uid: 512,
      tid: GAINING_TEAM_ID,
      pid: POACHED_PLAYER,
      type: transaction_types.ROSTER_ADD,
      date: day_two
    })
    await insert_transaction({
      uid: 513,
      tid: GAINING_TEAM_ID,
      pid: 'PLAY-OTHR-000002',
      type: transaction_types.DRAFT,
      date: day_three
    })

    await calculate_team_daily_ktc_value({ lid })

    const rows = await rows_by_team_id(day_two)
    const holders = Object.values(rows).filter((row) => row.ktc_value > 0)
    holders.length.should.equal(1)
    holders[0].tid.should.equal(GAINING_TEAM_ID)
  })
})
