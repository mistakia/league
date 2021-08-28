const express = require('express')
const dayjs = require('dayjs')
const router = express.Router()

const { constants } = require('../../common')
const { getJobs } = require('../../utils')

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

    const timestamp = dayjs.unix(failed.timestamp).format('YYYY/MM/DD HH:mm:SS')
    const message = `${constants.jobDetails[failed.type]}: ${
      failed.reason
    } (${timestamp})`
    return res.status(500).send({ message })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

module.exports = router
