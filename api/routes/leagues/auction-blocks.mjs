import express from 'express'
import dayjs from 'dayjs'

import { current_season } from '#constants'
import { verifyUserTeam, getLeague } from '#libs-server'
import {
  set_auction_block_opt_in,
  get_live_block_opt_ins,
  get_finalized_auction_blocks,
  get_block_eligible_team_ids,
  evaluate_auction_block_finalization
} from '#libs-server/auction-blocks.mjs'
import { get_auction_final_block } from '#libs-server/auction-final-block.mjs'

const router = express.Router({ mergeParams: true })

const to_unix = (value) => (value ? dayjs(value).unix() : null)

/**
 * The whole block schedule in one payload: opt-ins by slot, the finalized
 * sessions, and the computed final block.
 *
 * OPT-INS ARE PUBLIC BY DESIGN, and named rather than counted. An election is a
 * sealed bid; an opt-in is an availability, and unanimity is a public fact by
 * construction since a block convening tells everyone who was in. A manager
 * cannot argue for a slot against a bare count -- they need to see who is
 * already there and who is missing.
 */
const build_schedule = async ({ lid, season_year }) => {
  const league = await getLeague({ lid })

  // Finalization is evaluated on the read as well as on the write, because the
  // ELIGIBLE SET SHRINKING can reach unanimity with no opt-in arriving and that
  // has no write path of its own. See libs-server/auction-blocks.mjs.
  await evaluate_auction_block_finalization({ lid, season_year })

  const [opt_ins, blocks, eligible_team_ids, final_block] = await Promise.all([
    get_live_block_opt_ins({ lid, season_year }),
    get_finalized_auction_blocks({ lid, season_year }),
    get_block_eligible_team_ids({ lid, season_year }),
    get_auction_final_block({ lid, season_year })
  ])

  const by_slot = new Map()
  for (const opt_in of opt_ins) {
    const key = to_unix(opt_in.block_at)
    if (!by_slot.has(key)) by_slot.set(key, [])
    by_slot.get(key).push(opt_in.tid)
  }

  const finalized_slots = new Set()
  for (const block of blocks) {
    finalized_slots.add(to_unix(block.block_at))
  }

  return {
    eligible_team_ids,
    // Every finalized SESSION, which is a merged run of consecutive unanimous
    // slots rather than one row per 15 minutes.
    blocks: blocks.map((block) => ({
      block_at: to_unix(block.block_at),
      end_at: to_unix(block.end_at),
      finalized_at: to_unix(block.finalized_at),
      eligible_team_count: block.eligible_team_count
    })),
    opt_ins: [...by_slot.entries()].map(([block_at, opt_in_tids]) => ({
      block_at,
      opt_in_tids,
      is_finalized: finalized_slots.has(block_at)
    })),
    // The period bounds and the notice threshold ride along rather than being
    // read from the SPA's league record, which carries neither. The calendar is
    // their only consumer, the route already has them, and a second copy on the
    // league record is a second thing to keep in step.
    period_start: to_unix(league.free_agency_period_start),
    auction_block_notice_minutes: league.auction_block_notice_minutes,
    final_block_at: final_block ? to_unix(final_block.final_block_at) : null,
    final_block_spots_remaining: final_block
      ? final_block.spots_remaining
      : null,
    period_end: final_block ? to_unix(final_block.period_end) : null
  }
}

/**
 * @swagger
 * /leagues/{leagueId}/auction-blocks:
 *   get:
 *     tags:
 *       - Leagues
 *     summary: Get the live auction block schedule
 *     description: |
 *       Every 15-minute slot in the free agency period is a candidate, so
 *       candidacy is not returned -- only the slots somebody has opted into, the
 *       sessions that have convened, and the computed final block.
 *     parameters:
 *       - $ref: '#/components/parameters/leagueId'
 *     responses:
 *       200:
 *         description: The block schedule
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 eligible_team_ids:
 *                   type: array
 *                   items:
 *                     type: integer
 *                 blocks:
 *                   type: array
 *                   items:
 *                     type: object
 *                 opt_ins:
 *                   type: array
 *                   items:
 *                     type: object
 *                 period_start:
 *                   type: integer
 *                   nullable: true
 *                 auction_block_notice_minutes:
 *                   type: integer
 *                 final_block_at:
 *                   type: integer
 *                   nullable: true
 *                 final_block_spots_remaining:
 *                   type: integer
 *                   nullable: true
 *                 period_end:
 *                   type: integer
 *                   nullable: true
 */
router.get('/?', async (req, res) => {
  const { logger } = req.app.locals
  try {
    const schedule = await build_schedule({
      lid: Number(req.params.leagueId),
      season_year: current_season.year
    })
    res.send(schedule)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

/**
 * @swagger
 * /leagues/{leagueId}/auction-blocks:
 *   post:
 *     tags:
 *       - Leagues
 *     summary: Opt into or out of a live auction block
 *     description: |
 *       `is_opted_in` false WITHDRAWS. A withdrawal after the block has
 *       finalized does NOT cancel it: the opt-in row moves, the finalized block
 *       does not, and the block runs.
 *
 *       If this opt-in completes unanimity outside the notice threshold, the
 *       block finalizes in the same request and the whole schedule comes back
 *       with it.
 *     parameters:
 *       - $ref: '#/components/parameters/leagueId'
 *     responses:
 *       200:
 *         description: Opt-in recorded, with the resulting schedule
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 block_at:
 *                   type: integer
 *                 is_opted_in:
 *                   type: boolean
 *                 eligible_team_ids:
 *                   type: array
 *                   items:
 *                     type: integer
 *                 blocks:
 *                   type: array
 *                   items:
 *                     type: object
 *                 opt_ins:
 *                   type: array
 *                   items:
 *                     type: object
 *                 period_start:
 *                   type: integer
 *                   nullable: true
 *                 auction_block_notice_minutes:
 *                   type: integer
 *                 final_block_at:
 *                   type: integer
 *                   nullable: true
 *                 final_block_spots_remaining:
 *                   type: integer
 *                   nullable: true
 *                 period_end:
 *                   type: integer
 *                   nullable: true
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 */
router.post('/?', async (req, res) => {
  const { logger, broadcast } = req.app.locals
  try {
    const { leagueId } = req.params
    const teamId = Number(req.body.teamId)
    const block_at = Number(req.body.block_at)
    const is_opted_in = req.body.is_opted_in !== false

    if (!teamId) {
      return res.status(400).send({ error: 'missing teamId param' })
    }

    if (!block_at) {
      return res.status(400).send({ error: 'missing block_at param' })
    }

    try {
      await verifyUserTeam({
        userId: req.auth.userId,
        leagueId,
        teamId,
        requireLeague: true
      })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    let result
    try {
      result = await set_auction_block_opt_in({
        lid: Number(leagueId),
        tid: teamId,
        user_id: req.auth.userId,
        block_at: dayjs.unix(block_at),
        is_opted_in,
        season_year: current_season.year
      })
    } catch (error) {
      if (error.is_auction_block_error) {
        return res.status(400).send({ error: error.message })
      }
      throw error
    }

    const schedule = await build_schedule({
      lid: Number(leagueId),
      season_year: current_season.year
    })

    res.send({
      block_at: result.block_at.unix(),
      is_opted_in,
      ...schedule
    })

    // Opt-ins are public and a convening block is the loudest fact the schedule
    // carries, so every client in the league gets the whole schedule rather than
    // a delta -- the same reason the settlement status is broadcast whole.
    broadcast(Number(leagueId), {
      type: 'AUCTION_BLOCK_SCHEDULE',
      payload: schedule
    })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
