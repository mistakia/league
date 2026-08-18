import express from 'express'

import { current_season } from '#constants'

const router = express.Router({ mergeParams: true })

/**
 * @swagger
 * /leagues/{leagueId}/restricted-free-agency:
 *   get:
 *     tags:
 *       - Leagues
 *     summary: Get completed restricted free agency auctions
 *     description: |
 *       Returns every COMPLETED restricted free agency auction for a season,
 *       with all of its bids, the winner, and why each losing bid failed.
 *
 *       Full disclosure applies to a resolved auction: bid amounts and bidding
 *       teams are visible to everyone, which is the point of the history. Live
 *       auctions remain sealed, and structurally so -- the filter is the
 *       nomination's processing timestamp, not a permission check, so an
 *       unresolved auction cannot appear in this response for any caller.
 *
 *       Conditional releases are the exception to that disclosure. A losing
 *       bid's releases never happened -- they name the players that team was
 *       willing to cut, which is live strategy rather than history -- so they
 *       are returned empty unless the bid won or belongs to the caller's own
 *       team for that season.
 *
 *       Cancelled bids are omitted: a withdrawn bid never settled and has no
 *       outcome to report.
 *     parameters:
 *       - $ref: '#/components/parameters/leagueId'
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *         description: Season year, defaults to the current season
 *     responses:
 *       200:
 *         description: Completed auctions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   nomination_id:
 *                     type: integer
 *                   pid:
 *                     type: string
 *                   season_year:
 *                     type: integer
 *                   original_team_id:
 *                     type: integer
 *                   nominated_at:
 *                     type: string
 *                     format: date-time
 *                     nullable: true
 *                   announced_at:
 *                     type: string
 *                     format: date-time
 *                     nullable: true
 *                   processed_at:
 *                     type: string
 *                     format: date-time
 *                   winning_bid_id:
 *                     type: integer
 *                   bids:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         uid:
 *                           type: integer
 *                         tid:
 *                           type: integer
 *                         bid_amount:
 *                           type: integer
 *                         is_successful:
 *                           type: boolean
 *                         outcome:
 *                           type: string
 *                           example: outbid
 *                         outcome_detail:
 *                           type: string
 *                         releases:
 *                           type: array
 *                           items:
 *                             type: string
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { leagueId } = req.params
    const year = req.query.year ? Number(req.query.year) : current_season.year

    if (isNaN(year)) {
      return res.status(400).send({ error: 'invalid year' })
    }

    const nominations = await db('restricted_free_agency_nominations')
      .where({ league_id: leagueId, season_year: year })
      .whereNotNull('processed_at')
      .orderBy('processed_at', 'asc')

    if (!nominations.length) {
      return res.send([])
    }

    const nomination_ids = nominations.map((n) => n.nomination_id)

    const bids = await db('restricted_free_agency_bids')
      .select(
        'restricted_free_agency_bids.bid_id',
        'restricted_free_agency_bids.nomination_id',
        'restricted_free_agency_bids.pid',
        'restricted_free_agency_bids.tid',
        'restricted_free_agency_bids.bid_amount',
        'restricted_free_agency_bids.is_successful',
        'restricted_free_agency_bids.outcome',
        'restricted_free_agency_bids.outcome_detail',
        'restricted_free_agency_bids.submitted',
        'restricted_free_agency_bids.processed'
      )
      .whereIn('restricted_free_agency_bids.nomination_id', nomination_ids)
      .whereNull('restricted_free_agency_bids.cancelled')
      .orderBy('restricted_free_agency_bids.bid_amount', 'desc')

    // Resolved per season: a manager who held a different team in 2021 sees
    // that team's releases in the 2021 history, not their current team's.
    const user_team_ids = new Set()
    if (req.auth && req.auth.userId) {
      const user_teams = await db('users_teams')
        .select('users_teams.tid')
        .join('teams', function () {
          this.on('users_teams.tid', '=', 'teams.team_id')
          this.andOn('users_teams.season_year', '=', 'teams.season_year')
        })
        .where('users_teams.user_id', req.auth.userId)
        .where('users_teams.season_year', year)
        .where('teams.lid', leagueId)
      for (const user_team of user_teams) {
        user_team_ids.add(user_team.tid)
      }
    }

    const winning_bid_ids = new Set(
      nominations.map((nomination) => nomination.winning_bid_id).filter(Boolean)
    )

    const visible_release_bid_ids = bids
      .filter(
        (bid) => winning_bid_ids.has(bid.bid_id) || user_team_ids.has(bid.tid)
      )
      .map((bid) => bid.bid_id)

    const releases = await db('restricted_free_agency_releases').whereIn(
      'restricted_free_agency_bid_id',
      visible_release_bid_ids
    )

    const releases_by_bid_id = new Map()
    for (const release of releases) {
      const existing =
        releases_by_bid_id.get(release.restricted_free_agency_bid_id) || []
      existing.push(release.pid)
      releases_by_bid_id.set(release.restricted_free_agency_bid_id, existing)
    }

    const bids_by_nomination_id = new Map()
    for (const bid of bids) {
      const existing = bids_by_nomination_id.get(bid.nomination_id) || []
      existing.push({
        ...bid,
        releases: releases_by_bid_id.get(bid.bid_id) || []
      })
      bids_by_nomination_id.set(bid.nomination_id, existing)
    }

    const auctions = nominations.map((nomination) => ({
      ...nomination,
      pid: nomination.player_id,
      bids: bids_by_nomination_id.get(nomination.nomination_id) || []
    }))

    res.send(auctions)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
