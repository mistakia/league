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
    const { pid, leagueId } = req.body

    if (!req.auth) {
      return res.status(401).send({ error: 'invalid token' })
    }

    if (!pid) {
      return res.status(400).send({ error: 'missing pid' })
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
    const league = await getLeague({ lid: leagueId })
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
    if (!roster.has(pid)) {
      return res.status(400).send({ error: 'invalid player' })
    }

    // make sure player is on practice squad
    const roster_player = roster.practice.find((p) => p.pid === pid)
    if (!roster_player) {
      return res.status(400).send({ error: 'player is not on practice squad' })
    }

    // make sure player is not already protected
    if (
      roster_player.slot === constants.slots.PSP ||
      roster_player.slot === constants.slots.PSDP
    ) {
      return res.status(400).send({ error: 'player is already protected' })
    }

    // make sure player has no pending poaching claims
    const poaches = await db('poaches').where({ pid }).whereNull('processed')
    if (poaches.length) {
      return res
        .status(400)
        .send({ error: 'player has an existing poaching claim' })
    }

    const player_rows = await db('player').where({ pid }).limit(1)
    const player_row = player_rows[0]

    const transactions = await getTransactionsSinceAcquisition({
      lid: leagueId,
      tid,
      pid
    })
    const lastTransaction = transactions.reduce((a, b) =>
      a.timestamp > b.timestamp ? a : b
    )

    const slot =
      roster_player.slot === constants.slots.PS
        ? constants.slots.PSP
        : constants.slots.PSDP
    await db('rosters_players').update({ slot }).where({
      rid: rosterRow.uid,
      pid
    })

    const transaction = {
      userid: req.auth.userId,
      tid,
      lid: leagueId,
      pid,
      type: constants.transactions.PRACTICE_PROTECTED,
      value: lastTransaction.value,
      week: constants.season.week,
      year: constants.season.year,
      timestamp: Math.round(Date.now() / 1000)
    }
    await db('transactions').insert(transaction)

    const data = {
      pid,
      tid,
      slot,
      rid: roster.uid,
      pos: player_row.pos,
      transaction
    }
    res.send(data)
    broadcast(leagueId, {
      type: 'ROSTER_TRANSACTION',
      payload: { data }
    })

    const teams = await db('teams').where({
      uid: tid,
      year: constants.season.year
    })
    const team = teams[0]

    const message = `${team.name} (${team.abbrv}) has designated ${player_row.fname} ${player_row.lname} (${player_row.pos}) as a protected practice squad member.`

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
