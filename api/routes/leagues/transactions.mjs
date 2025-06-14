import express from 'express'
import dayjs from 'dayjs'

import { constants } from '#libs-shared'
import {
  getTransactionsSinceAcquisition,
  getTransactionsSinceFreeAgent
} from '#libs-server'

const router = express.Router({ mergeParams: true })

router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { leagueId } = req.params

    // TODO validate
    const { limit = 100, offset = 0, pid, since } = req.query
    const types = req.query.types
      ? Array.isArray(req.query.types)
        ? req.query.types
        : [req.query.types]
      : []
    const teams = req.query.teams
      ? Array.isArray(req.query.teams)
        ? req.query.teams
        : [req.query.teams]
      : []

    let query = db('transactions')
      .leftJoin('draft', function() {
        this.on('transactions.pid', '=', 'draft.pid')
          .andOn('transactions.lid', '=', 'draft.lid')
          .andOn('transactions.type', '=', db.raw('?', [constants.transactions.DRAFT]))
      })
      .select('transactions.*', 'draft.pick', 'draft.pick_str')
      .where({ 'transactions.lid': leagueId })
      .orderBy('transactions.timestamp', 'desc')
      .orderBy('transactions.uid', 'desc')
      .limit(limit)
      .offset(offset)

    if (types.length) {
      query = query.whereIn('transactions.type', types)
    }

    if (teams.length) {
      query = query.whereIn('transactions.tid', teams)
    }

    if (pid) {
      query = query.where('transactions.pid', pid)
    }

    if (since) {
      query = query.where('transactions.timestamp', '>', since)
    }

    const transactions = await query

    res.send(transactions)
  } catch (err) {
    logger(err)
    res.status(500).send({ error: err.toString() })
  }
})

router.get('/release', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { leagueId } = req.params
    const cutoff = dayjs().subtract('48', 'hours').unix()
    const types = [
      constants.transactions.ROSTER_ADD,
      constants.transactions.ROSTER_RELEASE,
      constants.transactions.PRACTICE_ADD
    ]
    const transactions = await db('transactions')
      .where({
        lid: leagueId
      })
      .whereIn('type', types)
      .where('timestamp', '>', cutoff)
      .orderBy('timestamp', 'desc')
      .orderBy('uid', 'desc')

    res.send(transactions)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.get('/teams/:tid/players/:pid', async (req, res) => {
  const { logger } = req.app.locals
  try {
    const { pid, leagueId, tid } = req.params
    const sinceFA = await getTransactionsSinceFreeAgent({ lid: leagueId, pid })
    const sinceAcquisition = await getTransactionsSinceAcquisition({
      lid: leagueId,
      pid,
      tid
    })
    res.send({
      sinceFA,
      sinceAcquisition
    })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
