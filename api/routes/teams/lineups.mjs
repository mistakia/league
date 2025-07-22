import express from 'express'

import {
  getRoster,
  verifyUserTeam,
  isPlayerLocked,
  getLeague
} from '#libs-server'
import { constants, Roster } from '#libs-shared'

const router = express.Router({ mergeParams: true })

/**
 * @swagger
 * /teams/{teamId}/lineups:
 *   get:
 *     tags:
 *       - Teams
 *     summary: Get fantasy team lineup
 *     description: |
 *       Get the fantasy team's lineup for a specific week and year.
 *       Returns the roster configuration for the specified time period.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/teamId'
 *       - $ref: '#/components/parameters/week'
 *       - $ref: '#/components/parameters/year'
 *     responses:
 *       200:
 *         description: Lineup retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               description: Roster data for the specified week
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { teamId } = req.params
    const week = req.query.week || constants.season.week
    const year = req.query.year || constants.season.year

    if (!req.auth) {
      return res.status(401).send({ error: 'invalid token' })
    }

    const tid = parseInt(teamId, 10)

    const teams = await db('users_teams').where({
      userid: req.auth.userId,
      year: constants.season.year
    })
    const teamIds = teams.map((r) => r.tid)

    if (!teamIds.includes(tid)) {
      return res
        .status(401)
        .send({ error: 'you do not have access to this teamId' })
    }

    const roster = await getRoster({ tid, week, year })
    res.send(roster)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

/**
 * @swagger
 *   put:
 *     tags:
 *       - Teams
 *     summary: Update fantasy team lineup
 *     description: |
 *       Update the fantasy team's lineup by moving players to different slots.
 *       Validates player eligibility and slot availability.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/teamId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               week:
 *                 type: integer
 *                 description: Week number
 *                 example: 4
 *               year:
 *                 type: integer
 *                 description: Year
 *                 example: 2024
 *               leagueId:
 *                 type: integer
 *                 description: League ID
 *                 example: 2
 *               players:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     pid:
 *                       type: string
 *                       description: Player ID
 *                       example: "JALE-HURT-2020-1998-08-07"
 *                     slot:
 *                       type: integer
 *                       description: Target slot
 *                       example: 0
 *                   required:
 *                     - pid
 *                     - slot
 *                 description: Array of player moves
 *             required:
 *               - leagueId
 *               - players
 *           examples:
 *             updateLineup:
 *               summary: Update lineup for current week
 *               value:
 *                 leagueId: 2
 *                 players:
 *                   - pid: "JALE-HURT-2020-1998-08-07"
 *                     slot: 0
 *                   - pid: "JORD-LOVE-2020-1998-11-02"
 *                     slot: 4
 *     responses:
 *       200:
 *         description: Lineup updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   slot:
 *                     type: integer
 *                     description: Player slot
 *                     example: 0
 *                   pid:
 *                     type: string
 *                     description: Player ID
 *                     example: "JALE-HURT-2020-1998-08-07"
 *                   week:
 *                     type: integer
 *                     description: Week number
 *                     example: 4
 *                   year:
 *                     type: integer
 *                     description: Year
 *                     example: 2024
 *                   tid:
 *                     type: integer
 *                     description: Team ID
 *                     example: 13
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { teamId } = req.params
    const week = req.body.week || constants.season.week
    const year = req.body.year || constants.season.year
    const { players, leagueId } = req.body

    if (!req.auth) {
      return res.status(401).send({ error: 'invalid token' })
    }

    // verify teamId
    try {
      await verifyUserTeam({ userId: req.auth.userId, teamId })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId' })
    }

    if (week < constants.season.week || year < constants.season.year) {
      return res.status(400).send({ error: 'lineup locked' })
    }

    if (week > constants.season.finalWeek) {
      return res.status(400).send({ error: 'lineup locked' })
    }

    if (!players || !Array.isArray(players)) {
      return res.status(400).send({ error: 'missing players' })
    }

    for (const item of players) {
      if (typeof item.slot === 'undefined' || item.slot === null) {
        return res.status(400).send({ error: 'missing slot' })
      }

      if (!item.pid) {
        return res.status(400).send({ error: 'missing pid' })
      }
    }

    const pids = players.map((p) => p.pid)
    const player_rows = await db('player').whereIn('pid', pids)

    if (player_rows.length !== pids.length) {
      return res.status(400).send({ error: 'invalid player' })
    }

    const league = await getLeague({ lid: leagueId })
    if (!league) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }
    const tid = parseInt(teamId, 10)

    const rosterRow = await getRoster({ tid, week, year })
    const roster = new Roster({ roster: rosterRow, league })

    for (const item of players) {
      // verify player is on roster
      const isActive = Boolean(roster.active.find((p) => p.pid === item.pid))
      if (!isActive) {
        return res.status(400).send({ error: 'invalid player' })
      }

      roster.removePlayer(item.pid)
    }

    for (const item of players) {
      const player_row = player_rows.find((p) => p.pid === item.pid)
      // verify player is eligible for slot
      if (item.slot !== constants.slots.BENCH) {
        const isEligible = roster.isEligibleForSlot({
          slot: item.slot,
          pos: player_row.pos
        })
        if (!isEligible) {
          return res.status(400).send({ error: 'invalid slot' })
        }

        // if during first six weeks, verify player was not Reserve at start of free agency period
        if (week <= 6 && league.free_agency_period_start) {
          const transaction_before_auction = await db('transactions')
            .where({
              tid,
              year,
              week: 0,
              pid: item.pid
            })
            .where('timestamp', '<=', league.free_agency_period_start)
            .whereIn('type', [
              constants.transactions.RESERVE_IR,
              constants.transactions.ROSTER_ACTIVATE
            ])
            .orderBy('timestamp', 'desc')
            .first()

          const was_reserved =
            transaction_before_auction &&
            transaction_before_auction.type ===
              constants.transactions.RESERVE_IR

          if (was_reserved) {
            return res.status(400).send({
              error: 'player ineligible to start during first six weeks'
            })
          }
        }
      }

      // verify player is not locked
      const isLocked = await isPlayerLocked(item.pid)
      if (isLocked) {
        return res
          .status(400)
          .send({ error: 'player is locked, game has started' })
      }

      roster.addPlayer({
        slot: item.slot,
        pid: item.pid,
        pos: player_row.pos
      })
    }

    const data = []
    for (const { slot, pid } of players) {
      const updateid = await db('rosters_players')
        .update({ slot })
        .where({ week, year, tid, pid })

      data.push({
        slot,
        pid,
        week,
        year,
        tid
      })

      if (!updateid) {
        return res.status(400).send({ error: 'lineup update unsuccessful' })
      }
    }

    res.send(data)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
