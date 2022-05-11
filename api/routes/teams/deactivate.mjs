import express from 'express'
import dayjs from 'dayjs'

import { constants, Roster } from '#common'
import {
  getRoster,
  getLeague,
  sendNotifications,
  verifyUserTeam,
  getTransactionsSinceAcquisition,
  getTransactionsSinceFreeAgent
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
        userId: req.user.userId,
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

    // make sure player is on roster
    if (!roster.has(player)) {
      return res.status(400).send({ error: 'invalid player' })
    }

    // make sure player is not on practice squad
    if (roster.practice.find((p) => p.player === player)) {
      return res
        .status(400)
        .send({ error: 'player is already on practice squad' })
    }

    const players = await db('player').where('player', player).limit(1)
    const playerRow = players[0]

    const transactions = await getTransactionsSinceAcquisition({
      lid: leagueId,
      tid,
      player
    })
    const sortedTransactions = transactions.sort(
      (a, b) => a.timestamp - b.timestamp
    )
    const lastTransaction = sortedTransactions[sortedTransactions.length - 1]
    const firstTransaction = sortedTransactions[0]
    const isActive = Boolean(roster.active.find((p) => p.player === player))

    // make sure player has not been on the active roster for more than 48 hours
    const cutoff = dayjs.unix(lastTransaction.timestamp).add('48', 'hours')
    if (isActive && dayjs().isAfter(cutoff)) {
      return res
        .status(400)
        .send({ error: 'player has exceeded 48 hours on active roster' })
    }

    // make sure player he has not been previously activated
    if (
      transactions.find(
        (t) => t.type === constants.transactions.ROSTER_ACTIVATE
      )
    ) {
      return res.status(400).send({
        error: 'player can not be deactivated once previously activated'
      })
    }

    // make sure player has not been poached since the last time they were a free agent
    const transactionsSinceFA = await getTransactionsSinceFreeAgent({
      lid: leagueId,
      player
    })
    if (
      transactionsSinceFA.find((t) => t.type === constants.transactions.POACHED)
    ) {
      return res
        .status(400)
        .send({ error: 'player can not be deactivated once poached' })
    }

    // if signed through waivers, make sure player had no competing bids
    if (firstTransaction.waiverid) {
      const waivers = await db('waivers').where({
        uid: firstTransaction.waiverid
      })
      const transactionWaiver = waivers[0]

      // search for competing waivers
      if (transactionWaiver) {
        const competingWaivers = await db('waivers')
          .where({
            player,
            processed: transactionWaiver.processed,
            succ: 0,
            type: 1,
            lid: leagueId,
            reason: 'player is not a free agent'
          })
          .whereNot({
            tid: transactionWaiver.tid
          })
        if (competingWaivers.length) {
          return res
            .status(400)
            .send({ error: 'player is not eligible, had competing waivers' })
        }
      }
    }

    // make sure team has space on practice squad
    if (!roster.hasOpenPracticeSquadSlot()) {
      return res
        .status(400)
        .send({ error: 'no available space on practice squad' })
    }

    await db('rosters_players').update({ slot: constants.slots.PS }).where({
      rid: rosterRow.uid,
      player
    })

    await db('league_cutlist').where({ player, tid }).del()

    const transaction = {
      userid: req.user.userId,
      tid,
      lid: leagueId,
      player,
      type: constants.transactions.ROSTER_DEACTIVATE,
      value: lastTransaction.value,
      year: constants.season.year,
      timestamp: Math.round(Date.now() / 1000)
    }
    await db('transactions').insert(transaction)

    const data = {
      player,
      tid,
      slot: constants.slots.PS,
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

    const message = `${team.name} (${team.abbrv}) has placed ${playerRow.fname} ${playerRow.lname} (${playerRow.pos}) on the practice squad.`

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
