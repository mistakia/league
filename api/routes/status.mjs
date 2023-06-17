import express from 'express'
import dayjs from 'dayjs'

import { constants } from '#libs-shared'
import { getJobs } from '#libs-server'

const router = express.Router()

router.get('/?', async (req, res) => {
  const { logger } = req.app.locals
  try {
    const jobs = await getJobs()
    return res.send(jobs)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.get('/overall', async (req, res) => {
  const { logger } = req.app.locals
  try {
    const jobs = await getJobs()
    const failed = jobs.find((j) => !j.succ)
    if (!failed) {
      return res.send({ status: 'operational' })
    }

    const timestamp = dayjs.unix(failed.timestamp).format('YYYY/MM/DD HH:mm')
    const message = `${constants.jobDetails[failed.type]}: ${
      failed.reason
    } (${timestamp})`
    return res.status(500).send({ message })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
