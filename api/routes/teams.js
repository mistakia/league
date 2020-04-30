const express = require('express')
const router = express.Router()

router.get('/?', async (req, res) => {
  // TODO return list of teams in league
})

router.get('/:teamId/lineups/?:gameId?', async (req, res) => {
  // TODO return team game lineup
})

router.put('/:teamId/lineups/:gameId', async (req, res) => {
  // TODO set team game lineup
})

router.get('/:teamId/settings', async (req, res) => {
  // TODO get team settings
})

router.put('/:teamId/settings', async (req, res) => {
  // TODO set team settings
})

module.exports = router
