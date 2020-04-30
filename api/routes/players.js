const express = require('express')
const router = express.Router()

router.get('/?', async (req, res) => {
  // TODO return list of league players
})

router.get('/:playerId', async (req, res) => {
  // TODO return player information
})

module.exports = router
