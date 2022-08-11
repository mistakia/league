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

    const league = await getLeague(leagueId)
    if (!league) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }
    const rosterRow = await getRoster({ tid })
    const roster = new Roster({ roster: rosterRow, league })

    // make sure player is on roster
    if (!roster.has(pid)) {
      return res.status(400).send({ error: 'invalid pid' })
    }

    // make sure player is not on practice squad
    if (roster.practice.find((p) => p.pid === pid)) {
      return res
        .status(400)
        .send({ error: 'player is already on practice squad' })
    }

    const player_rows = await db('player').where('pid', pid).limit(1)
    const player_row = player_rows[0]

    const transactionsSinceAcquisition = await getTransactionsSinceAcquisition({
      lid: leagueId,
      tid,
      pid
    })
    const sortedTransactions = transactionsSinceAcquisition.sort(
      (a, b) => a.timestamp - b.timestamp
    )
    const lastTransaction = sortedTransactions[sortedTransactions.length - 1]
    const firstTransaction = sortedTransactions[0]
    const isActive = Boolean(roster.active.find((p) => p.pid === pid))

    // make sure player has not been on the active roster for more than 48 hours
    const cutoff = dayjs.unix(lastTransaction.timestamp).add('48', 'hours')
    if (isActive && dayjs().isAfter(cutoff)) {
      return res
        .status(400)
        .send({ error: 'player has exceeded 48 hours on active roster' })
    }

    const transactionsSinceFA = await getTransactionsSinceFreeAgent({
      lid: leagueId,
      pid
    })

    // make sure player has not been poached since the last time they were a free agent
    if (
      transactionsSinceFA.find((t) => t.type === constants.transactions.POACHED)
    ) {
      return res
        .status(400)
        .send({ error: 'player can not be deactivated once poached' })
    }

    // make sure player he has not been previously activated since they were a free agent
    if (
      transactionsSinceFA.find(
        (t) => t.type === constants.transactions.ROSTER_ACTIVATE
      )
    ) {
      return res.status(400).send({
        error: 'player can not be deactivated once previously activated'
      })
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
            pid,
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

    const isDraftedRookie = transactionsSinceAcquisition.find(
      (t) => t.type === constants.transactions.DRAFT
    )
    const slot = isDraftedRookie ? constants.slots.PSR : constants.slots.PS

    await db('rosters_players').update({ slot }).where({
      rid: rosterRow.uid,
      pid
    })

    await db('league_cutlist').where({ pid, tid }).del()

    const transaction = {
      userid: req.auth.userId,
      tid,
      lid: leagueId,
      pid,
      type: constants.transactions.ROSTER_DEACTIVATE,
      value: lastTransaction.value,
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

    const teams = await db('teams').where({ uid: tid })
    const team = teams[0]

    const message = `${team.name} (${team.abbrv}) has placed ${player_row.fname} ${player_row.lname} (${player_row.pos}) on the practice squad.`

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
