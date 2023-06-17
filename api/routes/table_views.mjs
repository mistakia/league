import express from 'express'

const router = express.Router()

router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const views = await db('user_table_views')
    return res.status(200).send(views)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router