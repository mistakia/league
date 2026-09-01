import express from 'express'

import { current_season } from '#constants'
import { verifyUserTeam } from '#libs-server'
import {
  submit_auction_election,
  withdraw_auction_election,
  get_team_auction_elections,
  get_auction_settlement_status
} from '#libs-server/auction-elections.mjs'

const router = express.Router({ mergeParams: true })

/**
 * @swagger
 * /leagues/{leagueId}/auction-elections:
 *   get:
 *     tags:
 *       - Leagues
 *     summary: Get the calling team's standing auction elections
 *     description: |
 *       An election is a standing instruction on a player for the whole free
 *       agency period: a maximum bid, or a decline (`maximum_bid` null).
 *
 *       SCOPED TO ONE TEAM, STRUCTURALLY. Maximums are sealed bids, so this
 *       returns only the calling team's own rows and there is no parameter that
 *       widens it -- including for the commissioner, who in this league is a
 *       competing manager. The surface that would most naturally show every
 *       ceiling is the one that must not.
 *
 *       `effective_maximum` is `min(stated, availableCap)`: a team can win an
 *       early player and leave a later ceiling unfundable, and capping rather
 *       than invalidating keeps them in contention at a price they can afford.
 *     parameters:
 *       - $ref: '#/components/parameters/leagueId'
 *       - in: query
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: The team's live elections
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 */
router.get('/?', async (req, res) => {
  const { logger } = req.app.locals
  try {
    const { leagueId } = req.params
    const teamId = Number(req.query.teamId)

    if (!teamId) {
      return res.status(400).send({ error: 'missing teamId param' })
    }

    try {
      await verifyUserTeam({
        userId: req.auth.userId,
        leagueId,
        teamId,
        requireLeague: true
      })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    const elections = await get_team_auction_elections({
      lid: Number(leagueId),
      tid: teamId,
      season_year: current_season.year
    })

    res.send(elections)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

/**
 * @swagger
 * /leagues/{leagueId}/auction-elections/status:
 *   get:
 *     tags:
 *       - Leagues
 *     summary: Get the active nomination and who the auction is waiting on
 *     description: |
 *       Names WHO the auction is waiting on and never WHAT they intend. With no
 *       forcing function in election mode, making that visible IS the forcing
 *       function -- so this is deliberately public to the league, while the
 *       amounts behind it are not.
 *     parameters:
 *       - $ref: '#/components/parameters/leagueId'
 *     responses:
 *       200:
 *         description: The active nomination and its outstanding teams
 */
router.get('/status', async (req, res) => {
  const { logger } = req.app.locals
  try {
    const status = await get_auction_settlement_status({
      lid: Number(req.params.leagueId),
      season_year: current_season.year
    })
    res.send(status)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

/**
 * @swagger
 * /leagues/{leagueId}/auction-elections:
 *   post:
 *     tags:
 *       - Leagues
 *     summary: Record or revise an election on a player
 *     description: |
 *       One operation for both forms: a `maximum_bid` integer sets a ceiling, and
 *       a null declines. Accepted on any player at any point in the free agency
 *       period, before or after that player is nominated.
 *
 *       Aggregate maximums across many players routinely exceed a team's budget,
 *       which is expected and is NOT rejected here -- each is checked against
 *       remaining budget and roster space when its own player settles.
 *
 *       If this election completes the eligible set on the active nomination,
 *       the player settles in the same transaction and the settlement is
 *       returned.
 *     parameters:
 *       - $ref: '#/components/parameters/leagueId'
 *     responses:
 *       200:
 *         description: Election recorded
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 */
router.post('/?', async (req, res) => {
  const { logger, broadcast } = req.app.locals
  try {
    const { leagueId } = req.params
    const { pid } = req.body
    const teamId = Number(req.body.teamId)
    const has_maximum =
      req.body.maximum_bid !== null && req.body.maximum_bid !== undefined
    const maximum_bid = has_maximum ? Number(req.body.maximum_bid) : null

    if (!pid) {
      return res.status(400).send({ error: 'missing pid param' })
    }

    if (!teamId) {
      return res.status(400).send({ error: 'missing teamId param' })
    }

    try {
      await verifyUserTeam({
        userId: req.auth.userId,
        leagueId,
        teamId,
        requireLeague: true
      })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    let result
    try {
      result = await submit_auction_election({
        lid: Number(leagueId),
        tid: teamId,
        pid,
        user_id: req.auth.userId,
        maximum_bid,
        season_year: current_season.year
      })
    } catch (error) {
      // A rejected instruction is a 400 and a fault is a 500. The factory in
      // auction-elections.mjs marks its own errors so this does not have to
      // match on message text -- the mistake the retired `reason` column made.
      if (error.is_auction_election_error) {
        return res.status(400).send({ error: error.message })
      }
      throw error
    }

    res.send({ pid, tid: teamId, maximum_bid, settlement: result.settlement })

    broadcast(Number(leagueId), {
      type: 'AUCTION_ELECTION_RECORDED',
      // The AMOUNT is deliberately absent. Every client in the league receives
      // this, so it carries only the fact that a team has acted.
      payload: { pid, tid: teamId }
    })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

/**
 * @swagger
 * /leagues/{leagueId}/auction-elections:
 *   delete:
 *     tags:
 *       - Leagues
 *     summary: Withdraw a live election
 *     description: |
 *       Withdrawing a DECLINE puts the team back in the outstanding set and
 *       settlement waits for them again -- the un-pass that did not exist
 *       anywhere in the codebase under the retired pass mechanic.
 *
 *       Withdrawing a MAXIMUM stops future engine action and nothing more. A bid
 *       already placed is binding, so a team leading at an amount it bid stays
 *       leading there and wins if nobody outbids.
 *     parameters:
 *       - $ref: '#/components/parameters/leagueId'
 *     responses:
 *       200:
 *         description: Election withdrawn
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 */
router.delete('/?', async (req, res) => {
  const { logger, broadcast } = req.app.locals
  try {
    const { leagueId } = req.params
    const { pid } = req.body
    const teamId = Number(req.body.teamId)

    if (!pid) {
      return res.status(400).send({ error: 'missing pid param' })
    }

    if (!teamId) {
      return res.status(400).send({ error: 'missing teamId param' })
    }

    try {
      await verifyUserTeam({
        userId: req.auth.userId,
        leagueId,
        teamId,
        requireLeague: true
      })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    let result
    try {
      result = await withdraw_auction_election({
        lid: Number(leagueId),
        tid: teamId,
        pid,
        season_year: current_season.year
      })
    } catch (error) {
      if (error.is_auction_election_error) {
        return res.status(400).send({ error: error.message })
      }
      throw error
    }

    res.send({ pid, tid: teamId, settlement: result.settlement })

    broadcast(Number(leagueId), {
      type: 'AUCTION_ELECTION_WITHDRAWN',
      payload: { pid, tid: teamId }
    })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
