import express from 'express'
import dayjs from 'dayjs'

import { constants, Roster } from '#libs-shared'
import {
  getRoster,
  getLeague,
  sendNotifications,
  verifyUserTeam,
  getTransactionsSinceAcquisition,
  getTransactionsSinceFreeAgent,
  processRelease
} from '#libs-server'

const router = express.Router({ mergeParams: true })

/**
 * @swagger
 * /teams/{teamId}/deactivate:
 *   post:
 *     tags:
 *       - Fantasy Teams
 *     summary: Deactivate a player to practice squad
 *     description: |
 *       Move a player from active roster to practice squad. Player must be eligible
 *       (not poached, not previously activated, within 48 hours on active roster).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/teamId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               deactivate_pid:
 *                 type: string
 *                 description: Player ID to deactivate
 *                 example: "JALE-HURT-2020-1998-08-07"
 *               leagueId:
 *                 type: integer
 *                 description: League ID
 *                 example: 2
 *               release_pid:
 *                 type: string
 *                 description: Player ID to release from practice squad (optional)
 *                 example: "JORD-LOVE-2020-1998-11-02"
 *             required:
 *               - deactivate_pid
 *               - leagueId
 *           examples:
 *             deactivatePlayer:
 *               summary: Simple deactivation
 *               value:
 *                 deactivate_pid: "JALE-HURT-2020-1998-08-07"
 *                 leagueId: 2
 *             deactivateWithRelease:
 *               summary: Deactivate and release practice squad player
 *               value:
 *                 deactivate_pid: "JALE-HURT-2020-1998-08-07"
 *                 leagueId: 2
 *                 release_pid: "JORD-LOVE-2020-1998-11-02"
 *     responses:
 *       200:
 *         description: Player deactivated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 pid:
 *                   type: string
 *                   description: Player ID
 *                   example: "JALE-HURT-2020-1998-08-07"
 *                 tid:
 *                   type: integer
 *                   description: Team ID
 *                   example: 13
 *                 slot:
 *                   type: integer
 *                   description: New slot (practice squad)
 *                   example: 5
 *                 rid:
 *                   type: integer
 *                   description: Roster ID
 *                   example: 1234
 *                 pos:
 *                   type: string
 *                   description: Player position
 *                   example: "QB"
 *                 transaction:
 *                   type: object
 *                   description: Transaction details
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/?', async (req, res) => {
  const { db, logger, broadcast } = req.app.locals
  try {
    const { teamId } = req.params
    const { deactivate_pid, leagueId, release_pid } = req.body

    if (!req.auth) {
      return res.status(401).send({ error: 'invalid token' })
    }

    if (!deactivate_pid) {
      return res.status(400).send({ error: 'missing deactivate_pid' })
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

    // make sure player is on roster
    if (!roster.has(deactivate_pid)) {
      return res.status(400).send({ error: 'invalid deactivate_pid' })
    }

    // make sure player is not on practice squad
    if (roster.practice.find((p) => p.pid === deactivate_pid)) {
      return res
        .status(400)
        .send({ error: 'player is already on practice squad' })
    }

    const player_rows = await db('player').where('pid', deactivate_pid).limit(1)
    const player_row = player_rows[0]

    const transactionsSinceAcquisition = await getTransactionsSinceAcquisition({
      lid: leagueId,
      tid,
      pid: deactivate_pid
    })
    const sortedTransactions = transactionsSinceAcquisition.sort(
      (a, b) => a.timestamp - b.timestamp
    )
    const lastTransaction = sortedTransactions[sortedTransactions.length - 1]
    const firstTransaction = sortedTransactions[0]
    const isActive = Boolean(
      roster.active.find((p) => p.pid === deactivate_pid)
    )

    // make sure player has not been on the active roster for more than 48 hours
    const cutoff = dayjs.unix(lastTransaction.timestamp).add('48', 'hours')
    if (isActive && dayjs().isAfter(cutoff)) {
      return res
        .status(400)
        .send({ error: 'player has exceeded 48 hours on active roster' })
    }

    const transactionsSinceFA = await getTransactionsSinceFreeAgent({
      lid: leagueId,
      pid: deactivate_pid
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

    // players acquired through market bidding are ineligible
    const acceptable_types = [
      constants.transactions.ROSTER_ADD,
      constants.transactions.PRACTICE_ADD,
      constants.transactions.TRADE,
      constants.transactions.DRAFT
    ]
    if (!acceptable_types.includes(firstTransaction.type)) {
      return res.status(400).send({ error: 'player is not eligible' })
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
            pid: deactivate_pid,
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

    if (release_pid) {
      // confirm player is on practice squad
      if (!roster.has(release_pid)) {
        return res.status(400).send({ error: 'invalid release_pid' })
      }

      // remove from roster
      roster.removePlayer(release_pid)
    }

    const isDraftedRookie = transactionsSinceAcquisition.find(
      (t) => t.type === constants.transactions.DRAFT
    )

    // make sure team has space on practice squad
    if (!isDraftedRookie && !roster.hasOpenPracticeSquadSlot()) {
      return res
        .status(400)
        .send({ error: 'no available space on practice squad' })
    }

    if (release_pid) {
      const result = await processRelease({
        release_pid,
        lid: leagueId,
        tid,
        userid: req.auth.userId
      })
      for (const data of result) {
        broadcast(leagueId, {
          type: 'ROSTER_TRANSACTION',
          payload: { data }
        })
      }
    }

    const slot = isDraftedRookie ? constants.slots.PSD : constants.slots.PS

    await db('rosters_players').update({ slot }).where({
      rid: rosterRow.uid,
      pid: deactivate_pid
    })

    await db('league_cutlist').where({ pid: deactivate_pid, tid }).del()

    const transaction = {
      userid: req.auth.userId,
      tid,
      lid: leagueId,
      pid: deactivate_pid,
      type: constants.transactions.ROSTER_DEACTIVATE,
      value: lastTransaction.value,
      week: constants.season.week,
      year: constants.season.year,
      timestamp: Math.round(Date.now() / 1000)
    }
    await db('transactions').insert(transaction)

    const data = {
      pid: deactivate_pid,
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

    let message = `${team.name} (${team.abbrv}) has placed ${player_row.fname} ${player_row.lname} (${player_row.pos}) on the practice squad.`
    if (release_pid) {
      const release_player_rows = await db('player')
        .where('pid', release_pid)
        .limit(1)
      const release_player_row = release_player_rows[0]

      message += ` ${release_player_row.fname} ${release_player_row.lname} (${release_player_row.pos}) has been released.`
    }

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
