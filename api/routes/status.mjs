import express from 'express'
import dayjs from 'dayjs'

import { job_title_by_id } from '#libs-shared/job-constants'
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
    const failed_jobs = jobs.filter((job) => !job.succ)

    if (failed_jobs.length === 0) {
      return res.send({ status: 'operational' })
    }

    const errors = failed_jobs.map((job) => {
      const timestamp = dayjs.unix(job.timestamp).format('YYYY/MM/DD HH:mm')
      return {
        job: job_title_by_id[job.type],
        reason: job.reason,
        timestamp
      }
    })

    return res.status(500).send({ errors })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
