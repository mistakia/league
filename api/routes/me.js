const express = require('express')
const router = express.Router()

router.get('/?', async (req, res) => {
  try {
    const { db } = req.app.locals
    const users = await db('users').where({ id: req.user.userId })
    const user = users[0]
    delete user.password

    const teams = await db('teams')
      .where({ userid: req.user.userId })
      .join('users_teams', 'users_teams.tid', 'teams.uid')

    const leagueIds = teams.map(t => t.lid)
    const leagues = await db('leagues').whereIn('uid', leagueIds)

    res.send({
      user,
      teams,
      leagues
    })
  } catch (err) {
    res.status(500).send({ error: err.toString() })
  }
})

module.exports = router
