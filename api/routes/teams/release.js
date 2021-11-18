const express = require('express')
const router = express.Router({ mergeParams: true })

const {
  constants,
  isSlotActive,
  Roster,
  getFreeAgentPeriod
} = require('../../../common')
const {
  verifyUserTeam,
  sendNotifications,
  processRelease,
  getLeague,
  getRoster
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

    // if active roster, verify not during FA Auction Period
    const league = await getLeague(leagueId)
    if (league.adate) {
      const rosterRow = await getRoster({ tid })
      const roster = new Roster({ roster: rosterRow, league })
      if (!roster.has(player)) {
        return res.status(400).send({
          error: 'player not on roster'
        })
      }

      const rosterPlayer = roster.get(player)
      const isOnActiveRoster = isSlotActive(rosterPlayer.slot)

      const faPeriod = getFreeAgentPeriod(league.adate)
      if (
        constants.season.now.isAfter(faPeriod.start) &&
        constants.season.now.isBefore(faPeriod.end) &&
        isOnActiveRoster
      ) {
        return res.status(400).send({
          error: 'Unable to release player from active roster during FA period'
        })
      }
    }

    let result
    try {
      result = await processRelease({
        player,
        tid,
        lid,
        userid: req.user.userId
      })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    const data = result[0]
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
