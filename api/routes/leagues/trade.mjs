import dayjs from 'dayjs'
import express from 'express'

import { constants, Roster, toStringArray, nth } from '#libs-shared'
import {
  getRoster,
  getLeague,
  sendNotifications,
  verifyRestrictedFreeAgency,
  isPlayerLocked,
  verifyUserTeam
} from '#libs-server'

const router = express.Router({ mergeParams: true })

export const getTrade = async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { tradeId } = req.params

    // validate trade exists
    const trades = await db('trades').where({ uid: tradeId })
    const trade = trades[0]
    if (!trade) {
      res.status(400).send({ error: `could not find tradeid: ${tradeId}` })
    }

    const release_rows = await db('trade_releases').where({ tradeid: tradeId })
    const trades_players_rows = await db('trades_players').where({
      tradeid: tradeId
    })
    const picks = await db('trades_picks')
      .select(
        'trades_picks.*',
        'draft.uid',
        'draft.pick',
        'draft.round',
        'draft.year',
        'draft.lid',
        'draft.otid'
      )
      .where({ tradeid: tradeId })
      .join('draft', 'trades_picks.pickid', 'draft.uid')

    trade.proposingTeamReleasePlayers = []
    trade.acceptingTeamReleasePlayers = []
    trade.proposingTeamPlayers = []
    trade.acceptingTeamPlayers = []
    trade.proposingTeamPicks = []
    trade.acceptingTeamPicks = []

    for (const release_row of release_rows) {
      if (release_row.tid === trade.propose_tid) {
        trade.proposingTeamReleasePlayers.push(release_row.pid)
      } else {
        trade.acceptingTeamReleasePlayers.push(release_row.pid)
      }
    }

    for (const pick of picks) {
      if (pick.tid === trade.propose_tid) {
        trade.proposingTeamPicks.push(pick)
      } else {
        trade.acceptingTeamPicks.push(pick)
      }
    }

    for (const trades_players_row of trades_players_rows) {
      if (trades_players_row.tid === trade.propose_tid) {
        trade.proposingTeamPlayers.push(trades_players_row.pid)
      } else {
        trade.acceptingTeamPlayers.push(trades_players_row.pid)
      }
    }

    res.send(trade)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
}

router.get('/?', getTrade)

router.post(
  '/accept',
  async (req, res, next) => {
    const { db, logger } = req.app.locals
    try {
      const { tradeId, leagueId } = req.params

      const trades = await db('trades')
        .join('users_teams', 'trades.accept_tid', 'users_teams.tid')
        .where('trades.uid', tradeId)
        .where('users_teams.userid', req.auth.userId)
        .whereNull('accepted')
        .whereNull('rejected')
        .whereNull('cancelled')
        .whereNull('vetoed')

      // verify trade exists
      const trade = trades[0]
      if (!trade) {
        res
          .status(400)
          .send({ error: `no valid trade with tradeid: ${tradeId}` })
      }

      try {
        await verifyUserTeam({
          userId: req.auth.userId,
          leagueId,
          teamId: trade.accept_tid,
          requireLeague: true
        })
      } catch (error) {
        return res.status(400).send({ error: error.message })
      }

      const acceptingTeamReleasePlayers = req.body.releasePlayers
        ? Array.isArray(req.body.releasePlayers)
          ? req.body.releasePlayers
          : [req.body.releasePlayers]
        : []

      const proposing_release_rows = await db('trade_releases').where({
        tradeid: tradeId
      })
      const proposingTeamReleasePlayerIds = proposing_release_rows.map(
        ({ pid }) => pid
      )

      // gather traded players
      const trades_players_rows = await db('trades_players').where({
        tradeid: tradeId
      })
      const proposingTeamPlayers = [] // players on proposing team
      const acceptingTeamPlayers = [] // players on accepting team
      for (const row of trades_players_rows) {
        if (row.tid === trade.propose_tid) {
          proposingTeamPlayers.push(row.pid)
        } else {
          acceptingTeamPlayers.push(row.pid)
        }
      }

      const tradedPlayers = proposingTeamPlayers.concat(acceptingTeamPlayers)
      const releasePlayers = acceptingTeamReleasePlayers.concat(
        proposingTeamReleasePlayerIds
      )
      const all_pids = tradedPlayers.concat(releasePlayers)

      const league = await getLeague({ lid: leagueId })

      // make sure trade deadline has not passed
      const deadline = dayjs.unix(league.tddate)
      if (dayjs().isAfter(deadline)) {
        return res.status(400).send({ error: 'deadline has passed' })
      }

      // check for restricted free agency players during RFA
      try {
        await verifyRestrictedFreeAgency({ league, pids: all_pids })
      } catch (error) {
        return res.status(400).send({ error: error.message })
      }

      const sub = db('transactions')
        .select(db.raw('max(uid) as uid'))
        .whereIn('pid', all_pids)
        .where('lid', leagueId)
        .groupBy('pid')

      const player_rows = await db
        .select('player.*', 'transactions.value')
        .from(db.raw('(' + sub.toString() + ') AS X'))
        .join('transactions', 'X.uid', 'transactions.uid')
        .join('player', 'transactions.pid', 'player.pid')
        .whereIn('player.pid', all_pids)

      // validate accepting team roster
      const acceptingTeamRosterRow = await getRoster({ tid: trade.accept_tid })
      const acceptingTeamRoster = new Roster({
        roster: acceptingTeamRosterRow,
        league
      })
      for (const pid of acceptingTeamReleasePlayers) {
        if (!acceptingTeamRoster.has(pid)) {
          return res
            .status(400)
            .send({ error: 'release player not on accepting team' })
        }

        // check if accepting team release player is a locked starter
        if (acceptingTeamRoster.isStarter(pid)) {
          const isLocked = await isPlayerLocked(pid)
          if (isLocked) {
            return res
              .status(400)
              .send({ error: 'release player is a locked starter' })
          }
        }
      }

      // check if accepting team trade players are a locked starter
      for (const pid of acceptingTeamPlayers) {
        if (acceptingTeamRoster.isStarter(pid)) {
          const isLocked = await isPlayerLocked(pid)
          if (isLocked) {
            return res
              .status(400)
              .send({ error: 'player in trade is a locked starter' })
          }
        }
      }

      acceptingTeamReleasePlayers.forEach((p) =>
        acceptingTeamRoster.removePlayer(p)
      )
      acceptingTeamPlayers.forEach((p) => acceptingTeamRoster.removePlayer(p))

      for (const pid of proposingTeamPlayers) {
        const player_row = player_rows.find((p) => p.pid === pid)
        const hasSlot = acceptingTeamRoster.hasOpenBenchSlot(player_row.pos)
        if (!hasSlot) {
          return res
            .status(400)
            .send({ error: 'no slots available on accepting team roster' })
        }
        acceptingTeamRoster.addPlayer({
          slot: constants.slots.BENCH,
          pid,
          pos: player_row.pos,
          value: player_row.value
        })
      }

      const proposingTeamRosterRow = await getRoster({ tid: trade.propose_tid })
      const proposingTeamRoster = new Roster({
        roster: proposingTeamRosterRow,
        league
      })

      // check if proposing team trade players are a locked starter
      for (const pid of proposingTeamPlayers) {
        if (proposingTeamRoster.isStarter(pid)) {
          const isLocked = await isPlayerLocked(pid)
          if (isLocked) {
            return res
              .status(400)
              .send({ error: 'player in trade is a locked starter' })
          }
        }
      }

      // check if proposing team release players are a locked starter
      for (const pid of proposingTeamReleasePlayerIds) {
        if (proposingTeamRoster.isStarter(pid)) {
          const isLocked = await isPlayerLocked(pid)
          if (isLocked) {
            return res
              .status(400)
              .send({ error: 'player in trade is a locked starter' })
          }
        }
      }

      // validate proposing team roster
      proposingTeamReleasePlayerIds.forEach((p) =>
        proposingTeamRoster.removePlayer(p)
      )
      proposingTeamPlayers.forEach((p) => proposingTeamRoster.removePlayer(p))
      for (const pid of acceptingTeamPlayers) {
        const player_row = player_rows.find((p) => p.pid === pid)
        const hasSlot = proposingTeamRoster.hasOpenBenchSlot(player_row.pos)
        if (!hasSlot) {
          return res
            .status(400)
            .send({ error: 'no slots available on proposing team roster' })
        }
        proposingTeamRoster.addPlayer({
          slot: constants.slots.BENCH,
          pid,
          pos: player_row.pos,
          value: player_row.value
        })
      }

      // clear any existing poaching claims
      const activePoaches = await db('poaches')
        .where('lid', leagueId)
        .whereNull('processed')
        .whereIn('pid', all_pids)

      if (activePoaches.length) {
        await db('poaches')
          .update('processed', Math.round(Date.now() / 1000))
          .update('reason', 'Player traded')
          .update('succ', 0)
          .where('lid', leagueId)
          .whereIn(
            'pid',
            activePoaches.map((p) => p.pid)
          )
      }

      // insert receiving team releases
      const release_inserts = []
      for (const pid of acceptingTeamReleasePlayers) {
        release_inserts.push({
          tradeid: tradeId,
          pid,
          tid: trade.accept_tid
        })
      }
      if (release_inserts.length) {
        await db('trade_releases').insert(release_inserts)
      }

      await db('trades')
        .where({ uid: tradeId })
        .update({ accepted: Math.round(Date.now() / 1000) })

      const subQuery = db('transactions')
        .select(db.raw('max(uid) AS maxuid, CONCAT(pid, "_", lid) AS Group1'))
        .groupBy('Group1')
        .whereIn('pid', tradedPlayers)
        .where({ lid: leagueId })

      const transactionHistory = await db
        .select('*')
        .from(db.raw('(' + subQuery.toString() + ') AS X'))
        .join('transactions', function () {
          this.on(function () {
            this.on(db.raw('CONCAT(pid, "_", lid) = X.Group1'))
            this.andOn('uid', '=', 'maxuid')
          })
        })

      // insert transactions
      const insertTransactions = []
      for (const pid of acceptingTeamPlayers) {
        insertTransactions.push({
          userid: trade.userid,
          tid: trade.propose_tid,
          lid: leagueId,
          pid,
          type: constants.transactions.TRADE,
          value: transactionHistory.find((t) => t.pid === pid).value,
          week: constants.season.week,
          year: constants.season.year,
          timestamp: Math.round(Date.now() / 1000)
        })
      }
      for (const pid of proposingTeamPlayers) {
        insertTransactions.push({
          userid: req.auth.userId,
          tid: trade.accept_tid,
          lid: leagueId,
          pid,
          type: constants.transactions.TRADE,
          value: transactionHistory.find((t) => t.pid === pid).value,
          week: constants.season.week,
          year: constants.season.year,
          timestamp: Math.round(Date.now() / 1000)
        })
      }

      // insert trade transactions
      if (insertTransactions.length) {
        const tranIds = await db('transactions').insert(insertTransactions)
        await db('trades_transactions').insert(
          tranIds.map((t) => ({ transactionid: t, tradeid: trade.uid }))
        )
      }

      if (releasePlayers.length) {
        const releaseTransactions = []
        for (const pid of proposingTeamReleasePlayerIds) {
          releaseTransactions.push({
            userid: trade.userid,
            tid: trade.propose_tid,
            lid: leagueId,
            pid,
            type: constants.transactions.ROSTER_RELEASE,
            value: 0,
            week: constants.season.week,
            year: constants.season.year,
            timestamp: Math.round(Date.now() / 1000)
          })
        }

        for (const pid of acceptingTeamReleasePlayers) {
          releaseTransactions.push({
            userid: req.auth.userId,
            tid: trade.accept_tid,
            lid: leagueId,
            pid,
            type: constants.transactions.ROSTER_RELEASE,
            value: 0,
            week: constants.season.week,
            year: constants.season.year,
            timestamp: Math.round(Date.now() / 1000)
          })
        }

        await db('transactions').insert(releaseTransactions)
      }

      // update receiving roster
      if (acceptingTeamPlayers.length || proposingTeamPlayers.length) {
        await db('rosters_players')
          .del()
          .where({ rid: acceptingTeamRoster.uid })
        await db('rosters_players').insert(acceptingTeamRoster.rosters_players)
      }

      // update proposing team roster
      if (acceptingTeamPlayers.length || proposingTeamPlayers.length) {
        await db('rosters_players')
          .del()
          .where({ rid: proposingTeamRoster.uid })
        await db('rosters_players').insert(proposingTeamRoster.rosters_players)
      }

      // update traded picks
      const pickRows = await db('trades_picks').where({ tradeid: tradeId })
      for (const pick of pickRows) {
        await db('draft')
          .update({
            tid:
              pick.tid === trade.propose_tid
                ? trade.accept_tid
                : trade.propose_tid
          }) // swap team ids
          .where({ uid: pick.pickid })
      }

      // cancel other trades that include any picks in this trade
      const pickTradeRows = await db('trades')
        .innerJoin('trades_picks', 'trades.uid', 'trades_picks.tradeid')
        .whereIn(
          'trades_picks.pickid',
          pickRows.map((p) => p.pickid)
        )
        .whereNull('trades.accepted')
        .whereNull('trades.cancelled')
        .whereNull('trades.rejected')
        .whereNull('trades.vetoed')

      if (pickTradeRows.length) {
        // TODO - broadcast on WS
        // TODO - broadcast notifications
        const tradeids = pickTradeRows.map((t) => t.uid)
        await db('trades')
          .whereIn('uid', tradeids)
          .update({ cancelled: Math.round(Date.now() / 1000) })
      }

      // cancel other trades that include any players in this trade
      const playerTradeRows = await db('trades')
        .innerJoin('trades_players', 'trades.uid', 'trades_players.tradeid')
        .whereIn('trades_players.pid', all_pids)
        .where('trades.lid', leagueId)
        .whereNull('trades.accepted')
        .whereNull('trades.cancelled')
        .whereNull('trades.rejected')
        .whereNull('trades.vetoed')

      // remove players from cutlist
      await db('league_cutlist')
        .whereIn('pid', all_pids)
        .whereIn('tid', [trade.propose_tid, trade.accept_tid])
        .del()

      // cancel any transition bids
      await db('transition_bids')
        .update('cancelled', Math.round(Date.now() / 1000))
        .whereIn('pid', all_pids)
        .whereNull('cancelled')
        .whereNull('processed')
        .where('lid', leagueId)
        .where('year', constants.season.year)

      if (playerTradeRows.length) {
        // TODO - broadcast on WS
        // TODO - broadcast notifications
        const tradeids = playerTradeRows.map((t) => t.uid)
        await db('trades')
          .whereIn('uid', tradeids)
          .update({ cancelled: Math.round(Date.now() / 1000) })
      }

      const teams = await db('teams').where({
        lid: leagueId,
        year: constants.season.year
      })
      const proposingTeam = teams.find((t) => t.uid === trade.propose_tid)
      const acceptingTeam = teams.find((t) => t.uid === trade.accept_tid)
      const proposingTeamItems = []
      const acceptingTeamItems = []
      for (const pid of proposingTeamPlayers) {
        const player_row = player_rows.find((p) => p.pid === pid)
        proposingTeamItems.push(
          `${player_row.fname} ${player_row.lname} (${player_row.pos})`
        )
      }
      for (const pid of acceptingTeamPlayers) {
        const player_row = player_rows.find((p) => p.pid === pid)
        acceptingTeamItems.push(
          `${player_row.fname} ${player_row.lname} (${player_row.pos})`
        )
      }

      const picks = await db('draft').whereIn(
        'uid',
        pickRows.map((p) => p.pickid)
      )
      for (const pick of picks) {
        const pick_team = teams.find((t) => t.uid === pick.otid)
        let pick_str = pick.pick_str
          ? `${pick.pick_str}`
          : `${pick.year} ${pick.round}${nth(pick.round)}`

        if (pick_team) {
          pick_str = `${pick_str} (${pick_team.name})`
        }

        // pick.tid is the team the pick belongs to
        const pickTradeInfo = pickRows.find((p) => p.pickid === pick.uid)
        if (pickTradeInfo.tid === trade.propose_tid) {
          proposingTeamItems.push(pick_str)
        } else {
          acceptingTeamItems.push(pick_str)
        }
      }
      const proposingTeamStr = toStringArray(proposingTeamItems)
      const acceptingTeamStr = toStringArray(acceptingTeamItems)

      let message = `${proposingTeam.name} has traded ${proposingTeamStr} to ${acceptingTeam.name} in exchange for ${acceptingTeamStr}.`

      if (releasePlayers.length) {
        const releaseItems = []
        for (const pid of releasePlayers) {
          const { fname, lname, pos } = player_rows.find((p) => p.pid === pid)
          releaseItems.push(`${fname} ${lname} (${pos})`)
        }
        const releaseItemsStr = toStringArray(releaseItems)
        message = `${message} ${releaseItemsStr} have been released.`
      }

      if (activePoaches.length) {
        const poachItems = []
        for (const poach of activePoaches) {
          const { fname, lname, pos } = player_rows.find(
            (p) => p.pid === poach.pid
          )
          poachItems.push(`${fname} ${lname} (${pos})`)
        }
        const poachItemsStr = toStringArray(poachItems)

        message = `${message} Poaching claim(s) for ${poachItemsStr} have been cancelled.`
      }

      await sendNotifications({
        league,
        notifyLeague: true,
        message
      })

      next()
    } catch (error) {
      console.log(error)
      logger(error)
      res.status(500).send({ error: error.toString() })
    }
  },
  getTrade
)

router.post(
  '/reject',
  async (req, res, next) => {
    const { db, logger } = req.app.locals
    try {
      const { tradeId, leagueId } = req.params

      const trades = await db('trades')
        .join('teams', 'trades.accept_tid', 'teams.uid')
        .join('users_teams', 'trades.accept_tid', 'users_teams.tid')
        .where('trades.uid', tradeId)
        .where('teams.year', constants.season.year)
        .where('users_teams.userid', req.auth.userId)
        .whereNull('accepted')
        .whereNull('vetoed')
        .whereNull('cancelled')
        .whereNull('rejected')

      if (!trades.length) {
        return res
          .status(400)
          .send({ error: `no valid trade with tradeid: ${tradeId}` })
      }

      const trade = trades[0]

      try {
        await verifyUserTeam({
          userId: req.auth.userId,
          leagueId,
          teamId: trade.accept_tid,
          requireLeague: true
        })
      } catch (error) {
        return res.status(400).send({ error: error.message })
      }

      await db('trades')
        .where({ uid: tradeId })
        .update({ rejected: Math.round(Date.now() / 1000) })

      const league = await getLeague({ lid: leagueId })
      await sendNotifications({
        league,
        teamIds: [trade.propose_tid],
        message: `${trade.name} (${trade.abbrv}) has rejected your trade offer.`
      })

      next()
    } catch (error) {
      logger(error)
      res.status(500).send({ error: error.toString() })
    }
  },
  getTrade
)

router.post(
  '/cancel',
  async (req, res, next) => {
    const { db, logger } = req.app.locals
    try {
      const { tradeId, leagueId } = req.params

      const trades = await db('trades')
        .join('users_teams', 'trades.propose_tid', 'users_teams.tid')
        .join('teams', 'trades.propose_tid', 'teams.uid')
        .where('trades.uid', tradeId)
        .where('teams.year', constants.season.year)
        .where('users_teams.userid', req.auth.userId)
        .whereNull('accepted')
        .whereNull('vetoed')
        .whereNull('cancelled')
        .whereNull('rejected')

      if (!trades.length) {
        return res
          .status(400)
          .send({ error: `no valid trade with tradeid: ${tradeId}` })
      }

      const trade = trades[0]

      try {
        await verifyUserTeam({
          userId: req.auth.userId,
          leagueId,
          teamId: trade.propose_tid,
          requireLeague: true
        })
      } catch (error) {
        return res.status(400).send({ error: error.message })
      }

      await db('trades')
        .where({ uid: tradeId })
        .update({ cancelled: Math.round(Date.now() / 1000) })

      const league = await getLeague({ lid: leagueId })
      await sendNotifications({
        league,
        teamIds: [trade.accept_tid],
        message: `${trade.name} (${trade.abbrv}) has cancelled their trade offer.`
      })

      next()
    } catch (error) {
      logger(error)
      res.status(500).send({ error: error.toString() })
    }
  },
  getTrade
)

router.post(
  '/veto',
  async (req, res, next) => {
    const { db, logger } = req.app.locals
    try {
      const { tradeId, leagueId } = req.params

      const league = await getLeague({ lid: leagueId })
      if (league.commishid !== req.auth.userId) {
        return res
          .status(401)
          .send({ error: 'only the commissioner can veto trades' })
      }

      const trades = await db('trades').where({ uid: tradeId, lid: leagueId })
      if (!trades.length) {
        return res
          .status(400)
          .send({ error: `no valid trade with tradeid: ${tradeId}` })
      }

      const trade = trades[0]

      await db('trades')
        .where({ uid: tradeId, lid: leagueId })
        .update({ vetoed: Math.round(Date.now() / 1000) })

      const message = `The commissioner has vetoed trade #${tradeId}.`

      await sendNotifications({
        league,
        notifyLeague: true,
        teamIds: [trade.accept_tid, trade.propose_tid],
        message
      })

      next()
    } catch (error) {
      logger(error)
      res.status(500).send({ error: error.toString() })
    }
  },
  getTrade
)

export default router
