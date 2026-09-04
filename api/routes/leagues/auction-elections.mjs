import express from 'express'

import { current_season } from '#constants'
import { verifyUserTeam } from '#libs-server'
import {
  submit_auction_election,
  withdraw_auction_election,
  get_team_auction_elections,
  get_auction_settlement_status,
  broadcast_auction_settlement_status
} from '#libs-server/auction-elections.mjs'
import { broadcast_auction_settlement } from '#libs-server/auction-settlement.mjs'

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
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   election_id:
 *                     type: integer
 *                   pid:
 *                     type: string
 *                   tid:
 *                     type: integer
 *                   maximum_bid:
 *                     type: integer
 *                     nullable: true
 *                     description: null is a decline
 *                   effective_maximum:
 *                     type: integer
 *                     nullable: true
 *                   is_capped:
 *                     type: boolean
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
      const team = await verifyUserTeam({
        userId: req.auth.userId,
        leagueId,
        teamId,
        requireLeague: true
      })

      // OWNERSHIP, NOT AUTHORIZATION, decides who reads a team's ceilings.
      //
      // `verifyUserTeam` also passes a league's COMMISSIONER for every team in
      // it, which is right for the roster, lineup and trade routes it was
      // written for -- acting on a team's behalf is an ordinary administrative
      // act there. It is wrong here. A standing maximum is a sealed bid and the
      // commissioner is a competing manager, so this route is deliberately
      // narrower than the helper it calls: without this line the commissioner
      // could read every ceiling in the league one `teamId` at a time, from the
      // one surface the design says must never widen.
      if (team.user_id !== req.auth.userId) {
        return res.status(400).send({ error: 'invalid teamId' })
      }
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 nomination:
 *                   type: object
 *                   nullable: true
 *                   description: null when no player is open
 *                   properties:
 *                     pid:
 *                       type: string
 *                     current_price:
 *                       type: integer
 *                     opening_bid:
 *                       type: integer
 *                     nominating_team_id:
 *                       type: integer
 *                 outstanding_election_tids:
 *                   type: array
 *                   description: >-
 *                     Team ids only. Who the auction is waiting on is public;
 *                     what they intend never is.
 *                   items:
 *                     type: integer
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 pid:
 *                   type: string
 *                 tid:
 *                   type: integer
 *                 maximum_bid:
 *                   type: integer
 *                   nullable: true
 *                   description: null is a decline
 *                 settlement:
 *                   type: object
 *                   nullable: true
 *                   description: >-
 *                     Present only when this election completed the eligible set
 *                     and the player settled in the same request.
 *                   properties:
 *                     pid:
 *                       type: string
 *                     winner_tid:
 *                       type: integer
 *                     price:
 *                       type: integer
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
      const team = await verifyUserTeam({
        userId: req.auth.userId,
        leagueId,
        teamId,
        requireLeague: true
      })

      // OWNERSHIP, NOT AUTHORIZATION -- the same narrowing the GET above
      // carries, for the same reason and on the write side, where it matters
      // more. `verifyUserTeam` accepts the COMMISSIONER for every team in the
      // league, and in this league the commissioner is a competing manager. An
      // election is a private instruction that BINDS the team it names: writing
      // one for another team discharges it from the outstanding set on a
      // ceiling it never chose and binds it through `build_auction_claims` to
      // pay up to that number.
      //
      // The socket refuses the same thing on the nomination path. This is the
      // route that carries most elections, so closing one without the other
      // fixed the instance and left the class open.
      if (team.user_id !== req.auth.userId) {
        return res.status(400).send({ error: 'invalid teamId' })
      }
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

    // An election can COMPLETE the eligible set and settle the player in the
    // same request. Nothing on the socket path knows that happened, so without
    // this every connected client sits on a board showing a player that has
    // already sold and on the previous team's nomination turn.
    //
    // The AMOUNT never appears in either branch. Every client in the league
    // receives these, and a maximum is a sealed bid.
    if (result.settlement) {
      await broadcast_auction_settlement({
        broadcast,
        lid: leagueId,
        settlement: result.settlement,
        logger
      })
    } else {
      // The set `submit_auction_election` already computed under the lock,
      // rather than a second sweep of every roster in the league.
      await broadcast_auction_settlement_status({
        broadcast,
        lid: leagueId,
        outstanding: result.outstanding
      })
    }
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 pid:
 *                   type: string
 *                 tid:
 *                   type: integer
 *                 settlement:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     pid:
 *                       type: string
 *                     winner_tid:
 *                       type: integer
 *                     price:
 *                       type: integer
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
      const team = await verifyUserTeam({
        userId: req.auth.userId,
        leagueId,
        teamId,
        requireLeague: true
      })

      // OWNERSHIP, NOT AUTHORIZATION. Withdrawing is the sharper half of the
      // same hole: this verb SETTLES the player in the same transaction, so a
      // commissioner withdrawing another team's ceiling can take that team's
      // proxy out of the running and win the player below it. Withdrawing a
      // DECLINE runs the other way -- it puts the team back in the outstanding
      // set and stalls the player, with no clock to recover.
      if (team.user_id !== req.auth.userId) {
        return res.status(400).send({ error: 'invalid teamId' })
      }
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

    // Withdrawing a DECLINE puts the team back into the outstanding set, so the
    // recomputed status is the only honest thing to send -- the list can grow
    // here as well as shrink.
    if (result.settlement) {
      await broadcast_auction_settlement({
        broadcast,
        lid: leagueId,
        settlement: result.settlement,
        logger
      })
    } else {
      await broadcast_auction_settlement_status({
        broadcast,
        lid: leagueId,
        outstanding: result.outstanding
      })
    }
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
