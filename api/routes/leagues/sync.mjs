import express from 'express'
const router = express.Router()

router.post('/?', async (req, res) => {
  const { logger } = req.app.locals
  try {
    // const { type, username, password } = req.body
    // verify credentials and return list of leagues
    res.send({ success: null })
  } catch (err) {
    logger(err)
    res.status(500).send({ error: err.toString() })
  }
})

router.get('/?', async (req, res) => {
  // initiate league sync
})

export default router
