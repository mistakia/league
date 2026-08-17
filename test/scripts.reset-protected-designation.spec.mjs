/* global describe before beforeEach afterEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import { current_season, roster_slot_types } from '#constants'
import run from '#scripts/reset-protected-designation.mjs'

process.env.NODE_ENV = 'test'

chai.should()
const expect = chai.expect
const { regular_season_start } = current_season

const offseason_date = () =>
  regular_season_start.subtract('1', 'month').toISOString()
const regular_season_date = () =>
  regular_season_start.add('2', 'weeks').toISOString()

// Seed one roster slice holding a protected signed player, a protected drafted
// player and a bench player, so each assertion also proves the reset leaves
// unrelated slots alone.
const seed_slice = async ({ lid = 1, tid = 1, week }) => {
  const year = current_season.year
  const rows = await knex('rosters')
    .insert({ tid, lid, week, season_year: year })
    .returning('uid')
  const rid = rows[0].uid

  await knex('rosters_players').insert([
    {
      roster_id: rid,
      slot: roster_slot_types.PSP,
      pid: 'TEST-PSPP-000001',
      player_position: 'RB',
      tid,
      lid,
      week,
      season_year: year
    },
    {
      roster_id: rid,
      slot: roster_slot_types.PSDP,
      pid: 'TEST-PSDP-000002',
      player_position: 'WR',
      tid,
      lid,
      week,
      season_year: year
    },
    {
      roster_id: rid,
      slot: roster_slot_types.BENCH,
      pid: 'TEST-BNCH-000003',
      player_position: 'TE',
      tid,
      lid,
      week,
      season_year: year
    }
  ])
}

const NOTIFICATION_TYPE = 'practice_squad_protections_expired'

const announcements = async () =>
  knex('league_notifications').where({
    lid: 1,
    notification_type: NOTIFICATION_TYPE
  })

const slots_by_pid = async ({ week }) => {
  const rows = await knex('rosters_players')
    .select('pid', 'slot')
    .where({ lid: 1, season_year: current_season.year, week })
  return rows.reduce((acc, { pid, slot }) => ({ ...acc, [pid]: slot }), {})
}

describe('SCRIPTS /reset-protected-designation', function () {
  this.timeout(60 * 1000)

  before(async function () {
    await knex.seed.run()
  })

  afterEach(function () {
    MockDate.reset()
  })

  describe('extension deadline passed', function () {
    beforeEach(async function () {
      MockDate.set(offseason_date())
      await league(knex)
      await knex('league_notifications').del()
      // Both slices that exist during the offseason: week 0 and the week-1
      // slice generate-rosters materializes ahead of kickoff.
      await seed_slice({ week: 0 })
      await seed_slice({ week: 1 })
    })

    it('lifts protections on every slice of the season year', async () => {
      await run()

      for (const week of [0, 1]) {
        const slots = await slots_by_pid({ week })
        expect(slots['TEST-PSPP-000001']).to.equal(roster_slot_types.PS)
        expect(slots['TEST-PSDP-000002']).to.equal(roster_slot_types.PSD)
        expect(slots['TEST-BNCH-000003']).to.equal(roster_slot_types.BENCH)
      }
    })

    it('is idempotent across repeated runs', async () => {
      await run()

      let error
      try {
        await run()
      } catch (err) {
        error = err
      }

      expect(error).to.equal(undefined)

      const slots = await slots_by_pid({ week: 0 })
      expect(slots['TEST-PSPP-000001']).to.equal(roster_slot_types.PS)
      expect(slots['TEST-PSDP-000002']).to.equal(roster_slot_types.PSD)
    })

    it('announces the expiry once, counting players not roster rows', async () => {
      await run()

      const sent = await announcements()
      expect(sent.length).to.equal(1)
      // Two players across two slices — the message must not report four.
      expect(sent[0].message).to.include('2 practice squad players')
      expect(sent[0].metadata.expired_count).to.equal(2)
    })

    // The reset converges to nothing on the second run, so a marker-free
    // implementation would look correct here for the wrong reason. Re-protecting
    // between runs is what separates "nothing left to announce" from "already
    // announced", and only the marker survives it.
    it('does not announce twice when protections reappear', async () => {
      await run()
      await seed_slice({ week: 2 })

      await run()

      const sent = await announcements()
      expect(sent.length).to.equal(1)
    })
  })

  describe('gates', function () {
    // Every league passes its deadline every year and most hold nothing
    // protected. Announcing on the deadline alone would post an empty-handed
    // message to every channel annually.
    it('stays silent when a due league had nothing protected', async () => {
      MockDate.set(offseason_date())
      await league(knex)
      await knex('league_notifications').del()

      await run()

      const sent = await announcements()
      expect(sent.length).to.equal(0)
    })

    it('leaves protections in place before the extension deadline', async () => {
      MockDate.set(offseason_date())
      await league(knex, {
        extension_deadline_at: current_season.now.add('1', 'week').unix()
      })
      await knex('league_notifications').del()
      await seed_slice({ week: 0 })

      await run()

      const slots = await slots_by_pid({ week: 0 })
      expect(slots['TEST-PSPP-000001']).to.equal(roster_slot_types.PSP)
      expect(slots['TEST-PSDP-000002']).to.equal(roster_slot_types.PSDP)
    })

    // A designation applied during the regular season of year N is expired by
    // year N+1's deadline, never by the deadline that already passed earlier in
    // year N. Without this gate every in-season designation would be lifted
    // within five minutes of being applied.
    it('leaves protections in place during the regular season', async () => {
      MockDate.set(regular_season_date())
      await league(knex)
      await seed_slice({ week: current_season.week })

      await run()

      const slots = await slots_by_pid({ week: current_season.week })
      expect(slots['TEST-PSPP-000001']).to.equal(roster_slot_types.PSP)
      expect(slots['TEST-PSDP-000002']).to.equal(roster_slot_types.PSDP)
    })
  })
})
