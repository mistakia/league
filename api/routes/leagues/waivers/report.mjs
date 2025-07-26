import express from 'express'

import { constants } from '#libs-shared'
import { verifyUserTeam } from '#libs-server'

const router = express.Router({ mergeParams: true })

/**
 * @swagger
 * components:
 *   schemas:
 *     WaiverClaim:
 *       type: object
 *       description: Waiver wire claim record
 *       properties:
 *         uid:
 *           type: integer
 *           description: Waiver claim ID
 *           example: 12345
 *         lid:
 *           type: integer
 *           description: League ID
 *           example: 2
 *         tid:
 *           type: integer
 *           description: Team ID that made the claim
 *           example: 13
 *         userid:
 *           type: integer
 *           description: User ID who made the claim
 *           example: 5
 *         pid:
 *           type: string
 *           description: Player ID being claimed
 *           example: "4017"
 *         drop:
 *           type: string
 *           nullable: true
 *           description: Player ID being dropped (if any)
 *           example: "2041"
 *         type:
 *           type: integer
 *           description: Waiver type (constants.waivers)
 *           example: 1
 *         succ:
 *           type: integer
 *           description: Success status (1=successful, 0=failed)
 *           example: 1
 *         reason:
 *           type: string
 *           nullable: true
 *           description: Failure reason (if unsuccessful)
 *           example: null
 *         processed:
 *           type: integer
 *           description: Unix timestamp when processed
 *           example: 1698765432
 *         submitted:
 *           type: integer
 *           description: Unix timestamp when submitted
 *           example: 1698700000
 *         wo:
 *           type: integer
 *           description: Waiver order priority
 *           example: 5
 *         bid:
 *           type: integer
 *           description: FAAB bid amount (if applicable)
 *           example: 15
 *         week:
 *           type: integer
 *           description: NFL week when claim was made
 *           example: 8
 *         year:
 *           type: integer
 *           description: Season year
 *           example: 2024
 */

/**
 * @swagger
 * /leagues/{leagueId}/waivers/report:
 *   get:
 *     summary: Get waiver wire processing report
 *     description: |
 *       Retrieves a report of processed waiver wire claims for a specific waiver period.
 *       Shows successful claims and relevant failed claims for analysis and transparency.
 *
 *       **Key Features:**
 *       - Shows processed waiver claims for specific waiver type
 *       - Filters by processing timestamp and waiver type
 *       - Optional team-specific view for failed claims
 *       - Includes both successful and relevant failed claims
 *
 *       **Fantasy Football Context:**
 *       - Provides transparency into waiver wire processing
 *       - Shows which teams got their waiver claims
 *       - Helps understand waiver priority and bid results
 *       - Used for post-waiver analysis and planning
 *
 *       **Waiver Types:**
 *       - **Regular Waivers**: Weekly waiver wire processing
 *       - **Free Agency**: Immediate free agent claims
 *       - **FAAB**: Free Agent Acquisition Budget bidding
 *
 *       **Claim Visibility:**
 *       - **Without teamId**: Shows all successful claims + failed claims due to player unavailability
 *       - **With teamId**: Shows successful claims + all failed claims for the specified team
 *       - **Authentication Required**: For team-specific failed claim details
 *
 *       **Failed Claim Reasons:**
 *       - Player no longer available (claimed by higher priority team)
 *       - Insufficient FAAB budget
 *       - Roster space constraints
 *       - Waiver order priority
 *
 *       **Use Cases:**
 *       - Post-waiver analysis and review
 *       - Understanding waiver priority impact
 *       - Planning future waiver strategy
 *       - League transparency and fairness verification
 *     tags:
 *       - Fantasy Leagues
 *     parameters:
 *       - $ref: '#/components/parameters/leagueId'
 *       - name: processed
 *         in: query
 *         required: true
 *         schema:
 *           type: integer
 *         description: |
 *           Unix timestamp when waivers were processed.
 *           Used to get claims from a specific waiver period.
 *         example: 1698765432
 *       - name: type
 *         in: query
 *         required: true
 *         schema:
 *           type: integer
 *         description: |
 *           Waiver type to filter by (constants.waivers).
 *           Different types have different processing rules.
 *         example: 1
 *       - name: teamId
 *         in: query
 *         required: false
 *         schema:
 *           type: integer
 *         description: |
 *           Team ID to get detailed failed claims for.
 *           Requires authentication and team ownership.
 *           Shows all failed claims for the team.
 *         example: 13
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Waiver report retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/WaiverClaim'
 *             examples:
 *               waiver_report:
 *                 summary: Waiver processing report
 *                 value:
 *                   - uid: 12345
 *                     lid: 2
 *                     tid: 13
 *                     userid: 5
 *                     pid: "4017"
 *                     drop: "2041"
 *                     type: 1
 *                     succ: 1
 *                     reason: null
 *                     processed: 1698765432
 *                     submitted: 1698700000
 *                     wo: 5
 *                     bid: 15
 *                     week: 8
 *                     year: 2024
 *                   - uid: 12346
 *                     lid: 2
 *                     tid: 14
 *                     userid: 7
 *                     pid: "4017"
 *                     drop: "1889"
 *                     type: 1
 *                     succ: 0
 *                     reason: "player is not a free agent"
 *                     processed: 1698765432
 *                     submitted: 1698700000
 *                     wo: 8
 *                     bid: 12
 *                     week: 8
 *                     year: 2024
 *               team_specific_report:
 *                 summary: Team-specific waiver report with failed claims
 *                 value:
 *                   - uid: 12345
 *                     lid: 2
 *                     tid: 13
 *                     userid: 5
 *                     pid: "4017"
 *                     drop: null
 *                     type: 1
 *                     succ: 1
 *                     reason: null
 *                     processed: 1698765432
 *                     submitted: 1698700000
 *                     wo: 5
 *                     bid: 15
 *                     week: 8
 *                     year: 2024
 *                   - uid: 12347
 *                     lid: 2
 *                     tid: 13
 *                     userid: 5
 *                     pid: "3892"
 *                     drop: "2041"
 *                     type: 1
 *                     succ: 0
 *                     reason: "insufficient funds"
 *                     processed: 1698765432
 *                     submitted: 1698700000
 *                     wo: 5
 *                     bid: 25
 *                     week: 8
 *                     year: 2024
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               missing_processed:
 *                 summary: Missing processed timestamp
 *                 value:
 *                   error: missing processed
 *               missing_type:
 *                 summary: Missing waiver type
 *                 value:
 *                   error: missing type
 *               invalid_type:
 *                 summary: Invalid waiver type
 *                 value:
 *                   error: invalid type
 *               team_verification_failed:
 *                 summary: User doesn't own specified team
 *                 value:
 *                   error: Team verification failed
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { leagueId } = req.params
    const { processed, teamId } = req.query
    const type = Number(req.query.type)

    if (!processed) {
      return res.status(400).send({ error: 'missing processed' })
    }

    if (!type) {
      return res.status(400).send({ error: 'missing type' })
    }

    // verify type
    const types = Object.values(constants.waivers)
    if (!types.includes(type)) {
      return res.status(400).send({ error: 'invalid type' })
    }

    const query = db('waivers').where({
      lid: leagueId,
      type,
      processed
    })

    // verify teamId and get failed bids for teamId
    if (teamId) {
      const tid = Number(teamId)

      // verify teamId, leagueId belongs to user
      try {
        await verifyUserTeam({
          userId: req.auth.userId,
          leagueId,
          teamId: tid,
          requireLeague: true
        })
      } catch (error) {
        return res.status(400).send({ error: error.message })
      }

      query.where(function () {
        this.where('succ', 1)
          .orWhere({
            succ: 0,
            tid
          })
          .orWhere({
            succ: 0,
            reason: 'player is not a free agent' // TODO use code
          })
      })
    } else {
      // show successful bids or only failed bids due to player no longer being a free agent
      query.where(function () {
        this.where('succ', 1).orWhere({
          succ: 0,
          reason: 'player is not a free agent' // TODO use code
        })
      })
    }

    const waivers = await query
    res.send(waivers)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
