import express from 'express'

import {
  generate_league_context,
  generate_league_rules,
  generate_league_schedule,
  generate_team_context
} from '#libs-server'

// Server-generated markdown context documents served at the human path plus a
// `.md` suffix (not under /api). Each route imports its generator directly and
// responds text/markdown. A generator's typed guard (missing league/team, or a
// league with no configured season) carries `status: 404`, which maps here.
const router = express.Router()

const get_base_url = (req) => `${req.protocol}://${req.get('host')}`

const send_doc = async (req, res, generate, args) => {
  const { db, logger } = req.app.locals
  try {
    const markdown = await generate({
      db,
      base_url: get_base_url(req),
      ...args
    })
    res.set('Content-Type', 'text/markdown; charset=utf-8')
    res.send(markdown)
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).send(error.message)
    }
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
}

router.get('/leagues/:lid(\\d+).md', (req, res) =>
  send_doc(req, res, generate_league_context, {
    lid: Number(req.params.lid)
  })
)

router.get('/leagues/:lid(\\d+)/rules.md', (req, res) =>
  send_doc(req, res, generate_league_rules, {
    lid: Number(req.params.lid)
  })
)

router.get('/leagues/:lid(\\d+)/schedule.md', (req, res) =>
  send_doc(req, res, generate_league_schedule, {
    lid: Number(req.params.lid)
  })
)

router.get('/leagues/:lid(\\d+)/teams/:tid(\\d+).md', (req, res) =>
  send_doc(req, res, generate_team_context, {
    lid: Number(req.params.lid),
    tid: Number(req.params.tid)
  })
)

export default router
