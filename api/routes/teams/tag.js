const express = require('express')
const dayjs = require('dayjs')
const router = express.Router({ mergeParams: true })
const API = require('groupme').Stateless

const { constants, Roster } = require('../../../common')
const {
  getRoster,
  verifyUserTeam,
  sendNotifications,
  getTransactionsSinceAcquisition
} = require('../../../utils')

router.post('/?', async (req, res) => {
  const { db, logger, broadcast } = req.app.locals
  try {
    const { teamId } = req.params
    let { tag } = req.body
    const { player, leagueId, remove } = req.body

    if (!player) {
      return res.status(400).send({ error: 'missing player' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId' })
    }

    if (!tag) {
      return res.status(400).send({ error: 'missing tag' })
    }

    const validTags = Object.values(constants.tags)
    tag = parseInt(tag, 10)
    if (!validTags.includes(tag)) {
      return res.status(400).send({ error: 'invalid tag' })
    }

    // verify teamId
    try {
      await verifyUserTeam({
        userId: req.user.userId,
        teamId,
        leagueId,
        requireLeague: true
      })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    const tid = parseInt(teamId, 10)

    const leagues = await db('leagues').where({ uid: leagueId })
    if (!leagues.length) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }
    const league = leagues[0]
    const rosterRow = await getRoster({ tid })
    const roster = new Roster({ roster: rosterRow, league })

    // make sure player is on roster
    if (!roster.has(player)) {
      return res.status(400).send({ error: 'invalid player' })
    }

    if (remove && !roster.has(remove)) {
      return res.status(400).send({ error: 'invalid remove player' })
    }

    // make sure player is on active roster
    if (!roster.active.find((r) => r.player === player)) {
      return res.status(400).send({ error: 'player is not on active roster' })
    }

    // make sure extension has not passed
    if (
      constants.season.week === 0 &&
      league.ext_date &&
      constants.season.now.isAfter(dayjs.unix(league.ext_date))
    ) {
      return res.status(400).send({ error: 'extension deadline has passed' })
    }

    // make sure tag does not exceed limits
    if (remove) {
      roster.removeTag(remove)
    }
    const isEligible = roster.isEligibleForTag({ tag, player })
    if (!isEligible) {
      return res.status(400).send({ error: 'exceeds tag limit' })
    }

    if (remove) {
      await db('rosters_players').update({ tag: 1 }).where({
        rid: rosterRow.uid,
        player: remove
      })
    }
    await db('rosters_players').update({ tag }).where({
      rid: rosterRow.uid,
      player
    })

    res.send({ success: true })
  } catch (error) {
    logger(error)
    return res.status(400).send({ error: error.toString() })
  }
})

module.exports = router
