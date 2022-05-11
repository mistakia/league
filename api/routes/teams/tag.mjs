import express from 'express'
import dayjs from 'dayjs'

import transition from './transition.mjs'
import { constants, Roster } from '#common'
import {
  getRoster,
  getLeague,
  verifyUserTeam,
  verifyReserveStatus
} from '#utils'

const router = express.Router({ mergeParams: true })

router.post('/?', async (req, res) => {
  const { db, logger } = req.app.locals
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

    // check for reserve violations
    try {
      await verifyReserveStatus({ teamId, leagueId })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

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

    // cancel existing transition bids
    const timestamp = Math.round(Date.now() / 1000)
    await db('transition_bids')
      .update('cancelled', timestamp)
      .where({
        year: constants.season.year,
        player,
        tid
      })
      .whereNull('cancelled')
      .whereNull('processed')

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

router.delete('/?', async (req, res) => {
  const { db, logger } = req.app.locals
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

    // make sure player is on roster
    if (!roster.has(player)) {
      return res.status(400).send({ error: 'invalid player' })
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

    await db('rosters_players').update({ tag: 1 }).where({
      rid: rosterRow.uid,
      player
    })

    res.send({ success: true, player })
  } catch (error) {
    logger(error)
    return res.status(400).send({ error: error.toString() })
  }
})

router.use('/transition', transition)

export default router
