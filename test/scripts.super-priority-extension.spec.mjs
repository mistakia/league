/* global describe before beforeEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'

import knex from '#db'
import league from '#db/seeds/league.mjs'
import {
  current_season,
  roster_slot_types,
  transaction_types,
  player_tag_types
} from '#constants'
import { selectPlayer } from './utils/index.mjs'
import get_super_priority_status from '#libs-server/get-super-priority-status.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect
chai.should()
const { regular_season_start } = current_season

const insert_poach_history = async ({
  player,
  original_tid = 1,
  poaching_tid = 2,
  lid = 1,
  poach_timestamp,
  release_timestamp
}) => {
  await knex('transactions').insert([
    {
      pid: player.pid,
      tid: original_tid,
      lid,
      type: transaction_types.PRACTICE_ADD,
      value: 0,
      year: current_season.year,
      timestamp: poach_timestamp - 24 * 60 * 60,
      week: 0,
      userid: original_tid
    },
    {
      pid: player.pid,
      tid: poaching_tid,
      lid,
      type: transaction_types.POACHED,
      value: 0,
      year: current_season.year,
      timestamp: poach_timestamp,
      week: 0,
      userid: poaching_tid
    },
    {
      pid: player.pid,
      tid: poaching_tid,
      lid,
      type: transaction_types.ROSTER_RELEASE,
      value: 0,
      year: current_season.year,
      timestamp: release_timestamp,
      week: 0,
      userid: poaching_tid
    }
  ])
}

const insert_extension = async ({
  player,
  poaching_tid = 2,
  lid = 1,
  timestamp
}) => {
  await knex('transactions').insert({
    pid: player.pid,
    tid: poaching_tid,
    lid,
    type: transaction_types.EXTENSION,
    value: 0,
    year: current_season.year,
    timestamp,
    week: 0,
    userid: poaching_tid
  })
}

const place_player_at_week_one = async ({
  player,
  poaching_tid = 2,
  lid = 1,
  slot
}) => {
  const rosters = await knex('rosters')
    .where({ tid: poaching_tid, lid, year: current_season.year, week: 1 })
    .limit(1)
  await knex('rosters_players').insert({
    rid: rosters[0].uid,
    pid: player.pid,
    slot,
    pos: player.pos1,
    tag: player_tag_types.REGULAR,
    tid: poaching_tid,
    lid,
    year: current_season.year,
    week: 1
  })
}

describe('SUPER PRIORITY - Extension joint-condition (Amendment XXXIV §4)', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
  })

  beforeEach(async function () {
    this.timeout(60 * 1000)
    MockDate.set(regular_season_start.subtract('1', 'month').toISOString())
    await league(knex)
    await knex('super_priority').del()
  })

  it('is eligible when extended and released before the Regular Season starts', async () => {
    // MockDate is at regular_season_start - 1 month (preseason).
    // Player poached, extended, released — all before Regular Season starts.
    const now = Math.round(Date.now() / 1000)
    const player = await selectPlayer({ rookie: false })
    const poach_timestamp = now - 5 * 24 * 60 * 60
    const release_timestamp = now - 1 * 24 * 60 * 60
    const extension_timestamp = poach_timestamp + 24 * 60 * 60

    await insert_poach_history({
      player,
      poach_timestamp,
      release_timestamp
    })
    await insert_extension({ player, timestamp: extension_timestamp })

    const status = await get_super_priority_status({
      pid: player.pid,
      lid: 1
    })

    status.should.have.property('eligible', true)
    status.should.have.property('original_tid', 1)
    status.should.have.property('poaching_tid', 2)
  })

  it('is ineligible when extended and on Active roster at week 1 after Regular Season has started', async () => {
    // Set MockDate to mid-Regular-Season (week 4) and place the extended
    // player on the Active roster (BENCH) at week 1 of the current year.
    const player = await selectPlayer({ rookie: false })
    MockDate.set(regular_season_start.add('5', 'weeks').toISOString())
    const now = Math.round(Date.now() / 1000)
    const poach_timestamp = now - 30 * 24 * 60 * 60
    const release_timestamp = now - 1 * 24 * 60 * 60
    const extension_timestamp = poach_timestamp + 24 * 60 * 60

    await insert_poach_history({
      player,
      poach_timestamp,
      release_timestamp
    })
    await insert_extension({ player, timestamp: extension_timestamp })
    await place_player_at_week_one({
      player,
      slot: roster_slot_types.BENCH
    })

    const status = await get_super_priority_status({
      pid: player.pid,
      lid: 1
    })

    status.should.have.property('eligible', false)
    expect(status.reason).to.match(/extend/i)
  })

  it('is eligible when extended but on Reserve (IR) at week 1 after Regular Season has started', async () => {
    // The constitution says "remains on the Active roster at the start of
    // the Regular Season." A player extended then placed on IR before week 1
    // is not on the Active roster at week 1, so the joint condition does
    // not fire and super priority remains intact.
    const player = await selectPlayer({ rookie: false })
    MockDate.set(regular_season_start.add('5', 'weeks').toISOString())
    const now = Math.round(Date.now() / 1000)
    const poach_timestamp = now - 30 * 24 * 60 * 60
    const release_timestamp = now - 1 * 24 * 60 * 60
    const extension_timestamp = poach_timestamp + 24 * 60 * 60

    await insert_poach_history({
      player,
      poach_timestamp,
      release_timestamp
    })
    await insert_extension({ player, timestamp: extension_timestamp })
    await place_player_at_week_one({
      player,
      slot: roster_slot_types.RESERVE_SHORT_TERM
    })

    const status = await get_super_priority_status({
      pid: player.pid,
      lid: 1
    })

    status.should.have.property('eligible', true)
  })

  it('is ineligible with reason when poach transaction year is null (legacy data)', async () => {
    // A legacy POACHED transaction with a null year would otherwise silently
    // bypass all roster-based disqualifiers; verify the explicit guard.
    const player = await selectPlayer({ rookie: false })
    const now = Math.round(Date.now() / 1000)
    const poach_timestamp = now - 5 * 24 * 60 * 60
    const release_timestamp = now - 1 * 24 * 60 * 60

    await knex('transactions').insert([
      {
        pid: player.pid,
        tid: 1,
        lid: 1,
        type: transaction_types.PRACTICE_ADD,
        value: 0,
        year: current_season.year,
        timestamp: poach_timestamp - 24 * 60 * 60,
        week: 0,
        userid: 1
      },
      {
        pid: player.pid,
        tid: 2,
        lid: 1,
        type: transaction_types.POACHED,
        value: 0,
        year: null,
        timestamp: poach_timestamp,
        week: 0,
        userid: 2
      },
      {
        pid: player.pid,
        tid: 2,
        lid: 1,
        type: transaction_types.ROSTER_RELEASE,
        value: 0,
        year: current_season.year,
        timestamp: release_timestamp,
        week: 0,
        userid: 2
      }
    ])

    const status = await get_super_priority_status({
      pid: player.pid,
      lid: 1
    })

    status.should.have.property('eligible', false)
    expect(status.reason).to.match(/poach year/i)
  })

  it('is ineligible for prior-season poach when player was on Active roster at week 1 of poach year', async () => {
    // Simulate a poach that occurred in the previous season; place the
    // player on the prior year's week 1 active roster. Joint condition fires
    // trivially since the poach year's Regular Season is in the past.
    const player = await selectPlayer({ rookie: false })
    const prior_year = current_season.year - 1
    const now = Math.round(Date.now() / 1000)
    const poach_timestamp = now - 365 * 24 * 60 * 60
    const release_timestamp = now - 1 * 24 * 60 * 60
    const extension_timestamp = poach_timestamp + 24 * 60 * 60

    // Pre-existing rosters table is seeded only for current year — insert
    // a prior-year week-1 row so the active-at-week-1 query has data.
    await knex('rosters').insert({
      tid: 2,
      lid: 1,
      week: 1,
      year: prior_year,
      last_updated: now
    })
    const prior_rosters = await knex('rosters')
      .where({ tid: 2, lid: 1, week: 1, year: prior_year })
      .limit(1)

    await knex('transactions').insert([
      {
        pid: player.pid,
        tid: 1,
        lid: 1,
        type: transaction_types.PRACTICE_ADD,
        value: 0,
        year: prior_year,
        timestamp: poach_timestamp - 24 * 60 * 60,
        week: 0,
        userid: 1
      },
      {
        pid: player.pid,
        tid: 2,
        lid: 1,
        type: transaction_types.POACHED,
        value: 0,
        year: prior_year,
        timestamp: poach_timestamp,
        week: 0,
        userid: 2
      },
      {
        pid: player.pid,
        tid: 2,
        lid: 1,
        type: transaction_types.EXTENSION,
        value: 0,
        year: prior_year,
        timestamp: extension_timestamp,
        week: 0,
        userid: 2
      },
      {
        pid: player.pid,
        tid: 2,
        lid: 1,
        type: transaction_types.ROSTER_RELEASE,
        value: 0,
        year: current_season.year,
        timestamp: release_timestamp,
        week: 0,
        userid: 2
      }
    ])

    await knex('rosters_players').insert({
      rid: prior_rosters[0].uid,
      pid: player.pid,
      slot: roster_slot_types.BENCH,
      pos: player.pos1,
      tag: player_tag_types.REGULAR,
      tid: 2,
      lid: 1,
      year: prior_year,
      week: 1
    })

    const status = await get_super_priority_status({
      pid: player.pid,
      lid: 1
    })

    status.should.have.property('eligible', false)
    expect(status.reason).to.match(/extend/i)
  })

  it('is eligible when extended but the Regular Season has not yet started', async () => {
    // MockDate is at preseason (regular_season_start - 1 month) and the
    // player was poached/released in preseason. Even though there is a
    // week-1 roster snapshot showing the player on BENCH, the Regular
    // Season has not started yet, so the joint condition does not fire.
    const player = await selectPlayer({ rookie: false })
    const now = Math.round(Date.now() / 1000)
    const poach_timestamp = now - 5 * 24 * 60 * 60
    const release_timestamp = now - 1 * 24 * 60 * 60
    const extension_timestamp = poach_timestamp + 24 * 60 * 60

    await insert_poach_history({
      player,
      poach_timestamp,
      release_timestamp
    })
    await insert_extension({ player, timestamp: extension_timestamp })
    await place_player_at_week_one({
      player,
      slot: roster_slot_types.BENCH
    })

    const status = await get_super_priority_status({
      pid: player.pid,
      lid: 1
    })

    status.should.have.property('eligible', true)
  })
})
