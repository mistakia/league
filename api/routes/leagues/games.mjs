import express from 'express'
const router = express.Router()

router.get('/?', async (req, res) => {
  // TODO return list of league games
})

router.get('/:gameId', async (req, res) => {
  // TODO return game information
})

export default router
