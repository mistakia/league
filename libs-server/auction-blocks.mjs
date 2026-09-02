import dayjs from 'dayjs'

import db from '#db'
import { Roster, get_free_agent_period } from '#libs-shared'
import { current_season, AUCTION_BLOCK_GRANULARITY_MINUTES } from '#constants'
import getRoster from './get-roster.mjs'
import getLeague from './get-league.mjs'
import debug from 'debug'

const log = debug('auction-blocks')

export const auction_block_error = (message) => {
  const error = new Error(message)
  error.is_auction_block_error = true
  return error
}

/**
 * The 15-minute boundary a given instant belongs to.
 *
 * Blocks are offered at a fixed granularity across the whole free agency period,
 * so a block is addressed by its start instant alone. Anchoring on the UTC hour
 * rather than on the period start keeps a slot's identity stable when the period
 * start moves, which it has done twice.
 */
export const floor_to_block = (at) => {
  const value = dayjs(at)
  const minutes = value.minute()
  return value
    .minute(minutes - (minutes % AUCTION_BLOCK_GRANULARITY_MINUTES))
    .second(0)
    .millisecond(0)
}

export const is_block_boundary = (at) =>
  floor_to_block(at).valueOf() === dayjs(at).valueOf()

/**
 * Teams that hold an open active roster spot.
 *
 * THE UNANIMITY DENOMINATOR, evaluated at the instant it is asked. A team with a
 * full active roster has nothing left to bid on and is not made to attend, which
 * is what makes the denominator nine rather than ten for 2026 -- one team is at
 * 16 of 16 and sits the auction out.
 *
 * It shrinks as the auction fills rosters, so it is NOT stable across the
 * period. That is exactly why finalization is recorded rather than re-derived:
 * see db/adhoc/2026-09-02-create-auction-blocks.sql.
 */
export const get_block_eligible_team_ids = async ({
  lid,
  season_year = current_season.year,
  league: provided_league
}) => {
  const league = provided_league || (await getLeague({ lid }))
  const teams = await db('teams').where({ lid, season_year })

  const eligible = []
  for (const team of teams) {
    const roster = new Roster({
      roster: await getRoster({ tid: team.team_id }),
      league
    })
    if (roster.availableSpace > 0) eligible.push(team.team_id)
  }
  return eligible.sort((a, b) => a - b)
}

export const get_live_block_opt_ins = async ({
  lid,
  season_year = current_season.year,
  db_client = db
}) =>
  db_client('auction_block_opt_ins')
    .where({ lid, season_year })
    .whereNull('withdrawn_at')
    .orderBy('block_at', 'asc')

export const get_finalized_auction_blocks = async ({
  lid,
  season_year = current_season.year,
  db_client = db
}) =>
  db_client('auction_blocks')
    .where({ lid, season_year })
    .orderBy('block_at', 'asc')

/**
 * Record or revise a team's opt-in on one block.
 *
 * `is_opted_in` false WITHDRAWS rather than deleting, and the row survives,
 * because the opt-ins are how the league answers "who was in when this block
 * finalized" after the fact. A team that opts back into the same slot updates
 * its row -- unlike an election, where a withdrawn maximum and a later one are
 * genuinely different instructions.
 *
 * WITHDRAWING AFTER FINALIZATION DOES NOT CANCEL THE BLOCK. The row moves, the
 * `auction_blocks` row does not, and the block runs. Nobody is pulled into a
 * live auction on short notice, and equally nobody has one pulled out from under
 * them once it is announced.
 */
export const set_auction_block_opt_in = async ({
  lid,
  season_year = current_season.year,
  tid,
  user_id,
  block_at,
  is_opted_in,
  now = current_season.now
}) => {
  const league = await getLeague({ lid })
  const period = get_free_agent_period(league)

  if (!period.start) {
    throw auction_block_error('league has no free agency period configured')
  }

  const slot = floor_to_block(block_at)

  if (!is_block_boundary(block_at)) {
    throw auction_block_error(
      `block_at must be a ${AUCTION_BLOCK_GRANULARITY_MINUTES}-minute boundary`
    )
  }

  if (slot.isBefore(period.start) || !slot.isBefore(period.end)) {
    throw auction_block_error('block is outside the free agency period')
  }

  if (!slot.isAfter(now)) {
    throw auction_block_error('block has already started')
  }

  const existing = await db('auction_block_opt_ins')
    .where({ lid, season_year, tid })
    .where('block_at', slot.toDate())
    .first()

  if (existing) {
    await db('auction_block_opt_ins')
      .where('opt_in_id', existing.opt_in_id)
      .update({
        user_id,
        opted_in_at: is_opted_in ? new Date() : existing.opted_in_at,
        withdrawn_at: is_opted_in ? null : new Date()
      })
  } else {
    if (!is_opted_in) return { block_at: slot, finalized: null }
    await db('auction_block_opt_ins').insert({
      lid,
      season_year,
      tid,
      user_id,
      block_at: slot.toDate(),
      opted_in_at: new Date(),
      withdrawn_at: null
    })
  }

  const finalized = await evaluate_auction_block_finalization({
    lid,
    season_year,
    now
  })

  return { block_at: slot, finalized }
}

/**
 * Finalize every candidate slot that has reached unanimity outside the notice
 * threshold, and merge it into any session it touches.
 *
 * IDEMPOTENT AND EVALUATED LAZILY, on the opt-in write and on every read of the
 * schedule. There is no runner and no cron. Two things can reach unanimity --
 * an opt-in arriving, and the ELIGIBLE SET SHRINKING when a team fills its last
 * active spot -- and only the first has a write path of its own. Evaluating on
 * read covers the second for free, because the calendar, the mode resolver and
 * the block route all read the schedule continuously; a runner would cover the
 * same ground with a log, a channel and a failure signal to maintain.
 *
 * THREE RULES, all of them here rather than spread across callers:
 *
 * - UNANIMITY is among the teams that hold an open active roster spot NOW. A
 *   team with a full roster has nothing to bid on and is not counted.
 * - THE NOTICE THRESHOLD LAPSES rather than fires. Unanimity reached with less
 *   than `auction_block_notice_minutes` to go does not convene the block: opting
 *   in is agreeing to attend, and nobody is pulled into a live auction on short
 *   notice. The slot simply never finalizes, which needs no state -- the
 *   condition is a comparison against `now` and it only ever gets worse.
 * - CONSECUTIVE UNANIMOUS BLOCKS RUN AS ONE SESSION, so a slot adjacent to an
 *   already-finalized session extends that session's `end_at` instead of
 *   opening a second row. Block duration is whatever the league opted into.
 */
export const evaluate_auction_block_finalization = async ({
  lid,
  season_year = current_season.year,
  now = current_season.now,
  league: provided_league
}) => {
  const league = provided_league || (await getLeague({ lid }))
  const period = get_free_agent_period(league)
  if (!period.start) return []

  const eligible_team_ids = await get_block_eligible_team_ids({
    lid,
    season_year,
    league
  })

  // Nobody left to convene for. An exhausted eligible set IS the
  // auction-complete condition, so this is a no-op rather than a unanimous
  // block of zero teams -- which would otherwise finalize every open slot.
  if (!eligible_team_ids.length) return []

  const opt_ins = await get_live_block_opt_ins({ lid, season_year })
  const finalized = await get_finalized_auction_blocks({ lid, season_year })

  const by_slot = new Map()
  for (const opt_in of opt_ins) {
    const key = dayjs(opt_in.block_at).valueOf()
    if (!by_slot.has(key)) by_slot.set(key, new Set())
    by_slot.get(key).add(opt_in.tid)
  }

  const notice_floor = dayjs(now).add(
    league.auction_block_notice_minutes,
    'minute'
  )

  const already_covered = (slot) =>
    finalized.some(
      (block) =>
        !slot.isBefore(dayjs(block.block_at)) &&
        slot.isBefore(dayjs(block.end_at))
    )

  const newly_finalized = []

  for (const [key, tids] of [...by_slot.entries()].sort(
    (a, b) => a[0] - b[0]
  )) {
    const slot = dayjs(key)

    if (already_covered(slot)) continue
    if (slot.isBefore(period.start) || !slot.isBefore(period.end)) continue
    if (slot.isBefore(notice_floor)) continue

    const is_unanimous = eligible_team_ids.every((tid) => tids.has(tid))
    if (!is_unanimous) continue

    const end_at = slot.add(AUCTION_BLOCK_GRANULARITY_MINUTES, 'minute')
    const record = await finalize_auction_block({
      lid,
      season_year,
      block_at: slot,
      end_at,
      eligible_team_count: eligible_team_ids.length,
      finalized_at: dayjs(now)
    })

    if (record) {
      newly_finalized.push(record)
      // Re-read so the next slot in this same pass sees the session it may be
      // adjacent to, including one this loop just extended.
      finalized.length = 0
      finalized.push(
        ...(await get_finalized_auction_blocks({ lid, season_year }))
      )
    }
  }

  return newly_finalized
}

/**
 * Write one finalization, merging it into an adjacent session.
 *
 * The merge is what makes "block duration is whatever the league opted into"
 * true. Three adjacencies are possible and all three are handled: the slot
 * extends the session that ends where it starts, the slot precedes a session
 * that starts where it ends, or it does both and the two sessions become one.
 */
const finalize_auction_block = async ({
  lid,
  season_year,
  block_at,
  end_at,
  eligible_team_count,
  finalized_at
}) => {
  const blocks = await get_finalized_auction_blocks({ lid, season_year })

  const before = blocks.find(
    (block) => dayjs(block.end_at).valueOf() === block_at.valueOf()
  )
  const after = blocks.find(
    (block) => dayjs(block.block_at).valueOf() === end_at.valueOf()
  )

  if (before && after) {
    await db('auction_blocks')
      .where('block_id', before.block_id)
      .update({ end_at: after.end_at })
    await db('auction_blocks').where('block_id', after.block_id).del()
    log(
      `merged block ${block_at.toISOString()} into session ${dayjs(before.block_at).toISOString()} -> ${dayjs(after.end_at).toISOString()}`
    )
    return {
      ...before,
      end_at: after.end_at,
      merged_slot_at: block_at.toDate()
    }
  }

  if (before) {
    await db('auction_blocks')
      .where('block_id', before.block_id)
      .update({ end_at: end_at.toDate() })
    log(
      `extended session ${dayjs(before.block_at).toISOString()} to ${end_at.toISOString()}`
    )
    return {
      ...before,
      end_at: end_at.toDate(),
      merged_slot_at: block_at.toDate()
    }
  }

  if (after) {
    await db('auction_blocks')
      .where('block_id', after.block_id)
      .update({ block_at: block_at.toDate() })
    log(`extended session back to ${block_at.toISOString()}`)
    return {
      ...after,
      block_at: block_at.toDate(),
      merged_slot_at: block_at.toDate()
    }
  }

  // ON CONFLICT DO NOTHING rather than a pre-check: finalization is evaluated
  // from the opt-in write AND from every read, so two evaluations can race here
  // and the unique index is the only thing that can settle it.
  const inserted = await db('auction_blocks')
    .insert({
      lid,
      season_year,
      block_at: block_at.toDate(),
      end_at: end_at.toDate(),
      finalized_at: finalized_at.toDate(),
      eligible_team_count
    })
    .onConflict(['lid', 'season_year', 'block_at'])
    .ignore()
    .returning('*')

  if (!inserted.length) return null

  log(
    `finalized block ${block_at.toISOString()} on unanimity among ${eligible_team_count} team(s)`
  )
  return inserted[0]
}

export default {
  floor_to_block,
  is_block_boundary,
  get_block_eligible_team_ids,
  get_live_block_opt_ins,
  get_finalized_auction_blocks,
  set_auction_block_opt_in,
  evaluate_auction_block_finalization,
  auction_block_error
}
