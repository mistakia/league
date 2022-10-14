import express from 'express'

const router = express.Router()

router.get('/:percentile_key', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { percentile_key } = req.params
    const percentiles = await db('percentiles').where({ percentile_key })
    res.send(percentiles)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
