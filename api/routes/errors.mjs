import express from 'express'

import config from '#config'
import { sendEmail } from '#libs-server'

const router = express.Router()

router.post('/?', async (req, res) => {
  const { logger } = req.app.locals
  try {
    const { leagueId, teamId, userId, error } = req.body
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress
    const userAgent = req.headers['user-agent']
    const message = { leagueId, teamId, userId, error, ip, userAgent }
    logger(message)
    await sendEmail({
      to: config.email.admin,
      subject: `client error: ${error.message}`,
      message: JSON.stringify(message, null, 2)
    })
    res.send({ success: true })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
