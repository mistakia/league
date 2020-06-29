const express = require('express')
const router = express.Router()

router.put('/:teamId', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { teamId } = req.params
    const { value, field } = req.body

    const fields = ['name', 'image', 'abbrv']

    if (!field) {
      return res.status(400).send({ error: 'missing field' })
    }

    if (!value) {
      return res.status(400).send({ error: 'missing value' })
    }

    if (fields.indexOf(field) < 0) {
      return res.status(400).send({ error: 'invalid field' })
    }

    if (field === 'image') {
      // TODO validate url
    }

    await db('teams').update({ [field]: value }).where({ uid: teamId })
    res.send({ value })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
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
