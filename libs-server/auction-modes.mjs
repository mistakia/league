import dayjs from 'dayjs'

import { current_season } from '#constants'
import getLeague from './get-league.mjs'
import {
  get_finalized_auction_blocks,
  evaluate_auction_block_finalization
} from './auction-blocks.mjs'
import { get_auction_final_block } from './auction-final-block.mjs'

export const AUCTION_MODES = {
  ELECTION: 'election',
  LIVE: 'live'
}

/**
 * Which mode is in force at an instant, given the sessions already finalized.
 *
 * PURE, and the single source of truth for the question. `live` inside any
 * finalized session and from the final block onward; `election` everywhere else.
 *
 * IT DOES NOT READ `is_auction_election_mode_enabled`, and that is a rule rather
 * than an omission. That column selects which auction SYSTEM a league-season
 * runs -- this design, or the 2021-2025 timer-driven open outcry it can roll
 * back to. Mode is a function of the block schedule and the instant. A season
 * boolean answering the mode question would be a second source of truth that
 * disagreed the moment a block convened.
 *
 * @param {object} params
 * @param {dayjs.Dayjs} params.now
 * @param {Array<{block_at: *, end_at: *}>} params.blocks finalized sessions
 * @param {dayjs.Dayjs|null} params.final_block_at
 * @param {dayjs.Dayjs|null} params.period_end
 */
export const resolve_auction_mode_at = ({
  now,
  blocks = [],
  final_block_at = null,
  period_end = null
}) => {
  const at = dayjs(now)

  for (const block of blocks) {
    const starts = dayjs(block.block_at)
    const ends = dayjs(block.end_at)
    if (!at.isBefore(starts) && at.isBefore(ends)) {
      return {
        auction_mode: AUCTION_MODES.LIVE,
        block_at: starts,
        block_end_at: ends,
        is_final_block: false
      }
    }
  }

  // THE FINAL BLOCK RUNS TO THE PERIOD END and nothing closes it early: it is
  // the design's only termination guarantee, so it has to hold the auction in
  // live mode until either the board is empty or the period is over. It carries
  // no opt-in, no unanimity and no row -- see auction-final-block.mjs.
  if (final_block_at && !at.isBefore(dayjs(final_block_at))) {
    if (period_end && !at.isBefore(dayjs(period_end))) {
      return {
        auction_mode: AUCTION_MODES.ELECTION,
        block_at: null,
        block_end_at: null,
        is_final_block: false
      }
    }
    return {
      auction_mode: AUCTION_MODES.LIVE,
      block_at: dayjs(final_block_at),
      block_end_at: period_end ? dayjs(period_end) : null,
      is_final_block: true
    }
  }

  return {
    auction_mode: AUCTION_MODES.ELECTION,
    block_at: null,
    block_end_at: null,
    is_final_block: false
  }
}

/**
 * The mode for a live league, read from its finalized blocks and its computed
 * final block.
 *
 * Reads the finalized SET rather than scanning the 480 candidate slots a 2026
 * period holds: candidacy is not stored and does not need to be, since a slot
 * that never convened cannot change the mode.
 *
 * It evaluates finalization on the way past. Two things reach unanimity -- an
 * opt-in arriving and the eligible set shrinking -- and only the first has a
 * write path, so the read is what covers the second. See auction-blocks.mjs.
 */
export const get_auction_mode = async ({
  lid,
  season_year = current_season.year,
  now = current_season.now,
  league: provided_league
}) => {
  const league = provided_league || (await getLeague({ lid }))

  await evaluate_auction_block_finalization({ lid, season_year, now, league })

  const blocks = await get_finalized_auction_blocks({ lid, season_year })
  const final_block = await get_auction_final_block({ lid, season_year, now })

  return resolve_auction_mode_at({
    now,
    blocks,
    final_block_at: final_block ? final_block.final_block_at : null,
    period_end: final_block ? final_block.period_end : null
  })
}

export default {
  AUCTION_MODES,
  resolve_auction_mode_at,
  get_auction_mode
}
