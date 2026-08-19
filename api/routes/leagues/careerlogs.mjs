// @ts-check
import express from 'express'

/**
 * `mergeParams: true` is what puts `leagueId` on this router's params -- it is
 * declared by the PARENT mount, so a bare Request type does not know about it.
 *
 * @typedef {import('express').Request<{ leagueId: string }>} LeagueRequest
 */

const router = express.Router({
  mergeParams: true
})

router.get('/?', async (/** @type {LeagueRequest} */ req, res) => {
  const { leagueId } = req.params
  const { db, logger } = req.app.locals
  try {
    const [team_careerlogs, user_careerlogs, latest_teams] = await Promise.all([
      // Team careerlogs
      db('league_team_careerlogs').where({ lid: leagueId }),

      // User careerlogs with usernames
      db('league_user_careerlogs')
        .join('users', 'league_user_careerlogs.user_id', 'users.id')
        .where({ 'league_user_careerlogs.lid': leagueId })
        .select('league_user_careerlogs.*', 'users.username'),

      // Latest team row for each team
      db('teams')
        .where({ lid: leagueId })
        .distinctOn('team_id')
        .orderBy(['team_id', { column: 'season_year', order: 'desc' }])
    ])

    // Separate user_careerlogs and usernames
    const usernames = user_careerlogs.map(
      (
        /** @type {{ user_id: number, username: string }} */ {
          user_id,
          username
        }
      ) => ({
        id: user_id,
        username
      })
    )

    res.json({
      team_careerlogs,
      user_careerlogs,
      latest_teams,
      usernames
    })
  } catch (error) {
    logger(error)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
