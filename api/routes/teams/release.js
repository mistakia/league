const express = require('express')
const router = express.Router({ mergeParams: true })
const API = require('groupme').Stateless

const { constants } = require('../../../common')
const {
  verifyUserTeam,
  sendNotifications,
  processRelease,
  getLeague
} = require('../../../utils')

router.post('/?', async (req, res) => {
  const { db, logger, broadcast } = req.app.locals
  try {
    const { player, teamId, leagueId } = req.body

    if (constants.season.week > constants.season.finalWeek) {
      return res.status(400).send({ error: 'player locked' })
    }

    if (!player) {
      return res.status(400).send({ error: 'missing player' })
    }

    // verify teamId
    let team
    try {
      team = await verifyUserTeam({
        userId: req.user.userId,
        teamId,
        leagueId,
        requireLeague: true
      })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }
    const tid = parseInt(teamId, 10)
    const lid = parseInt(leagueId, 10)

    // verify player id
    const playerRows = await db('player').where('player', player).limit(1)
    if (!playerRows.length) {
      return res.status(400).send({ error: 'invalid player' })
    }
    const playerRow = playerRows[0]

    let data
    try {
      data = await processRelease({
        player,
        tid,
        lid,
        userid: req.user.userId
      })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    res.send(data)
    broadcast(lid, {
      type: 'ROSTER_TRANSACTION',
      payload: { data }
    })

    // send notification
    const message = `${team.name} (${team.abbrv}) has released ${playerRow.fname} ${playerRow.lname} (${playerRow.pos}).`

    await sendNotifications({
      leagueId: lid,
      teamIds: [],
      voice: false,
      league: true,
      message
    })

    const league = await getLeague(lid)

    if (league.groupme_token && league.groupme_id) {
      await API.Bots.post.Q(league.groupme_token, league.groupme_id, message, {})
    }
  } catch (error) {
    logger(error)
    return res.status(400).send({ error: error.toString() })
  }
})

module.exports = router
