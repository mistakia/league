/* global describe before beforeEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import { current_season, player_tag_types } from '#constants'
import get_top_restricted_free_agency_bids from '#libs-server/get-top-restricted-free-agency-bids.mjs'
import { selectPlayer, addPlayer } from './utils/index.mjs'
import { insert_restricted_free_agency_bid } from './utils/insert-restricted-free-agency-bid.mjs'
import run from '#scripts/process-restricted-free-agency-bids.mjs'
import { epoch_to_timestamptz } from '#libs-shared'

dayjs.extend(utc)
dayjs.extend(timezone)

process.env.NODE_ENV = 'test'

chai.should()
const expect = chai.expect
const { regular_season_start } = current_season

const HOUR = 60 * 60

// Two things ship together here, and they are coupled: the per-league
// processing pause is what CREATES a multi-window backlog, and settling a
// backlog was defective before this change.
//
// Under normal operation exactly one auction is ever open -- a window's bids
// process `restricted_free_agency_processing_lead_hours` before the next
// window opens -- so neither defect below is reachable and no existing spec
// could have seen them.
describe('SCRIPTS - restricted free agency processing pause', function () {
  const leagueId = 1

  before(async function () {
    this.timeout(60 * 1000)
    MockDate.set(regular_season_start.subtract('1', 'month').toISOString())
    await knex.seed.run()
  })

  beforeEach(async function () {
    this.timeout(60 * 1000)
    await league(knex)

    seeded_pids = []

    const tran_date = regular_season_start.subtract('3', 'month').unix()

    await knex('seasons')
      .update({
        season_year: current_season.year,
        restricted_free_agency_period_start: epoch_to_timestamptz(tran_date),
        restricted_free_agency_period_end: regular_season_start
          .subtract('1', 'month')
          .toDate(),
        extension_deadline_at: regular_season_start
          .subtract('4', 'month')
          .toDate(),
        restricted_free_agency_first_window_at: dayjs.unix(tran_date).toDate(),
        restricted_free_agency_window_hours: 24,
        restricted_free_agency_processing_lead_hours: 3,
        restricted_free_agency_processing_paused_at: null,
        restricted_free_agency_processing_paused_until: null,
        restricted_free_agency_processing_paused_reason: null
      })
      .where({ lid: leagueId })

    MockDate.set(
      regular_season_start
        .subtract('2', 'month')
        .hour(12)
        .minute(0)
        .second(0)
        .toDate()
    )
  })

  // `selectPlayer` draws at random from a pool of about 20 eligible backs, so
  // two seeds in one test can land on the SAME player -- which made the
  // ordering assertions below compare a pid against itself and fail roughly
  // once in twenty runs. Every auction a test seeds must be a distinct player,
  // so the pids seeded so far are excluded from each subsequent draw.
  let seeded_pids = []

  // Seed one auction that is already past its processing time.
  const seed_due_auction = async ({ team_id, bid_amount, announced_ago }) => {
    const player = await selectPlayer({ exclude_pids: seeded_pids })
    seeded_pids.push(player.pid)

    await addPlayer({
      leagueId,
      player,
      teamId: team_id,
      userId: 1,
      tag: player_tag_types.RESTRICTED_FREE_AGENCY
    })

    const announced_at = Math.round(Date.now() / 1000) - announced_ago

    await insert_restricted_free_agency_bid({
      pid: player.pid,
      user_id: 1,
      bid_amount,
      tid: team_id,
      lid: leagueId,
      original_team_id: team_id,
      announced_at,
      nominated_at: announced_at - HOUR
    })

    return player
  }

  const set_pause = async ({ paused_at = null, paused_until = null, reason }) =>
    knex('seasons')
      .where({ lid: leagueId, season_year: current_season.year })
      .update({
        restricted_free_agency_processing_paused_at:
          paused_at || dayjs().toISOString(),
        restricted_free_agency_processing_paused_until: paused_until,
        restricted_free_agency_processing_paused_reason: reason
      })

  describe('pause', function () {
    it('holds a due bid open-ended when no expiry is set', async () => {
      // The normal case. Resuming settles bids irreversibly -- signing
      // players, moving cap space, writing transactions -- so that step wants
      // a human rather than a lapsed timer, and an operator who does not yet
      // know how long they need must not be forced to guess.
      const player = await seed_due_auction({
        team_id: 1,
        bid_amount: 10,
        announced_ago: 30 * HOUR
      })

      await set_pause({ reason: 'commissioner is playing it by ear' })

      const result = await run({ dry_run: false })

      const bid = await knex('restricted_free_agency_bids')
        .where({ pid: player.pid })
        .first()

      expect(bid.processed).to.equal(null)
      expect(bid.is_successful).to.equal(null)
      expect(result.shortfall).to.equal(null)
    })

    it('holds a due bid while a bounded pause is active', async () => {
      const player = await seed_due_auction({
        team_id: 1,
        bid_amount: 10,
        announced_ago: 30 * HOUR
      })

      await set_pause({
        paused_until: dayjs().add(6, 'hour').toISOString(),
        reason: 'commissioner hold for a late nomination'
      })

      await run({ dry_run: false })

      const bid = await knex('restricted_free_agency_bids')
        .where({ pid: player.pid })
        .first()

      expect(bid.processed).to.equal(null)
      expect(bid.is_successful).to.equal(null)
    })

    it('does not report a shortfall for bids it is deliberately holding', async () => {
      // The oracle exists to catch the loop SILENTLY skipping eligible bids.
      // A pause skips them loudly and on purpose, so counting them would turn
      // every paused run into a false pipeline failure -- the same "a hold
      // reads as a break" defect that makes the crontab lever wrong.
      await seed_due_auction({
        team_id: 1,
        bid_amount: 10,
        announced_ago: 30 * HOUR
      })

      await set_pause({
        paused_until: dayjs().add(6, 'hour').toISOString(),
        reason: 'commissioner hold for a late nomination'
      })

      const result = await run({ dry_run: false })

      expect(result.shortfall).to.equal(null)
    })

    it('processes normally once the pause has elapsed, with no clearing step', async () => {
      // The self-healing property is the whole reason this is a timestamp
      // rather than a boolean somebody has to remember to unset.
      const player = await seed_due_auction({
        team_id: 1,
        bid_amount: 10,
        announced_ago: 30 * HOUR
      })

      await set_pause({
        paused_until: dayjs().subtract(1, 'hour').toISOString(),
        reason: 'a hold that has already expired'
      })

      await run({ dry_run: false })

      const bid = await knex('restricted_free_agency_bids')
        .where({ pid: player.pid })
        .first()

      expect(bid.processed).to.not.equal(null)
      expect(bid.is_successful).to.equal(true)
    })

    it('leaves an unpaused league processing', async () => {
      const player = await seed_due_auction({
        team_id: 1,
        bid_amount: 10,
        announced_ago: 30 * HOUR
      })

      await run({ dry_run: false })

      const bid = await knex('restricted_free_agency_bids')
        .where({ pid: player.pid })
        .first()

      expect(bid.processed).to.not.equal(null)
      expect(bid.is_successful).to.equal(true)
    })
  })

  describe('backlog ordering', function () {
    it('settles the EARLIEST announced auction first, not the richest', async () => {
      // Pre-fix this returned the globally highest effective bid across every
      // open auction, so the later window jumped the queue. That changes
      // outcomes rather than merely sequence: signing a player consumes cap
      // space and a roster slot, so an auction settled early can starve a
      // team's bid in an auction that constitutionally preceded it.
      const early_player = await seed_due_auction({
        team_id: 1,
        bid_amount: 10,
        announced_ago: 54 * HOUR
      })

      const rich_later_player = await seed_due_auction({
        team_id: 2,
        bid_amount: 50,
        announced_ago: 30 * HOUR
      })

      const next_bids = await get_top_restricted_free_agency_bids(leagueId)

      expect(next_bids.length).to.be.greaterThan(0)

      const selected_pids = [...new Set(next_bids.map((bid) => bid.pid))]
      expect(selected_pids).to.deep.equal([early_player.pid])
      expect(selected_pids).to.not.include(rich_later_player.pid)
    })

    it('returns exactly one auction per call', async () => {
      await seed_due_auction({
        team_id: 1,
        bid_amount: 10,
        announced_ago: 54 * HOUR
      })
      await seed_due_auction({
        team_id: 2,
        bid_amount: 50,
        announced_ago: 30 * HOUR
      })

      const next_bids = await get_top_restricted_free_agency_bids(leagueId)
      const selected_pids = [...new Set(next_bids.map((bid) => bid.pid))]

      expect(selected_pids.length).to.equal(1)
    })

    it('drains a whole backlog in one run', async () => {
      const early_player = await seed_due_auction({
        team_id: 1,
        bid_amount: 10,
        announced_ago: 54 * HOUR
      })
      const later_player = await seed_due_auction({
        team_id: 2,
        bid_amount: 50,
        announced_ago: 30 * HOUR
      })

      const result = await run({ dry_run: false })

      const bids = await knex('restricted_free_agency_bids').whereIn('pid', [
        early_player.pid,
        later_player.pid
      ])

      expect(bids.length).to.equal(2)
      for (const bid of bids) {
        expect(bid.processed).to.not.equal(null)
      }
      expect(result.shortfall).to.equal(null)
    })
  })
})
