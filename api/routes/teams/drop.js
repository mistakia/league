const express = require('express')
const moment = require('moment')
const router = express.Router({ mergeParams: true })
const API = require('groupme').Stateless

const { constants, Roster } = require('../../../common')
const {
  verifyUserTeam,
  isPlayerLocked,
  getRoster,
  sendNotifications
} = require('../../../utils')

router.post('/?', async (req, res) => {
  const { db, logger, broadcast } = req.app.locals
  try {
    const { player, teamId, leagueId } = req.body

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

    // verify player is on current roster
    const leagues = await db('leagues').where({ uid: lid }).limit(1)
    if (!leagues.length) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }
    const league = leagues[0]
    const rosterRow = await getRoster({
      tid,
      week: constants.season.week,
      year: constants.season.year
    })
    const roster = new Roster({ roster: rosterRow, league })
    if (!roster.has(player)) {
      return res.status(400).send({ error: 'player not on roster' })
    }

    // verify player is not locked and is a starter
    const isLocked = await isPlayerLocked(player)
    const isStarter = !!roster.starters.find(p => p.player === player)
    if (isLocked && isStarter) {
      return res.status(400).send({ error: 'starter is locked' })
    }

    // verify player does not have a poaching claim
    const isOnPracticeSquad = !!roster.practice.find(p => p.player === player)
    if (isOnPracticeSquad) {
      const poaches = await db('poaches')
        .where({ player, lid })
        .whereNull('processed')

      if (poaches.length) {
        return res.status(400).send({ error: 'player has a poaching claim' })
      }
    }

    // verify player was not poached this offseason
    if (!constants.season.isRegularSeason) {
      const poaches = await db('poaches')
        .where({ player, lid, tid, succ: 1 })
        .orderBy('processed', 'desc')

      if (poaches.length) {
        const poach = poaches[0]
        if (moment(poach.processed, 'X').isAfter(constants.season.offseason)) {
          return res.status(400).send({ error: 'player was poached' })
        }
      }
    }

    // update roster
    await db('rosters_players').where({ player, rid: roster.uid }).del()

    // create transaction
    const transaction = {
      userid: req.user.userId,
      tid,
      lid,
      player,
      type: constants.transactions.ROSTER_DROP,
      value: 0,
      year: constants.season.year,
      timestamp: Math.round(Date.now() / 1000)
    }
    await db('transactions').insert(transaction)

    res.send(transaction)
    broadcast(lid, {
      type: 'ROSTER_DROP',
      payload: { data: transaction }
    })

    // send notification
    const message = `${team.name} (${team.abbrv}) has released ${playerRow.fname} ${playerRow.lname} (${playerRow.pos1}).`

    await sendNotifications({
      leagueId: league.uid,
      teamIds: [],
      voice: false,
      league: true,
      message
    })

    if (league.groupme_token && league.groupme_id) {
      await API.Bots.post.Q(league.groupme_token, league.groupme_id, message, {})
    }
  } catch (error) {
    logger(error)
    return res.status(400).send({ error: error.toString() })
  }
})

module.exports = router
