import express from 'express'

import { current_season } from '#constants'

const router = express.Router()

// THE READ SIDE OF THE VETTING QUESTIONNAIRE, and the reason it is its own file.
//
// This router mounts AFTER the blanket auth guard in api/index.mjs, beside
// /api/me and /api/settings, so an anonymous caller is refused by the guard and
// never reaches a handler here. That is a structural property rather than a
// check anyone has to remember: the two live privacy holes in this repo were
// both a pre-guard route whose ownership predicate was inverted for callers
// with no token, and there is no predicate here to invert.
//
// Membership is still checked per request -- the guard proves a session exists,
// not that the session belongs to this league.

/**
 * @swagger
 * /waitlist-submissions:
 *   get:
 *     summary: Read the manager vetting questionnaire responses
 *     description: |
 *       Restricted to managers of the league. Returns every submission, newest
 *       first, for the Article IV waiting-list ranking vote.
 *     tags:
 *       - Waitlist
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: league_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: The submissions, newest first
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/WaitlistSubmission'
 *       400:
 *         description: Missing or malformed league_id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: The caller does not manage a team in this league
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const league_id = Number(req.query.league_id)
    if (!league_id) {
      return res.status(400).send({ error: 'missing league_id' })
    }

    // Ownership, scoped to the CURRENT season: a manager who left the league
    // keeps their user account and their historical users_teams rows, and
    // reading candidate PII is a right of the sitting managers who vote, not of
    // anyone who ever held a team. Same season scoping as GET /api/me.
    const teams = await db('teams')
      .join('users_teams', function () {
        this.on('users_teams.tid', '=', 'teams.team_id')
        this.andOn('users_teams.season_year', '=', 'teams.season_year')
      })
      .where({
        'teams.lid': league_id,
        'teams.season_year': current_season.year,
        'users_teams.user_id': req.auth.userId,
        'users_teams.season_year': current_season.year
      })
      .limit(1)

    if (!teams.length) {
      return res
        .status(403)
        .send({ error: 'you do not manage a team in this league' })
    }

    const submissions = await db('manager_waitlist_submissions').orderBy(
      'submitted_at',
      'desc'
    )

    res.send(submissions)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.message })
  }
})

export default router
