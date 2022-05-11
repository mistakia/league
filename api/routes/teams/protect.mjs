import express from 'express'

import { constants, Roster } from '#common'
import {
  getRoster,
  getLeague,
  verifyUserTeam,
  sendNotifications,
  getTransactionsSinceAcquisition
} from '#utils'

const router = express.Router({ mergeParams: true })

router.post('/?', async (req, res) => {
  const { db, logger, broadcast } = req.app.locals
  try {
    const { teamId } = req.params
    const { player, leagueId } = req.body

    if (!player) {
      return res.status(400).send({ error: 'missing player' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId' })
    }

    // verify teamId
    try {
      await verifyUserTeam({
        userId: req.auth.userId,
        teamId,
        leagueId,
        requireLeague: true
      })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    const tid = parseInt(teamId, 10)
    const league = await getLeague(leagueId)
    if (!league) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }
    const rosterRow = await getRoster({ tid })
    const roster = new Roster({ roster: rosterRow, league })

    if (!constants.season.isRegularSeason) {
      return res
        .status(400)
        .send({ error: 'not permitted during the offseason' })
    }

    // make sure player is on roster
    if (!roster.has(player)) {
      return res.status(400).send({ error: 'invalid player' })
    }

    // make sure player is on practice squad
    if (!roster.practice.find((p) => p.player === player)) {
      return res.status(400).send({ error: 'player is not on practice squad' })
    }

    // make sure player is not already protected
    if (
      roster.practice.find(
        (p) => p.player === player && p.slot === constants.slots.PSP
      )
    ) {
      return res.status(400).send({ error: 'player is already protected' })
    }

    // make sure player has no pending poaching claims
    const poaches = await db('poaches').where({ player }).whereNull('processed')
    if (poaches.length) {
      return res
        .status(400)
        .send({ error: 'player has an existing poaching claim' })
    }

    const players = await db('player').where('player', player).limit(1)
    const playerRow = players[0]

    const transactions = await getTransactionsSinceAcquisition({
      lid: leagueId,
      tid,
      player
    })
    const lastTransaction = transactions.reduce((a, b) =>
      a.timestamp > b.timestamp ? a : b
    )

    await db('rosters_players').update({ slot: constants.slots.PSP }).where({
      rid: rosterRow.uid,
      player
    })

    const transaction = {
      userid: req.auth.userId,
      tid,
      lid: leagueId,
      player,
      type: constants.transactions.PRACTICE_PROTECTED,
      value: lastTransaction.value,
      year: constants.season.year,
      timestamp: Math.round(Date.now() / 1000)
    }
    await db('transactions').insert(transaction)

    const data = {
      player,
      tid,
      slot: constants.slots.PSP,
      rid: roster.uid,
      pos: playerRow.pos,
      transaction
    }
    res.send(data)
    broadcast(leagueId, {
      type: 'ROSTER_TRANSACTION',
      payload: { data }
    })

    const teams = await db('teams').where({ uid: tid })
    const team = teams[0]

    const message = `${team.name} (${team.abbrv}) has designated ${playerRow.fname} ${playerRow.lname} (${playerRow.pos}) as a protected practice squad member.`

    await sendNotifications({
      league,
      notifyLeague: true,
      message
    })
  } catch (error) {
    logger(error)
    return res.status(400).send({ error: error.toString() })
  }
})

export default router
