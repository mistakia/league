const express = require('express')
const dayjs = require('dayjs')
const router = express.Router({ mergeParams: true })

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

    // verify not during FA Auction Period
    const league = await getLeague(leagueId)
    if (league.adate) {
      const adate = dayjs.unix(league.adate)
      const start = adate.subtract('4', 'days')
      const end = adate.startOf('day').add('1', 'day')

      if (
        constants.season.now.isAfter(start) &&
        constants.season.now.isBefore(end)
      ) {
        return res
          .status(400)
          .send({
            error: 'Unable to release during FA period (<96 hrs before Auction)'
          })
      }
    }

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
      league,
      teamIds: [],
      voice: false,
      notifyLeague: true,
      message
    })
  } catch (error) {
    logger(error)
    return res.status(400).send({ error: error.toString() })
  }
})

module.exports = router
