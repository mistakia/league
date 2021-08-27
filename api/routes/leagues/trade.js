const dayjs = require('dayjs')
const express = require('express')
const router = express.Router({ mergeParams: true })
const { constants, Roster, toStringArray, nth } = require('../../../common')
const {
  getRoster,
  getLeague,
  sendNotifications,
  verifyRestrictedFreeAgency,
  isPlayerLocked
} = require('../../../utils')

const getTrade = async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { tradeId } = req.params

    // validate trade exists
    const trades = await db('trades').where({ uid: tradeId })
    const trade = trades[0]
    if (!trade) {
      res.status(400).send({ error: `could not find tradeid: ${tradeId}` })
    }

    const releases = await db('trade_releases').where({ tradeid: tradeId })
    const players = await db('trades_players').where({ tradeid: tradeId })
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

    for (const player of releases) {
      if (player.tid === trade.pid) {
        trade.proposingTeamReleasePlayers.push(player.player)
      } else {
        trade.acceptingTeamReleasePlayers.push(player.player)
      }
    }

    for (const pick of picks) {
      if (pick.tid === trade.pid) {
        trade.proposingTeamPicks.push(pick)
      } else {
        trade.acceptingTeamPicks.push(pick)
      }
    }

    for (const player of players) {
      if (player.tid === trade.pid) {
        trade.proposingTeamPlayers.push(player.player)
      } else {
        trade.acceptingTeamPlayers.push(player.player)
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
        .join('users_teams', 'trades.tid', 'users_teams.tid')
        .where('trades.uid', tradeId)
        .where('users_teams.userid', req.user.userId)
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

      const acceptingTeamReleasePlayers = req.body.releasePlayers
        ? Array.isArray(req.body.releasePlayers)
          ? req.body.releasePlayers
          : [req.body.releasePlayers]
        : []

      const proposingTeamReleasePlayerRows = await db('trade_releases').where({
        tradeid: tradeId
      })
      const proposingTeamReleasePlayerIds = proposingTeamReleasePlayerRows.map(
        (p) => p.player
      )

      // gather traded players
      const playerRows = await db('trades_players').where({ tradeid: tradeId })
      const proposingTeamPlayers = [] // players on proposing team
      const acceptingTeamPlayers = [] // players on accepting team
      for (const row of playerRows) {
        if (row.tid === trade.pid) {
          proposingTeamPlayers.push(row.player)
        } else {
          acceptingTeamPlayers.push(row.player)
        }
      }

      const tradedPlayers = proposingTeamPlayers.concat(acceptingTeamPlayers)
      const releasePlayers = acceptingTeamReleasePlayers.concat(
        proposingTeamReleasePlayerIds
      )
      const allPlayers = tradedPlayers.concat(releasePlayers)

      const league = await getLeague(leagueId)

      // make sure trade deadline has not passed
      const deadline = dayjs.unix(league.tddate)
      if (dayjs().isAfter(deadline)) {
        return res.status(400).send({ error: 'deadline has passed' })
      }

      // check for restricted free agency players during RFA
      try {
        await verifyRestrictedFreeAgency({ league, players: allPlayers })
      } catch (error) {
        return res.status(400).send({ error: error.message })
      }

      const sub = db('transactions')
        .select(db.raw('max(uid) as uid'))
        .whereIn('player', allPlayers)
        .where('lid', leagueId)
        .groupBy('player')

      const players = await db
        .select('player.*', 'transactions.value')
        .from(db.raw('(' + sub.toString() + ') AS X'))
        .join('transactions', 'X.uid', 'transactions.uid')
        .join('player', 'transactions.player', 'player.player')
        .whereIn('player.player', allPlayers)

      // validate accepting team roster
      const acceptingTeamRosterRow = await getRoster({ tid: trade.tid })
      const acceptingTeamRoster = new Roster({
        roster: acceptingTeamRosterRow,
        league
      })
      for (const player of acceptingTeamReleasePlayers) {
        if (!acceptingTeamRoster.has(player)) {
          return res
            .status(400)
            .send({ error: 'release player not on accepting team' })
        }

        // check if accepting team release player is a locked starter
        if (acceptingTeamRoster.isStarter(player)) {
          const isLocked = await isPlayerLocked(player)
          if (isLocked) {
            return res
              .status(400)
              .send({ error: 'release player is a locked starter' })
          }
        }
      }

      // check if accepting team trade players are a locked starter
      for (const player of acceptingTeamPlayers) {
        if (acceptingTeamRoster.isStarter(player)) {
          const isLocked = await isPlayerLocked(player)
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

      for (const playerId of proposingTeamPlayers) {
        const player = players.find((p) => p.player === playerId)
        const hasSlot = acceptingTeamRoster.hasOpenBenchSlot(player.pos)
        if (!hasSlot) {
          return res
            .status(400)
            .send({ error: 'no slots available on accepting team roster' })
        }
        acceptingTeamRoster.addPlayer({
          slot: constants.slots.BENCH,
          player: playerId,
          pos: player.pos,
          value: player.value
        })
      }

      const proposingTeamRosterRow = await getRoster({ tid: trade.pid })
      const proposingTeamRoster = new Roster({
        roster: proposingTeamRosterRow,
        league
      })

      // check if proposing team trade players are a locked starter
      for (const player of proposingTeamPlayers) {
        if (proposingTeamRoster.isStarter(player)) {
          const isLocked = await isPlayerLocked(player)
          if (isLocked) {
            return res
              .status(400)
              .send({ error: 'player in trade is a locked starter' })
          }
        }
      }

      // check if proposing team release players are a locked starter
      for (const player of proposingTeamReleasePlayerIds) {
        if (proposingTeamRoster.isStarter(player)) {
          const isLocked = await isPlayerLocked(player)
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
      for (const playerId of acceptingTeamPlayers) {
        const player = players.find((p) => p.player === playerId)
        const hasSlot = proposingTeamRoster.hasOpenBenchSlot(player.pos)
        if (!hasSlot) {
          return res
            .status(400)
            .send({ error: 'no slots available on proposing team roster' })
        }
        proposingTeamRoster.addPlayer({
          slot: constants.slots.BENCH,
          player: playerId,
          pos: player.pos,
          value: player.value
        })
      }

      // clear any existing poaching claims
      const activePoaches = await db('poaches')
        .where('lid', leagueId)
        .whereNull('processed')
        .whereIn('player', allPlayers)

      if (activePoaches.length) {
        await db('poaches')
          .update('processed', Math.round(Date.now() / 1000))
          .update('reason', 'Player traded')
          .update('succ', 0)
          .where('lid', leagueId)
          .whereIn(
            'player',
            activePoaches.map((p) => p.player)
          )
      }

      // insert receiving team releases
      const insertReleases = []
      for (const player of acceptingTeamReleasePlayers) {
        insertReleases.push({
          tradeid: tradeId,
          player,
          tid: trade.tid
        })
      }
      if (insertReleases.length) {
        await db('trade_releases').insert(insertReleases)
      }

      await db('trades')
        .where({ uid: tradeId })
        .update({ accepted: Math.round(Date.now() / 1000) })

      const subQuery = db('transactions')
        .select(
          db.raw('max(uid) AS maxuid, CONCAT(player, "_", lid) AS Group1')
        )
        .groupBy('Group1')
        .whereIn('player', tradedPlayers)
        .where({ lid: leagueId })

      const transactionHistory = await db
        .select('*')
        .from(db.raw('(' + subQuery.toString() + ') AS X'))
        .join('transactions', function () {
          this.on(function () {
            this.on(db.raw('CONCAT(player, "_", lid) = X.Group1'))
            this.andOn('uid', '=', 'maxuid')
          })
        })

      // insert transactions
      const insertTransactions = []
      for (const player of acceptingTeamPlayers) {
        insertTransactions.push({
          userid: trade.userid,
          tid: trade.pid,
          lid: leagueId,
          player,
          type: constants.transactions.TRADE,
          value: transactionHistory.find((t) => t.player === player).value,
          year: constants.season.year,
          timestamp: Math.round(Date.now() / 1000)
        })
      }
      for (const player of proposingTeamPlayers) {
        insertTransactions.push({
          userid: req.user.userId,
          tid: trade.tid,
          lid: leagueId,
          player,
          type: constants.transactions.TRADE,
          value: transactionHistory.find((t) => t.player === player).value,
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
        for (const player of proposingTeamReleasePlayerIds) {
          releaseTransactions.push({
            userid: trade.userid,
            tid: trade.pid,
            lid: leagueId,
            player,
            type: constants.transactions.ROSTER_RELEASE,
            value: 0,
            year: constants.season.year,
            timestamp: Math.round(Date.now() / 1000)
          })
        }

        for (const player of acceptingTeamReleasePlayers) {
          releaseTransactions.push({
            userid: req.user.userId,
            tid: trade.tid,
            lid: leagueId,
            player,
            type: constants.transactions.ROSTER_RELEASE,
            value: 0,
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
        await db('rosters_players').insert(acceptingTeamRoster.players)
      }

      // update proposing team roster
      if (acceptingTeamPlayers.length || proposingTeamPlayers.length) {
        await db('rosters_players')
          .del()
          .where({ rid: proposingTeamRoster.uid })
        await db('rosters_players').insert(proposingTeamRoster.players)
      }

      // update traded picks
      const pickRows = await db('trades_picks').where({ tradeid: tradeId })
      for (const pick of pickRows) {
        await db('draft')
          .update({ tid: pick.tid === trade.pid ? trade.tid : trade.pid }) // swap team ids
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
        .whereIn('trades_players.player', allPlayers)
        .where('trades.lid', leagueId)
        .whereNull('trades.accepted')
        .whereNull('trades.cancelled')
        .whereNull('trades.rejected')
        .whereNull('trades.vetoed')

      // remove players from cutlist
      await db('cutlist')
        .whereIn('player', allPlayers)
        .whereIn('tid', [trade.pid, trade.tid])
        .del()

      // cancel any transition bids
      await db('transition_bids')
        .update('cancelled', Math.round(Date.now() / 1000))
        .whereIn('player', allPlayers)
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

      const teams = await db('teams').whereIn('uid', [trade.pid, trade.tid])
      const proposingTeam = teams.find((t) => t.uid === trade.pid)
      const acceptingTeam = teams.find((t) => t.uid === trade.tid)
      const proposingTeamItems = []
      const acceptingTeamItems = []
      for (const playerId of proposingTeamPlayers) {
        const player = players.find((p) => p.player === playerId)
        proposingTeamItems.push(
          `${player.fname} ${player.lname} (${player.pos})`
        )
      }
      for (const playerId of acceptingTeamPlayers) {
        const player = players.find((p) => p.player === playerId)
        acceptingTeamItems.push(
          `${player.fname} ${player.lname} (${player.pos})`
        )
      }

      const picks = await db('draft').whereIn(
        'uid',
        pickRows.map((p) => p.pickid)
      )
      for (const pick of picks) {
        const pickNum = pick.pick % league.nteams || league.nteams
        const pickStr = pick.pick
          ? `${pick.year} ${pick.round}.${('0' + pickNum).slice(-2)}`
          : `${pick.year} ${pick.round}${nth(pick.round)}`

        // pick.tid is the team the pick belongs to
        const pickTradeInfo = pickRows.find((p) => p.pickid === pick.uid)
        if (pickTradeInfo.tid === trade.pid) {
          proposingTeamItems.push(pickStr)
        } else {
          acceptingTeamItems.push(pickStr)
        }
      }
      const proposingTeamStr = toStringArray(proposingTeamItems)
      const acceptingTeamStr = toStringArray(acceptingTeamItems)

      let message = `${proposingTeam.name} has traded ${proposingTeamStr} to ${acceptingTeam.name} in exchange for ${acceptingTeamStr}.`

      if (releasePlayers.length) {
        const releaseItems = []
        for (const playerId of releasePlayers) {
          const player = players.find((p) => p.player === playerId)
          releaseItems.push(`${player.fname} ${player.lname} (${player.pos})`)
        }
        const releaseItemsStr = toStringArray(releaseItems)
        message = `${message} ${releaseItemsStr} have been released.`
      }

      if (activePoaches.length) {
        const poachItems = []
        for (const poach of activePoaches) {
          const player = players.find((p) => p.player === poach.player)
          poachItems.push(`${player.fname} ${player.lname} (${player.pos})`)
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
        .join('teams', 'trades.tid', 'teams.uid')
        .join('users_teams', 'trades.tid', 'users_teams.tid')
        .where('trades.uid', tradeId)
        .where('users_teams.userid', req.user.userId)
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

      await db('trades')
        .where({ uid: tradeId })
        .update({ rejected: Math.round(Date.now() / 1000) })

      const league = await getLeague(leagueId)
      await sendNotifications({
        league,
        teamIds: [trade.pid],
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
        .join('users_teams', 'trades.pid', 'users_teams.tid')
        .join('teams', 'trades.pid', 'teams.uid')
        .where('trades.uid', tradeId)
        .where('users_teams.userid', req.user.userId)
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

      await db('trades')
        .where({ uid: tradeId })
        .update({ cancelled: Math.round(Date.now() / 1000) })

      const league = await getLeague(leagueId)
      await sendNotifications({
        league,
        teamIds: [trade.tid],
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

      const league = await getLeague(leagueId)
      if (league.commishid !== req.user.userId) {
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
        teamIds: [trade.tid, trade.pid],
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

module.exports = router
module.exports.getTrade = getTrade
