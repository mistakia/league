import express from 'express'
import dayjs from 'dayjs'

import { Roster } from '#libs-shared'
import {
  current_season,
  player_tag_types,
  roster_slot_types,
  bid_change_types,
  bid_change_sources
} from '#constants'
import {
  getRoster,
  getLeague,
  verifyUserTeam,
  verify_reserve_status,
  record_restricted_free_agency_bid_change
} from '#libs-server'
import { select_restricted_free_agency_bid_with_nomination } from '#libs-server/restricted-free-agency-bids-query.mjs'
import { require_auth } from '#api/routes/leagues/middleware.mjs'

const router = express.Router({ mergeParams: true })

/**
 * @swagger
 * /teams/{teamId}/tag/restricted-free-agency:
 *   get:
 *     tags:
 *       - Fantasy Teams
 *     summary: Get restricted free agency bids
 *     description: |
 *       Get all active restricted free agency bids for the team.
 *       Shows bids that have not been processed or cancelled.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/teamId'
 *     responses:
 *       200:
 *         description: Restricted free agency bids retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   uid:
 *                     type: integer
 *                     description: Bid ID
 *                     example: 123
 *                   tid:
 *                     type: integer
 *                     description: Team ID
 *                     example: 13
 *                   userid:
 *                     type: integer
 *                     description: User ID
 *                     example: 1
 *                   lid:
 *                     type: integer
 *                     description: League ID
 *                     example: 2
 *                   pid:
 *                     type: string
 *                     description: Player ID
 *                     example: "JALE-HURT-003085"
 *                   submitted:
 *                     type: integer
 *                     description: Submission timestamp
 *                     example: 1640995200
 *                   year:
 *                     type: integer
 *                     description: Year
 *                     example: 2024
 *                   bid_amount:
 *                     type: integer
 *                     description: Bid amount
 *                     example: 25
 *                   player_tid:
 *                     type: integer
 *                     description: Original team ID
 *                     example: 5
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { teamId } = req.params

    if (!require_auth(req, res)) return

    // verify teamId belongs to userId
    try {
      await verifyUserTeam({
        userId: req.auth.userId,
        teamId
      })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    // `original_team_id` and the window timestamps live on the nomination, not
    // on the bid, so they are projected through the join under the names the
    // client reads.
    const restrictedFreeAgencyBids = await db('restricted_free_agency_bids')
      .select(
        'restricted_free_agency_bids.*',
        'restricted_free_agency_nominations.original_team_id',
        'restricted_free_agency_nominations.nominated_at',
        'restricted_free_agency_nominations.announced_at'
      )
      .leftJoin(
        'restricted_free_agency_nominations',
        'restricted_free_agency_nominations.nomination_id',
        'restricted_free_agency_bids.nomination_id'
      )
      .where({
        'restricted_free_agency_bids.tid': teamId,
        'restricted_free_agency_bids.year': current_season.year
      })
      .whereNull('restricted_free_agency_bids.processed')
      .whereNull('restricted_free_agency_bids.cancelled')

    res.send(restrictedFreeAgencyBids)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

/**
 * @swagger
 *   post:
 *     tags:
 *       - Fantasy Teams
 *     summary: Create restricted free agency bid
 *     description: |
 *       Create a restricted free agency bid for a player. Can be either an original
 *       team bid or a competing bid from another team.
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
 *               pid:
 *                 type: string
 *                 description: Player ID
 *                 example: "JALE-HURT-003085"
 *               leagueId:
 *                 type: integer
 *                 description: League ID
 *                 example: 2
 *               bid:
 *                 type: integer
 *                 description: Bid amount
 *                 example: 25
 *               playerTid:
 *                 type: integer
 *                 description: Original team ID
 *                 example: 5
 *               release:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Players to release if bid succeeds
 *                 example: ["JORD-LOVE-001990"]
 *               remove:
 *                 type: string
 *                 description: Player to remove tag from (original team only)
 *                 example: "JOEX-BURR-000131"
 *             required:
 *               - pid
 *               - leagueId
 *               - bid
 *               - playerTid
 *           examples:
 *             originalTeamBid:
 *               summary: Original team sets RFA bid
 *               value:
 *                 pid: "JALE-HURT-003085"
 *                 leagueId: 2
 *                 bid: 25
 *                 playerTid: 5
 *             competingBid:
 *               summary: Competing team makes offer
 *               value:
 *                 pid: "JALE-HURT-003085"
 *                 leagueId: 2
 *                 bid: 30
 *                 playerTid: 5
 *                 release: ["JORD-LOVE-001990"]
 *     responses:
 *       200:
 *         description: Bid created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 uid:
 *                   type: integer
 *                   description: Bid ID
 *                   example: 123
 *                 tid:
 *                   type: integer
 *                   description: Team ID
 *                   example: 13
 *                 userid:
 *                   type: integer
 *                   description: User ID
 *                   example: 1
 *                 lid:
 *                   type: integer
 *                   description: League ID
 *                   example: 2
 *                 pid:
 *                   type: string
 *                   description: Player ID
 *                   example: "JALE-HURT-003085"
 *                 submitted:
 *                   type: integer
 *                   description: Submission timestamp
 *                   example: 1640995200
 *                 year:
 *                   type: integer
 *                   description: Year
 *                   example: 2024
 *                 bid_amount:
 *                   type: integer
 *                   description: Bid amount
 *                   example: 25
 *                 player_tid:
 *                   type: integer
 *                   description: Original team ID
 *                   example: 5
 *                 release:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Players to release
 *                   example: ["JORD-LOVE-001990"]
 *                 remove:
 *                   type: string
 *                   description: Player tag removed
 *                   example: "JOEX-BURR-000131"
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { teamId } = req.params
    const { pid, leagueId, remove } = req.body
    const playerTid = Number(req.body.playerTid || 0)
    let { release } = req.body
    const bid = Number(req.body.bid || 0)

    if (!Array.isArray(release)) {
      release = release ? [release] : []
    }

    if (!require_auth(req, res)) return

    if (!pid) {
      return res.status(400).send({ error: 'missing pid' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId' })
    }

    if (typeof bid === 'undefined') {
      return res.status(400).send({ error: 'missing bid' })
    }

    if (!playerTid) {
      return res.status(400).send({ error: 'missing playerTid' })
    }

    if (pid === remove) {
      return res.status(400).send({ error: 'invalid remove' })
    }

    if (release.includes(pid)) {
      return res.status(400).send({ error: 'invalid release' })
    }

    if (
      typeof bid !== 'undefined' &&
      (isNaN(bid) || bid < 0 || bid % 1 !== 0)
    ) {
      return res.status(400).send({ error: 'invalid bid' })
    }

    const tid = Number(teamId)

    // verify teamId, leagueId belongs to user
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

    // get players info
    const pids = [pid]
    if (release.length) {
      release.forEach((pid) => pids.push(pid))
    }
    const player_rows = await db('player').whereIn('pid', pids)
    if (player_rows.length !== pids.length) {
      return res.status(400).send({ error: 'invalid player' })
    }
    const player_row = player_rows[0]

    // get league info
    const league = await getLeague({ lid: leagueId })
    if (!league) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    // get roster
    const rosterRow = await getRoster({ tid })
    const roster = new Roster({ roster: rosterRow, league })

    // check for reserve violations
    try {
      await verify_reserve_status({ team_id: teamId, league_id: leagueId })
    } catch (error) {
      return res.status(400).send({ error: error.message })
    }

    // check if release players are on team
    if (release.length) {
      for (const release_pid of release) {
        if (!roster.has(release_pid)) {
          return res.status(400).send({ error: 'invalid release' })
        }
        roster.removePlayer(release_pid)
      }
    }

    if (remove && !roster.has(remove)) {
      return res.status(400).send({ error: 'invalid remove player' })
    }

    // if original bid, check if on team
    if (playerTid === tid) {
      if (!roster.has(pid)) {
        return res.status(400).send({ error: 'invalid player' })
      }

      // make sure restricted free agency period has not passed
      if (
        league.restricted_free_agency_period_end &&
        current_season.now.isAfter(
          dayjs.unix(league.restricted_free_agency_period_end)
        )
      ) {
        return res
          .status(400)
          .send({ error: 'restricted free agency deadline has passed' })
      }

      // update value to bid
      roster.updateValue(pid, bid)

      // make sure tag does not exceed limits
      if (remove) {
        roster.removeTag(remove)
      }
      const isEligible = roster.isEligibleForTag({
        tag: player_tag_types.RESTRICTED_FREE_AGENCY
      })
      if (!isEligible) {
        return res.status(400).send({ error: 'exceeds tag limit' })
      }

      // make sure bid is within $10 of market salary
      const market_salary = await db('league_format_player_projection_values')
        .select('market_salary')
        .where({
          pid,
          week: 0,
          year: current_season.year,
          league_format_id: league.league_format_id
        })
        .first()

      // TODO setup mocks for tests
      // if (!market_salary) {
      //   return res.status(400).send({ error: 'market salary not found' })
      // }

      if (market_salary) {
        const salary_difference = bid - market_salary.market_salary
        if (salary_difference < -10) {
          return res.status(400).send({
            error: 'bid must not be more than $10 below market salary'
          })
        }
      }
    } else {
      // check if restricted free agency bid exists
      const restricted_free_agency_bid = await db('restricted_free_agency_bids')
        .where({
          pid,
          tid: playerTid,
          lid: leagueId,
          year: current_season.year
        })
        .whereNull('processed')
        .whereNull('cancelled')
        .first()

      if (!restricted_free_agency_bid) {
        return res.status(400).send({ error: 'invalid player' })
      }
    }

    const cutlist = await db('league_cutlist').select('pid').where('tid', tid)

    for (const row of cutlist) {
      roster.removePlayer(row.pid)
    }

    // if competing bid, make sure there is roster space
    if (playerTid !== tid) {
      if (!roster.has_bench_space_for_position(player_row.primary_position)) {
        return res.status(400).send({ error: 'exceeds roster limits' })
      }

      // add to roster
      roster.addPlayer({
        slot: roster_slot_types.BENCH,
        pid,
        pos: player_row.primary_position,
        value: bid,
        restricted_free_agency_original_team: playerTid
      })
    }

    // make sure there is enough cap space
    // TODO
    /* if (roster.availableCap < 0) {
     *   return res.status(400).send({ error: 'exceeds salary cap' })
     * }
     */

    if (playerTid === tid) {
      await db('rosters_players')
        .update({ tag: player_tag_types.RESTRICTED_FREE_AGENCY })
        .where({
          roster_id: rosterRow.uid,
          pid
        })

      await db('league_cutlist')
        .where({
          pid,
          tid
        })
        .del()

      if (remove) {
        await db('rosters_players').update({ tag: 1 }).where({
          roster_id: rosterRow.uid,
          pid: remove
        })

        // This is the cancellation a manager reads as "my bid was reset": they
        // tagged a different player and the old tag went away as a side effect
        // of that request, not as a withdrawal they made. It is recorded with
        // the CREATE source precisely so the trail distinguishes it from a
        // deliberate cancel.
        //
        // The rows are selected before the update rather than after, because
        // the predicate matches on `cancelled` being irrelevant and the update
        // would otherwise give no way to name which bids it touched.
        const removed_bid_rows = await db('restricted_free_agency_bids')
          .select('uid')
          .where({
            pid: remove,
            tid,
            year: current_season.year
          })

        if (removed_bid_rows.length) {
          const removed_bid_ids = removed_bid_rows.map((row) => row.uid)
          await db.transaction(async (trx) => {
            await trx('restricted_free_agency_bids')
              .whereIn('uid', removed_bid_ids)
              .update({
                cancelled: Math.round(Date.now() / 1000)
              })

            for (const removed_bid_id of removed_bid_ids) {
              await record_restricted_free_agency_bid_change({
                db: trx,
                bid_id: removed_bid_id,
                change_type: bid_change_types.CANCELLED,
                change_source: bid_change_sources.API_BID_CREATE,
                changed_by_user_id: req.auth.userId
              })
            }
          })
        }
      }
    }

    // A team gets ONE live bid per player. This route inserted unconditionally
    // until 2026-08-05, so a manager who submitted twice ended up with two rows
    // both `cancelled IS NULL AND processed IS NULL` -- and every reader that
    // resolves a bid by `(pid, tid, year)` then picked between them arbitrarily.
    // Four settled `(team, player, year)` groups in league 1 carry duplicates
    // from this, going back to 2021, so it is longstanding rather than new.
    //
    // Rejecting is the honest answer rather than silently superseding: PUT is
    // the affordance for changing a bid, and a manager who lands here has
    // usually been shown a stale or blank amount (which is exactly what the
    // 2026-08-05 display defect did) and is re-entering a bid they already
    // hold. Telling them it exists is more use than quietly replacing it.
    //
    // The database enforces this too, via a partial unique index -- see
    // db/adhoc/2026-08-05-one-live-restricted-free-agency-bid-per-team-player.sql.
    // This check is the good error message, not the guarantee.
    const existing_live_bid = await db('restricted_free_agency_bids')
      .where({
        pid,
        tid,
        lid: leagueId,
        year: current_season.year
      })
      .whereNull('cancelled')
      .whereNull('processed')
      .first()

    if (existing_live_bid) {
      return res.status(400).send({
        error: 'existing restricted free agency bid, update it instead'
      })
    }

    // The auction is the nomination, so a bid attaches to one rather than
    // carrying its own copy of who holds the player's rights. Both the original
    // team's tag and a competing team's offer reach this path, and whichever
    // arrives first establishes the row.
    const nomination_rows = await db('restricted_free_agency_nominations')
      .insert({
        league_id: leagueId,
        player_id: pid,
        season_year: current_season.year,
        original_team_id: playerTid
      })
      .onConflict(['league_id', 'player_id', 'season_year'])
      .merge({ original_team_id: playerTid })
      .returning('nomination_id')
    const { nomination_id } = nomination_rows[0]

    // insert into restrictedFreeAgencyBids
    const data = {
      tid,
      userid: req.auth.userId,
      lid: leagueId,
      pid,
      submitted: Math.round(Date.now() / 1000),
      year: current_season.year,
      bid_amount: bid,
      nomination_id
    }

    // The bid, its conditional releases and its changelog entry commit
    // together. The `created` row snapshots the releases, so recording it
    // outside this boundary would let it describe an offer with no releases
    // that a moment later has them -- an audit trail that is wrong at the one
    // instant it is written.
    let restricted_free_agency_bid_id
    await db.transaction(async (trx) => {
      const query = await trx('restricted_free_agency_bids')
        .insert(data)
        .returning('uid')
      restricted_free_agency_bid_id = query[0].uid

      if (release.length) {
        const releaseInserts = release.map((pid) => ({
          restricted_free_agency_bid_id,
          pid
        }))
        await trx('restricted_free_agency_releases').insert(releaseInserts)
      }

      await record_restricted_free_agency_bid_change({
        db: trx,
        bid_id: restricted_free_agency_bid_id,
        change_type: bid_change_types.CREATED,
        change_source: bid_change_sources.API_BID_CREATE,
        changed_by_user_id: req.auth.userId
      })
    })
    data.uid = restricted_free_agency_bid_id

    data.release = release
    data.remove = remove
    // Derived from the nomination rather than stored on the bid; the client
    // needs it to tell an original-team tag from a competing offer.
    data.original_team_id = playerTid

    res.send(data)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

/**
 * @swagger
 *   delete:
 *     tags:
 *       - Fantasy Teams
 *     summary: Cancel restricted free agency bid
 *     description: |
 *       Cancel an existing restricted free agency bid.
 *       Cannot cancel if already processed or announced.
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
 *               pid:
 *                 type: string
 *                 description: Player ID
 *                 example: "JALE-HURT-003085"
 *               leagueId:
 *                 type: integer
 *                 description: League ID
 *                 example: 2
 *             required:
 *               - pid
 *               - leagueId
 *           examples:
 *             cancelBid:
 *               summary: Cancel RFA bid
 *               value:
 *                 pid: "JALE-HURT-003085"
 *                 leagueId: 2
 *     responses:
 *       200:
 *         description: Bid cancelled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 uid:
 *                   type: integer
 *                   description: Bid ID
 *                   example: 123
 *                 tid:
 *                   type: integer
 *                   description: Team ID
 *                   example: 13
 *                 lid:
 *                   type: integer
 *                   description: League ID
 *                   example: 2
 *                 cancelled:
 *                   type: integer
 *                   description: Cancellation timestamp
 *                   example: 1640995200
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { teamId } = req.params
    const { pid, leagueId } = req.body

    if (!require_auth(req, res)) return

    if (!pid) {
      return res.status(400).send({ error: 'missing pid' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId' })
    }

    const tid = Number(teamId)

    // verify teamId, leagueId belongs to user
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

    // get roster
    const rosterRow = await getRoster({ tid })

    // get league info
    const league = await getLeague({ lid: leagueId })
    if (!league) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    // make sure restricted free agency deadline has not passed
    if (
      league.restricted_free_agency_period_end &&
      current_season.now.isAfter(
        dayjs.unix(league.restricted_free_agency_period_end)
      )
    ) {
      return res
        .status(400)
        .send({ error: 'restricted free agency deadline has passed' })
    }

    // verify restricted free agency bid exists
    //
    // Ordered explicitly because the predicate is not unique: it filters
    // `cancelled` but not `processed`, so a team that settled a bid on this
    // player in a prior auction matches here alongside its live one, and the
    // four historical duplicate groups match twice on their own. Taking
    // `query1[0]` off an unordered select meant cancelling whichever row
    // Postgres happened to return first.
    //
    // Live bids sort ahead of processed ones so the cancel lands on the row the
    // manager can actually still act on, and `uid DESC` breaks the remaining tie
    // toward the most recent. The processed check below then fires only when
    // EVERY matching bid is settled, which is when that message is true.
    const query1 = await select_restricted_free_agency_bid_with_nomination({
      db
    })
      .where({
        'restricted_free_agency_bids.pid': pid,
        'restricted_free_agency_bids.tid': tid,
        'restricted_free_agency_bids.year': current_season.year
      })
      .whereNull('restricted_free_agency_bids.cancelled')
      .orderByRaw(
        '(restricted_free_agency_bids.processed IS NULL) DESC, restricted_free_agency_bids.uid DESC'
      )

    if (!query1.length) {
      return res.status(400).send({ error: 'invalid player' })
    }
    const restrictedFreeAgencyBid = query1[0]

    // check if bid has already been processed
    if (restrictedFreeAgencyBid.processed) {
      return res.status(400).send({ error: 'bid has already been processed' })
    }

    const is_current_manager_bid =
      restrictedFreeAgencyBid.original_team_id === restrictedFreeAgencyBid.tid
    if (is_current_manager_bid && restrictedFreeAgencyBid.announced_at) {
      return res
        .status(400)
        .send({ error: 'restricted free agent has already been announced' })
    }

    // cancel bid
    const cancelled = Math.round(Date.now() / 1000)
    await db.transaction(async (trx) => {
      await trx('restricted_free_agency_bids')
        .update('cancelled', cancelled)
        .where('uid', restrictedFreeAgencyBid.uid)

      await record_restricted_free_agency_bid_change({
        db: trx,
        bid_id: restrictedFreeAgencyBid.uid,
        change_type: bid_change_types.CANCELLED,
        change_source: bid_change_sources.API_BID_CANCEL,
        changed_by_user_id: req.auth.userId
      })
    })

    // TODO cancel any pending competing bids

    // update tag
    await db('rosters_players')
      .update({ tag: player_tag_types.REGULAR })
      .where({
        roster_id: rosterRow.uid,
        pid
      })

    res.send({ ...restrictedFreeAgencyBid, cancelled })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

/**
 * @swagger
 *   put:
 *     tags:
 *       - Fantasy Teams
 *     summary: Update restricted free agency bid
 *     description: |
 *       Update an existing restricted free agency bid amount and/or release players.
 *       Cannot update if already processed.
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
 *               pid:
 *                 type: string
 *                 description: Player ID
 *                 example: "JALE-HURT-003085"
 *               leagueId:
 *                 type: integer
 *                 description: League ID
 *                 example: 2
 *               bid:
 *                 type: integer
 *                 description: New bid amount
 *                 example: 30
 *               release:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Updated players to release
 *                 example: ["JORD-LOVE-001990"]
 *             required:
 *               - pid
 *               - leagueId
 *               - bid
 *           examples:
 *             updateBid:
 *               summary: Update bid amount
 *               value:
 *                 pid: "JALE-HURT-003085"
 *                 leagueId: 2
 *                 bid: 30
 *                 release: ["JORD-LOVE-001990"]
 *     responses:
 *       200:
 *         description: Bid updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 uid:
 *                   type: integer
 *                   description: Bid ID
 *                   example: 123
 *                 bid_amount:
 *                   type: integer
 *                   description: Updated bid amount
 *                   example: 30
 *                 userid:
 *                   type: integer
 *                   description: User ID
 *                   example: 1
 *                 release:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Updated release players
 *                   example: ["JORD-LOVE-001990"]
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { teamId } = req.params
    const { pid, leagueId } = req.body
    let { release } = req.body
    const bid = Number(req.body.bid || 0)

    if (!Array.isArray(release)) {
      release = release ? [release] : []
    }

    if (!require_auth(req, res)) return

    if (!pid) {
      return res.status(400).send({ error: 'missing pid' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId' })
    }

    if (typeof bid === 'undefined') {
      return res.status(400).send({ error: 'missing bid' })
    }

    if (
      typeof bid !== 'undefined' &&
      (isNaN(bid) || bid < 0 || bid % 1 !== 0)
    ) {
      return res.status(400).send({ error: 'invalid bid' })
    }

    const tid = Number(teamId)

    // verify teamId, leagueId belongs to user
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

    // verify restricted free agency bid exists
    //
    // Same unordered-pick defect as DELETE, with a sharper symptom: this query
    // does not filter `processed` either, and the handler checks
    // `restrictedFreeAgencyBid.processed` further down on whichever row came
    // back first. So a team holding one settled and one live bid on the same
    // player could have a perfectly legitimate edit rejected as "bid has
    // already been processed" -- the live bid was there, the query just did not
    // return it first.
    //
    // Sorting live bids ahead of processed ones fixes both: the edit lands on
    // the live row, and the processed check still guards the case where every
    // matching bid is settled. Filtering `processed` out instead would collapse
    // that case into "invalid player", which is a worse message for a manager
    // trying to edit a bid the auction already resolved.
    const query1 = await select_restricted_free_agency_bid_with_nomination({
      db
    })
      .where({
        'restricted_free_agency_bids.pid': pid,
        'restricted_free_agency_bids.tid': tid,
        'restricted_free_agency_bids.year': current_season.year
      })
      .whereNull('restricted_free_agency_bids.cancelled')
      .orderByRaw(
        '(restricted_free_agency_bids.processed IS NULL) DESC, restricted_free_agency_bids.uid DESC'
      )

    if (!query1.length) {
      return res.status(400).send({ error: 'invalid player' })
    }
    const restrictedFreeAgencyBid = query1[0]

    // get players info
    const pids = [pid]
    if (release.length) {
      release.forEach((pid) => pids.push(pid))
    }
    const player_rows = await db('player').whereIn('pid', pids)
    if (player_rows.length !== pids.length) {
      return res.status(400).send({ error: 'invalid player' })
    }
    const player_row = player_rows[0]

    // get league info
    const league = await getLeague({ lid: leagueId })
    if (!league) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    // get roster
    const rosterRow = await getRoster({ tid })
    const roster = new Roster({ roster: rosterRow, league })

    // check if release players are on team
    if (release.length) {
      for (const release_pid of release) {
        if (!roster.has(release_pid)) {
          return res.status(400).send({ error: 'invalid release' })
        }
        roster.removePlayer(release_pid)
      }
    }

    const cutlist = await db('league_cutlist')
      .select('pid')
      .where('tid', teamId)

    // remove cutlist players
    for (const row of cutlist) {
      roster.removePlayer(row.pid)
    }

    if (restrictedFreeAgencyBid.processed) {
      return res.status(400).send({ error: 'bid has already been processed' })
    }

    // if competing bid, make sure there is roster space
    if (restrictedFreeAgencyBid.original_team_id !== teamId) {
      if (!roster.has_bench_space_for_position(player_row.primary_position)) {
        return res.status(400).send({ error: 'exceeds roster limits' })
      }

      // add to roster
      roster.addPlayer({
        slot: roster_slot_types.BENCH,
        pid,
        pos: player_row.primary_position,
        value: bid,
        restricted_free_agency_original_team:
          restrictedFreeAgencyBid.original_team_id
      })
    } else {
      // update value to bid
      roster.updateValue(pid, bid)

      // check that the bid is within 10 dollars of the market salary
      const market_salary = await db('league_format_player_projection_values')
        .select('market_salary')
        .where({
          pid,
          week: 0,
          year: current_season.year,
          league_format_id: league.league_format_id
        })
        .first()

      // TODO setup mocks for tests
      // if (!market_salary) {
      //   return res.status(400).send({ error: 'market salary not found' })
      // }

      if (market_salary) {
        const salary_difference = bid - market_salary.market_salary
        if (salary_difference < -10) {
          return res.status(400).send({
            error: 'bid must not be more than $10 below market salary'
          })
        }
      }
    }

    // make sure there is enough cap space
    // TODO
    /* if (!roster.availableCap) {
     *   return res.stauts(400).send({ error: 'exceeds cap space' })
     * }
     */
    if (restrictedFreeAgencyBid.original_team_id === teamId) {
      await db('rosters_players')
        .update({ tag: player_tag_types.RESTRICTED_FREE_AGENCY })
        .where({
          roster_id: rosterRow.uid,
          pid
        })
    }

    // This is the write that made a bid's history unrecoverable: it overwrites
    // `bid_amount` and `userid` over the only copy of them, and the conditional
    // releases are rewritten by delete-and-insert just below. One `updated` row
    // records the whole request, because the amount and the releases were one
    // decision by one manager at one instant.
    //
    // The changelog entry is recorded LAST inside the transaction, after the
    // releases have settled, so its snapshot is of the offer as it ended up
    // rather than of a half-applied intermediate state.
    await db.transaction(async (trx) => {
      await trx('restricted_free_agency_bids')
        .update({
          userid: req.auth.userId,
          bid_amount: bid
        })
        .where('uid', restrictedFreeAgencyBid.uid)

      if (release.length) {
        const releaseInserts = release.map((pid) => ({
          restricted_free_agency_bid_id: restrictedFreeAgencyBid.uid,
          pid
        }))
        await trx('restricted_free_agency_releases')
          .insert(releaseInserts)
          .onConflict(['restricted_free_agency_bid_id', 'pid'])
          .merge()
      }

      await trx('restricted_free_agency_releases')
        .del()
        .where('restricted_free_agency_bid_id', restrictedFreeAgencyBid.uid)
        .whereNotIn('pid', release)

      await record_restricted_free_agency_bid_change({
        db: trx,
        bid_id: restrictedFreeAgencyBid.uid,
        change_type: bid_change_types.UPDATED,
        change_source: bid_change_sources.API_BID_UPDATE,
        changed_by_user_id: req.auth.userId
      })
    })

    res.send({
      ...restrictedFreeAgencyBid,
      bid_amount: bid,
      userid: req.auth.userId,
      release
    })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

/**
 * @swagger
 * /teams/{teamId}/tag/restricted-free-agency/nominate:
 *   post:
 *     tags:
 *       - Fantasy Teams
 *     summary: Nominate player for restricted free agency
 *     description: |
 *       Nominate a restricted free agent for the bidding process.
 *       Only the original team can nominate their RFA players.
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
 *               pid:
 *                 type: string
 *                 description: Player ID to nominate
 *                 example: "JALE-HURT-003085"
 *               leagueId:
 *                 type: integer
 *                 description: League ID
 *                 example: 2
 *             required:
 *               - pid
 *               - leagueId
 *           examples:
 *             nominatePlayer:
 *               summary: Nominate RFA player
 *               value:
 *                 pid: "JALE-HURT-003085"
 *                 leagueId: 2
 *     responses:
 *       200:
 *         description: Player nominated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 nominated:
 *                   type: integer
 *                   description: Nomination timestamp
 *                   example: 1640995200
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/nominate/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { teamId } = req.params
    const { pid, leagueId } = req.body

    if (!require_auth(req, res)) return

    if (!pid) {
      return res.status(400).send({ error: 'missing pid' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId' })
    }

    const tid = Number(teamId)

    // verify teamId, leagueId belongs to user
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

    // Check if the restricted free agency bid exists and belongs to the original manager
    // `.first()` with no ORDER BY is the same arbitrary pick as the `query1[0]`
    // sites above -- it is LIMIT 1 over an unordered set. Live bids first, then
    // most recent, so the checks below describe the row a manager can still act
    // on.
    const restricted_free_agency_bid =
      await select_restricted_free_agency_bid_with_nomination({ db })
        .where({
          'restricted_free_agency_bids.pid': pid,
          'restricted_free_agency_bids.tid': tid,
          'restricted_free_agency_bids.year': current_season.year,
          'restricted_free_agency_nominations.original_team_id': tid
        })
        .whereNull('restricted_free_agency_bids.cancelled')
        .orderByRaw(
          '(restricted_free_agency_bids.processed IS NULL) DESC, restricted_free_agency_bids.uid DESC'
        )
        .first()

    if (!restricted_free_agency_bid) {
      return res
        .status(400)
        .send({ error: 'invalid restricted free agent bid' })
    }

    if (restricted_free_agency_bid.processed) {
      return res.status(400).send({ error: 'bid has already been processed' })
    }

    if (restricted_free_agency_bid.announced_at) {
      return res.status(400).send({ error: 'bid has already been announced' })
    }

    // Clear any other unannounced nomination for this team. Nomination is a
    // property of the auction, so this now scopes by league and season as well
    // -- reading it off bid rows had no such filter and would have cleared a
    // team's nomination in an unrelated league.
    await db('restricted_free_agency_nominations')
      .where({
        league_id: leagueId,
        season_year: current_season.year,
        original_team_id: tid
      })
      .whereNull('announced_at')
      .whereNull('processed_at')
      .whereNotNull('nominated_at')
      .update({ nominated_at: null })

    const nominated_timestamp = Math.round(Date.now() / 1000)

    await db('restricted_free_agency_nominations')
      .where('nomination_id', restricted_free_agency_bid.nomination_id)
      .update({
        nominated_at: db.raw('to_timestamp(?)', [nominated_timestamp])
      })

    res.send({ nominated: nominated_timestamp })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

/**
 * @swagger
 *   delete:
 *     tags:
 *       - Fantasy Teams
 *     summary: Cancel restricted free agency nomination
 *     description: |
 *       Cancel the nomination of a restricted free agent.
 *       Cannot cancel if already announced or processed.
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
 *               pid:
 *                 type: string
 *                 description: Player ID
 *                 example: "JALE-HURT-003085"
 *               leagueId:
 *                 type: integer
 *                 description: League ID
 *                 example: 2
 *             required:
 *               - pid
 *               - leagueId
 *           examples:
 *             cancelNomination:
 *               summary: Cancel RFA nomination
 *               value:
 *                 pid: "JALE-HURT-003085"
 *                 leagueId: 2
 *     responses:
 *       200:
 *         description: Nomination cancelled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message
 *                   example: "Restricted free agent nomination successfully cancelled"
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete('/nominate/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { teamId } = req.params
    const { pid, leagueId } = req.body

    if (!require_auth(req, res)) return

    if (!pid) {
      return res.status(400).send({ error: 'missing pid' })
    }

    if (!leagueId) {
      return res.status(400).send({ error: 'missing leagueId' })
    }

    const tid = Number(teamId)

    // verify teamId, leagueId belongs to user
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

    // Check if the restricted free agency bid exists and belongs to the original manager
    // `.first()` with no ORDER BY is the same arbitrary pick as the `query1[0]`
    // sites above -- it is LIMIT 1 over an unordered set. Live bids first, then
    // most recent, so the checks below describe the row a manager can still act
    // on.
    const restricted_free_agency_bid =
      await select_restricted_free_agency_bid_with_nomination({ db })
        .where({
          'restricted_free_agency_bids.pid': pid,
          'restricted_free_agency_bids.tid': tid,
          'restricted_free_agency_bids.year': current_season.year,
          'restricted_free_agency_nominations.original_team_id': tid
        })
        .whereNull('restricted_free_agency_bids.cancelled')
        .orderByRaw(
          '(restricted_free_agency_bids.processed IS NULL) DESC, restricted_free_agency_bids.uid DESC'
        )
        .first()

    if (!restricted_free_agency_bid) {
      return res
        .status(400)
        .send({ error: 'invalid restricted free agent bid' })
    }

    if (restricted_free_agency_bid.cancelled) {
      return res.status(400).send({ error: 'bid has already been cancelled' })
    }

    if (restricted_free_agency_bid.processed) {
      return res.status(400).send({ error: 'bid has already been processed' })
    }

    if (restricted_free_agency_bid.announced_at) {
      return res.status(400).send({ error: 'bid has already been announced' })
    }

    // Cancel the nomination
    await db('restricted_free_agency_nominations')
      .where('nomination_id', restricted_free_agency_bid.nomination_id)
      .update({ nominated_at: null })

    res.send({
      message: 'Restricted free agent nomination successfully cancelled'
    })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
