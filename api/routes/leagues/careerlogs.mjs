import express from 'express'

const router = express.Router({
  mergeParams: true
})

router.get('/?', async (req, res) => {
  const { leagueId } = req.params
  const { db, logger } = req.app.locals
  try {
    const [team_careerlogs, user_careerlogs, latest_teams] = await Promise.all([
      // Team careerlogs
      db('league_team_careerlogs').where({ lid: leagueId }),

      // User careerlogs with usernames
      db('league_user_careerlogs')
        .join('users', 'league_user_careerlogs.userid', 'users.id')
        .where({ 'league_user_careerlogs.lid': leagueId })
        .select('league_user_careerlogs.*', 'users.username'),

      // Latest team row for each team
      db('teams')
        .where({ lid: leagueId })
        .distinctOn('uid')
        .orderBy(['uid', { column: 'year', order: 'desc' }])
    ])

    // Separate user_careerlogs and usernames
    const usernames = user_careerlogs.map(({ userid, username }) => ({
      id: userid,
      username
    }))

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
