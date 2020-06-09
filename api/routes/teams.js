const express = require('express')
const router = express.Router()

router.get('/?', async (req, res) => {
  // TODO return list of teams in league
})

router.get('/:teamId/lineups/?', async (req, res) => {
  const { db } = req.app.locals
  const { teamId } = req.params
  const { week, year } = req.query

  const tid = parseInt(teamId, 10)

  const teams = await db('users_teams').where({ userid: req.user.userId })
  const teamIds = teams.map(r => r.tid)

  if (!teamIds.includes(tid)) {
    return res.status(401).send({ error: 'you do not have access to this teamId' })
  }

  let query = db('rosters').where({ tid }).orderBy('last_updated', 'desc')
  if (typeof week !== 'undefined') {
    query = query.where({ week })
  }

  if (typeof seas !== 'undefined') {
    query = query.where({ year })
  }

  const rosters = await query
  res.send({ rosters })
})

router.put('/:teamId/lineups/?', async (req, res) => {
  // TODO set team game lineup
})

router.get('/:teamId/settings', async (req, res) => {
  // TODO get team settings
})

router.put('/:teamId/settings', async (req, res) => {
  // TODO set team settings
})

module.exports = router
