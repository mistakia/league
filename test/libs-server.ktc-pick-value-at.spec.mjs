/* global describe before after it */

import * as chai from 'chai'

import db from '#db'
import {
  PICK_SLOT,
  slot_from_position,
  load_pick_ktc_indexes,
  ktc_pick_at
} from '#libs-server/composite-market-value/ktc-pick-value-at.mjs'

chai.should()
const expect = chai.expect

// keeptradecut_valuations.observed_at is timestamptz and arrives from pg/knex
// as a JS Date (db/index.mjs only retypes NUMERIC/INT8 columns). Every date
// this module touches -- lookup_le, unix_of_ymd, the analog centrality window
// -- is epoch seconds, and `Date <= number` coerces the Date to milliseconds,
// so an unnormalized row makes every comparison silently false. These pids are
// scoped to this file only.
const PID_2023_R1_EARLY = 'TEST-KTCPICK-000001'
const PID_2023_R1_EARLY_NOT_SF = 'TEST-KTCPICK-000002'
const PID_2027_R1_MID = 'TEST-KTCPICK-000003'
const PID_2026_R2_EARLY = 'TEST-KTCPICK-000004'
const PID_2026_R2_MID = 'TEST-KTCPICK-000005'
const PID_2026_R2_LATE = 'TEST-KTCPICK-000006'
const PICK_PIDS = [
  PID_2023_R1_EARLY,
  PID_2023_R1_EARLY_NOT_SF,
  PID_2027_R1_MID,
  PID_2026_R2_EARLY,
  PID_2026_R2_MID,
  PID_2026_R2_LATE
]

const seed_pick = ({ pid, ktc_player_id, season_year, round, slot }) =>
  db('keeptradecut_pick').insert({
    pid,
    ktc_player_id,
    ktc_player_name: pid,
    season_year,
    round,
    slot,
    created_at: new Date(),
    updated_at: new Date()
  })

const seed_valuations = ({ pid, is_superflex, observations }) =>
  db('keeptradecut_valuations').insert(
    observations.map(({ observed_at, value }) => ({
      pid,
      is_superflex,
      observed_at,
      keeptradecut_value: value
    }))
  )

const cleanup = () =>
  Promise.all([
    db('keeptradecut_valuations').whereIn('pid', PICK_PIDS).del(),
    db('keeptradecut_pick').whereIn('pid', PICK_PIDS).del()
  ])

describe('LIBS SERVER ktc-pick-value-at', function () {
  before(cleanup)
  after(cleanup)

  describe('slot_from_position', function () {
    it('buckets a within-round position into thirds of num_teams', () => {
      slot_from_position(1, 12).should.equal(PICK_SLOT.EARLY)
      slot_from_position(4, 12).should.equal(PICK_SLOT.EARLY)
      slot_from_position(5, 12).should.equal(PICK_SLOT.MID)
      slot_from_position(8, 12).should.equal(PICK_SLOT.MID)
      slot_from_position(9, 12).should.equal(PICK_SLOT.LATE)
      slot_from_position(12, 12).should.equal(PICK_SLOT.LATE)
    })

    it('returns null when position or num_teams is unknown', () => {
      expect(slot_from_position(null, 12)).to.equal(null)
      expect(slot_from_position(1, null)).to.equal(null)
      expect(slot_from_position(1, 0)).to.equal(null)
    })
  })

  describe('load_pick_ktc_indexes', function () {
    before(async () => {
      await cleanup()
      await seed_pick({
        pid: PID_2023_R1_EARLY,
        ktc_player_id: 900001,
        season_year: 2023,
        round: 1,
        slot: PICK_SLOT.EARLY
      })
      await seed_pick({
        pid: PID_2023_R1_EARLY_NOT_SF,
        ktc_player_id: 900002,
        season_year: 2023,
        round: 2,
        slot: PICK_SLOT.MID
      })
      await seed_valuations({
        pid: PID_2023_R1_EARLY,
        is_superflex: true,
        observations: [
          { observed_at: new Date('2024-06-01T00:00:00Z'), value: 400 },
          { observed_at: new Date('2023-09-08T00:00:00Z'), value: 500 }
        ]
      })
      // A non-superflex row for the same pid, and a superflex row on a
      // different pid -- both must be excluded from an is_superflex: true load.
      await seed_valuations({
        pid: PID_2023_R1_EARLY,
        is_superflex: false,
        observations: [
          { observed_at: new Date('2024-01-01T00:00:00Z'), value: 999 }
        ]
      })
      await seed_valuations({
        pid: PID_2023_R1_EARLY_NOT_SF,
        is_superflex: false,
        observations: [
          { observed_at: new Date('2024-01-01T00:00:00Z'), value: 888 }
        ]
      })
    })
    after(cleanup)

    it('normalizes observed_at Date rows to epoch-second integers, sorted ascending', async () => {
      const idx = await load_pick_ktc_indexes({ is_superflex: true })
      const rows = idx.ktc_picks.get(PID_2023_R1_EARLY)
      rows.should.have.length(2)
      rows.forEach((r) => expect(r.d).to.be.a('number'))
      rows[0].d.should.be.below(rows[1].d)
      rows[0].should.deep.equal({
        d: Math.floor(new Date('2023-09-08T00:00:00Z').getTime() / 1000),
        v: 500
      })
      rows[1].should.deep.equal({
        d: Math.floor(new Date('2024-06-01T00:00:00Z').getTime() / 1000),
        v: 400
      })
    })

    it('registers every keeptradecut_pick row regardless of is_superflex, keyed by year/round/slot', async () => {
      const idx = await load_pick_ktc_indexes({ is_superflex: true })
      idx.pick_pid_by_yrs.get('2023__1__1').should.equal(PID_2023_R1_EARLY)
      idx.pick_pid_meta.get(PID_2023_R1_EARLY).should.deep.equal({
        year: 2023,
        round: 1,
        slot: PICK_SLOT.EARLY
      })
    })

    it('excludes valuation rows for the other is_superflex axis', async () => {
      const idx = await load_pick_ktc_indexes({ is_superflex: true })
      // Only the two is_superflex: true rows seeded above -- the is_superflex:
      // false row on the same pid must not appear.
      idx.ktc_picks.get(PID_2023_R1_EARLY).should.have.length(2)
      // The other pid has only an is_superflex: false row, so it gets no
      // ktc_picks entry at all under an is_superflex: true load.
      expect(idx.ktc_picks.get(PID_2023_R1_EARLY_NOT_SF)).to.equal(undefined)
    })
  })

  describe('ktc_pick_at', function () {
    before(async () => {
      await cleanup()
      // A single real KTCPICK series: 2023 round-1 early-slot pick, three
      // observations spanning its rookie season.
      await seed_pick({
        pid: PID_2023_R1_EARLY,
        ktc_player_id: 900011,
        season_year: 2023,
        round: 1,
        slot: PICK_SLOT.EARLY
      })
      await seed_valuations({
        pid: PID_2023_R1_EARLY,
        is_superflex: true,
        observations: [
          { observed_at: new Date('2023-09-08T00:00:00Z'), value: 500 },
          { observed_at: new Date('2024-01-15T00:00:00Z'), value: 400 },
          { observed_at: new Date('2024-08-01T00:00:00Z'), value: 300 }
        ]
      })
    })
    after(cleanup)

    it('resolves an exact-year match to the latest value at or before the target', async () => {
      const idx = await load_pick_ktc_indexes({ is_superflex: true })
      const value_at = (target_unix) =>
        ktc_pick_at({
          pick_year: 2023,
          pick_round: 1,
          pick_overall_position: 1,
          num_teams: 12,
          target_unix,
          idx
        })

      // Regression signature: without epoch-second normalization,
      // `rows[0].d <= target_unix` is Date-vs-number and always false, so the
      // exact-match fast path never fires and this returns null instead of a
      // real value -- silently indistinguishable from "no KTC pick data yet".
      value_at(
        Math.floor(new Date('2023-12-01T00:00:00Z').getTime() / 1000)
      ).should.equal(500)
      value_at(
        Math.floor(new Date('2024-02-01T00:00:00Z').getTime() / 1000)
      ).should.equal(400)
      value_at(
        Math.floor(new Date('2024-12-01T00:00:00Z').getTime() / 1000)
      ).should.equal(300)
    })

    it('falls back to an analog year when the target pick_year has no series of its own', async () => {
      const idx = await load_pick_ktc_indexes({ is_superflex: true })
      // pick_year 2025 has no 2025__1__1 entry in pick_pid_by_yrs, so the exact
      // path is skipped entirely. years_out = 2025 - 2025 = 0, so the analog
      // date is the 2023 series' same month/day as the target: October 15,
      // 2023 -- inside [2023-09-08, 2024-08-01], resolving to the September
      // observation (500) via lookup_le.
      const target_unix = Math.floor(
        new Date('2025-10-15T00:00:00Z').getTime() / 1000
      )
      const value = ktc_pick_at({
        pick_year: 2025,
        pick_round: 1,
        pick_overall_position: 1,
        num_teams: 12,
        target_unix,
        idx
      })
      value.should.equal(500)
    })

    it('returns null -- not a stale value -- for a target genuinely before any exact or analog data', async () => {
      // pick_year 2020 also has no exact series. years_out = 2020 - 2020 = 0,
      // so the analog date is 2023-01-01 -- before the series' first
      // observation (2023-09-08) -- so the analog window rejects it too.
      // This is the legitimate null this module documents (no KTC pick data
      // before 2023-09-08), which a regression that nulls everything must
      // remain distinguishable from.
      const idx = await load_pick_ktc_indexes({ is_superflex: true })
      const target_unix = Math.floor(
        new Date('2020-01-01T00:00:00Z').getTime() / 1000
      )
      const value = ktc_pick_at({
        pick_year: 2020,
        pick_round: 1,
        pick_overall_position: 1,
        num_teams: 12,
        target_unix,
        idx
      })
      expect(value).to.equal(null)
    })

    it('returns null when the pick cannot be slotted or is missing required fields', async () => {
      const idx = await load_pick_ktc_indexes({ is_superflex: true })
      const target_unix = Math.floor(
        new Date('2023-12-01T00:00:00Z').getTime() / 1000
      )
      expect(
        ktc_pick_at({
          pick_year: 2023,
          pick_round: 1,
          pick_overall_position: 1,
          num_teams: null,
          target_unix,
          idx
        })
      ).to.equal(null)
      expect(
        ktc_pick_at({
          pick_year: null,
          pick_round: 1,
          pick_overall_position: 1,
          num_teams: 12,
          target_unix,
          idx
        })
      ).to.equal(null)
      expect(
        ktc_pick_at({
          pick_year: 2023,
          pick_round: null,
          pick_overall_position: 1,
          num_teams: 12,
          target_unix,
          idx
        })
      ).to.equal(null)
    })
  })

  describe('ktc_pick_at future picks', function () {
    before(async () => {
      await cleanup()
      // A future-class pick series. Future picks are quoted by tier only --
      // there is no overall position until the standings that set the order
      // have happened.
      await seed_pick({
        pid: PID_2027_R1_MID,
        ktc_player_id: 900021,
        season_year: 2027,
        round: 1,
        slot: PICK_SLOT.MID
      })
      await seed_valuations({
        pid: PID_2027_R1_MID,
        is_superflex: true,
        observations: [
          { observed_at: new Date('2026-01-10T00:00:00Z'), value: 5600 }
        ]
      })
    })
    after(cleanup)

    it('prices a future pick with no assigned position at the mid tier', async () => {
      const idx = await load_pick_ktc_indexes({ is_superflex: true })
      const value = ktc_pick_at({
        pick_year: 2027,
        pick_round: 1,
        pick_overall_position: null,
        num_teams: 10,
        target_unix: Math.floor(
          new Date('2026-07-29T00:00:00Z').getTime() / 1000
        ),
        idx
      })
      // Regression signature: slot_from_position returns null for a null
      // position, and ktc_pick_at used to bail on that -- so every future pick
      // priced as NULL and one whole side of any trade involving one silently
      // vanished from the lineage snapshot.
      value.should.equal(5600)
    })

    it('still returns null when the position is known but num_teams is not', async () => {
      const idx = await load_pick_ktc_indexes({ is_superflex: true })
      expect(
        ktc_pick_at({
          pick_year: 2027,
          pick_round: 1,
          pick_overall_position: 5,
          num_teams: null,
          target_unix: Math.floor(
            new Date('2026-07-29T00:00:00Z').getTime() / 1000
          ),
          idx
        })
      ).to.equal(null)
    })
  })

  describe('ktc_pick_at overall position outside round one', function () {
    // All three slots of one round, at values far enough apart that a
    // mis-slotted pick resolves to a different number rather than the same one
    // -- a fixture whose slots shared a value could not tell the two apart.
    const TARGET_UNIX = Math.floor(
      new Date('2026-07-29T00:00:00Z').getTime() / 1000
    )
    const NUM_TEAMS = 10

    before(async () => {
      await cleanup()
      const seeds = [
        { pid: PID_2026_R2_EARLY, slot: PICK_SLOT.EARLY, value: 3341 },
        { pid: PID_2026_R2_MID, slot: PICK_SLOT.MID, value: 3035 },
        { pid: PID_2026_R2_LATE, slot: PICK_SLOT.LATE, value: 2821 }
      ]
      for (const [index, seed] of seeds.entries()) {
        await seed_pick({
          pid: seed.pid,
          ktc_player_id: 900031 + index,
          season_year: 2026,
          round: 2,
          slot: seed.slot
        })
        await seed_valuations({
          pid: seed.pid,
          is_superflex: true,
          observations: [
            { observed_at: new Date('2026-01-10T00:00:00Z'), value: seed.value }
          ]
        })
      }
    })
    after(cleanup)

    it('reduces a league-wide overall position to its position within the round', async () => {
      const idx = await load_pick_ktc_indexes({ is_superflex: true })
      const value_at = (pick_overall_position) =>
        ktc_pick_at({
          pick_year: 2026,
          pick_round: 2,
          pick_overall_position,
          num_teams: NUM_TEAMS,
          target_unix: TARGET_UNIX,
          idx
        })

      // Regression signature: the overall rank went straight into the slot
      // bucketer, and an overall rank in round 2 or beyond always exceeds two
      // thirds of num_teams -- so every one of these resolved to LATE (2821),
      // understating every pick outside round 1 in the league.
      value_at(11).should.equal(3341) // round 2 pick 1 -- early
      value_at(13).should.equal(3341) // round 2 pick 3 -- early
      value_at(14).should.equal(3035) // round 2 pick 4 -- mid
      value_at(17).should.equal(2821) // round 2 pick 7 -- late
      value_at(20).should.equal(2821) // round 2 pick 10 -- late
    })

    it('prices at the mid tier when the overall position falls outside its own round', async () => {
      const idx = await load_pick_ktc_indexes({ is_superflex: true })
      // Overall 3 cannot be a round-2 pick in a 10-team league, so the position
      // and the round disagree. Mid is the same default an unassigned future
      // pick takes, rather than the EARLY edge the raw value buckets to.
      ktc_pick_at({
        pick_year: 2026,
        pick_round: 2,
        pick_overall_position: 3,
        num_teams: NUM_TEAMS,
        target_unix: TARGET_UNIX,
        idx
      }).should.equal(3035)
    })
  })
})
