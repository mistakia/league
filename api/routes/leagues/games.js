const express = require('express')
const router = express.Router()

router.get('/?', async (req, res) => {
  // TODO return list of league games
})

router.get('/:gameId', async (req, res) => {
  // TODO return game information
})

module.exports = router
