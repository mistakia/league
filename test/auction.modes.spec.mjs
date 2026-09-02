/* global describe before beforeEach afterEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'
import dayjs from 'dayjs'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import { current_season } from '#constants'
import {
  resolve_auction_mode_at,
  get_auction_mode,
  AUCTION_MODES
} from '#libs-server/auction-modes.mjs'
import {
  set_auction_block_opt_in,
  get_block_eligible_team_ids,
  get_finalized_auction_blocks
} from '#libs-server/auction-blocks.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

const league_id = 1
const season_year = current_season.year

describe('auction mode resolution', function () {
  describe('the rule, without a database', function () {
    const base = dayjs('2026-09-04T12:00:00Z')

    const block = {
      block_at: base.toDate(),
      end_at: base.add(30, 'minute').toDate()
    }

    it('is election outside every finalized block', function () {
      const result = resolve_auction_mode_at({
        now: base.subtract(1, 'minute'),
        blocks: [block]
      })
      expect(result.auction_mode).to.equal(AUCTION_MODES.ELECTION)
    })

    it('flips to live at a block start and back at its end', function () {
      expect(
        resolve_auction_mode_at({ now: base, blocks: [block] }).auction_mode,
        'the first instant of the block is live'
      ).to.equal(AUCTION_MODES.LIVE)

      expect(
        resolve_auction_mode_at({
          now: base.add(29, 'minute'),
          blocks: [block]
        }).auction_mode
      ).to.equal(AUCTION_MODES.LIVE)

      // Half-open: `end_at` is the first instant AFTER the block, so two
      // adjacent sessions cannot both claim the same instant.
      expect(
        resolve_auction_mode_at({
          now: base.add(30, 'minute'),
          blocks: [block]
        }).auction_mode
      ).to.equal(AUCTION_MODES.ELECTION)
    })

    it('holds the auction live from the final block to the period end', function () {
      const final_block_at = base.add(2, 'day')
      const period_end = final_block_at.add(12, 'hour')

      expect(
        resolve_auction_mode_at({
          now: final_block_at.subtract(1, 'minute'),
          final_block_at,
          period_end
        }).auction_mode
      ).to.equal(AUCTION_MODES.ELECTION)

      const at_final = resolve_auction_mode_at({
        now: final_block_at,
        final_block_at,
        period_end
      })
      expect(at_final.auction_mode).to.equal(AUCTION_MODES.LIVE)
      expect(at_final.is_final_block, 'named as the final block').to.equal(true)

      // The final block runs to the period end and nothing closes it early: it
      // is the design's only termination guarantee.
      expect(
        resolve_auction_mode_at({
          now: period_end.subtract(1, 'minute'),
          final_block_at,
          period_end
        }).auction_mode
      ).to.equal(AUCTION_MODES.LIVE)

      expect(
        resolve_auction_mode_at({ now: period_end, final_block_at, period_end })
          .auction_mode,
        'the period ending ends the auction'
      ).to.equal(AUCTION_MODES.ELECTION)
    })
  })

  describe('against the league', function () {
    let now

    before(async function () {
      this.timeout(60 * 1000)
      await knex.seed.run()
    })

    afterEach(function () {
      MockDate.reset()
    })

    beforeEach(async function () {
      this.timeout(60 * 1000)
      now = current_season.regular_season_start.subtract(1, 'month')
      MockDate.set(now.toISOString())
      await league(knex)

      await knex('seasons')
        .where({ lid: league_id, season_year })
        .update({
          free_agency_period_start: now.subtract(1, 'hour').toDate(),
          free_agency_period_end: now.add(5, 'day').toDate(),
          auction_block_notice_minutes: 60
        })
    })

    it('reads live from a convened block and election either side of it', async function () {
      this.timeout(60 * 1000)
      const block_at = now.add(4, 'hour').minute(0).second(0).millisecond(0)

      for (const tid of await get_block_eligible_team_ids({ lid: league_id })) {
        await set_auction_block_opt_in({
          lid: league_id,
          tid,
          user_id: 1,
          block_at,
          is_opted_in: true
        })
      }
      expect(
        await get_finalized_auction_blocks({ lid: league_id }),
        'the block convened'
      ).to.have.length(1)

      const before_block = await get_auction_mode({
        lid: league_id,
        now: block_at.subtract(1, 'minute')
      })
      expect(before_block.auction_mode).to.equal(AUCTION_MODES.ELECTION)

      const inside = await get_auction_mode({ lid: league_id, now: block_at })
      expect(inside.auction_mode).to.equal(AUCTION_MODES.LIVE)
      expect(inside.is_final_block).to.equal(false)

      const after = await get_auction_mode({
        lid: league_id,
        now: block_at.add(15, 'minute')
      })
      expect(after.auction_mode).to.equal(AUCTION_MODES.ELECTION)
    })

    it('never consults the election-mode system flag', async function () {
      this.timeout(60 * 1000)
      // THE FLAG SELECTS THE AUCTION SYSTEM, NOT THE MODE. Reading it here would
      // make a season boolean a second source of truth for mode, and the two
      // would disagree the moment a block convened -- so the answer must be the
      // same under both values with the same schedule.
      const at = now.add(2, 'hour')

      await knex('seasons')
        .where({ lid: league_id, season_year })
        .update({ is_auction_election_mode_enabled: true })
      const enabled = await get_auction_mode({ lid: league_id, now: at })

      await knex('seasons')
        .where({ lid: league_id, season_year })
        .update({ is_auction_election_mode_enabled: false })
      const disabled = await get_auction_mode({ lid: league_id, now: at })

      expect(enabled.auction_mode).to.equal(disabled.auction_mode)
      expect(enabled.auction_mode).to.equal(AUCTION_MODES.ELECTION)
    })
  })
})
