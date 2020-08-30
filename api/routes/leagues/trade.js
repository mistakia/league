const API = require('groupme').Stateless
const express = require('express')
const router = express.Router({ mergeParams: true })
const { constants, Roster } = require('../../../common')
const { getRoster, sendNotifications } = require('../../../utils')

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

    const drops = await db('trades_drops').where({ tradeid: tradeId })
    const players = await db('trades_players').where({ tradeid: tradeId })
    const picks = await db('trades_picks')
      .select('trades_picks.*', 'draft.uid', 'draft.pick', 'draft.round', 'draft.year', 'draft.lid')
      .where({ tradeid: tradeId })
      .join('draft', 'trades_picks.pickid', 'draft.uid')

    trade.dropPlayers = []
    trade.proposingTeamPlayers = []
    trade.acceptingTeamPlayers = []
    trade.proposingTeamPicks = []
    trade.acceptingTeamPicks = []

    for (const player of drops) {
      trade.dropPlayers.push(player.player)
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

router.post('/accept', async (req, res, next) => {
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
      res.status(400).send({ error: `no valid trade with tradeid: ${tradeId}` })
    }

    const acceptingTeamDropPlayers = req.body.dropPlayers
      ? (Array.isArray(req.body.dropPlayers)
        ? req.body.dropPlayers
        : [req.body.dropPlayers])
      : []

    const proposingTeamDropPlayerRows = await db('trades_drops')
      .where({ tradeid: tradeId })
    const proposingTeamDropPlayerIds = proposingTeamDropPlayerRows.map(p => p.player)

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
    const dropPlayers = acceptingTeamDropPlayers.concat(proposingTeamDropPlayerIds)
    const allPlayers = tradedPlayers.concat(dropPlayers)
    const leagues = await db('leagues').where({ uid: leagueId })
    const players = await db('player').whereIn('player', allPlayers)
    const league = leagues[0]

    // validate accepting team roster
    const acceptingTeamRosterRow = await getRoster({ tid: trade.tid })
    const acceptingTeamRoster = new Roster({ roster: acceptingTeamRosterRow, league })
    for (const player of acceptingTeamDropPlayers) {
      if (!acceptingTeamRoster.has(player)) {
        return res.status(400).send({ error: 'drop player not on accepting team' })
      }
    }
    acceptingTeamDropPlayers.forEach(p => acceptingTeamRoster.removePlayer(p))
    acceptingTeamPlayers.forEach(p => acceptingTeamRoster.removePlayer(p))
    for (const playerId of proposingTeamPlayers) {
      const player = players.find(p => p.player === playerId)
      const hasSlot = acceptingTeamRoster.hasOpenBenchSlot(player.pos1)
      if (!hasSlot) {
        return res.status(400).send({ error: 'no slots available on accepting team roster' })
      }
      acceptingTeamRoster.addPlayer({ slot: constants.slots.BENCH, player: playerId, pos: player.pos1 })
    }

    // validate proposing team roster
    const proposingTeamRosterRow = await getRoster({ tid: trade.pid })
    const proposingTeamRoster = new Roster({ roster: proposingTeamRosterRow, league })
    proposingTeamDropPlayerIds.forEach(p => proposingTeamRoster.removePlayer(p))
    proposingTeamPlayers.forEach(p => proposingTeamRoster.removePlayer(p))
    for (const playerId of acceptingTeamPlayers) {
      const player = players.find(p => p.player === playerId)
      const hasSlot = proposingTeamRoster.hasOpenBenchSlot(player.pos1)
      if (!hasSlot) {
        return res.status(400).send({ error: 'no slots available on proposing team roster' })
      }
      proposingTeamRoster.addPlayer({ slot: constants.slots.BENCH, player: playerId, pos: player.pos1 })
    }

    // insert receiving team drops
    const insertDrops = []
    for (const player of acceptingTeamDropPlayers) {
      insertDrops.push({
        tradeid: tradeId,
        player,
        tid: trade.tid
      })
    }
    if (insertDrops.length) {
      await db('trades_drops').insert(insertDrops)
    }

    await db('trades')
      .where({ uid: tradeId })
      .update({ accepted: Math.round(Date.now() / 1000) })

    const subQuery = db('transactions')
      .select(db.raw('max(uid) AS maxuid, CONCAT(player, "_", lid) AS Group1'))
      .groupBy('Group1')
      .whereIn('player', tradedPlayers)
      .where({ lid: leagueId })

    const transactionHistory = await db
      .select('*')
      .from(db.raw('(' + subQuery.toString() + ') AS X'))
      .join(
        'transactions',
        function () {
          this.on(function () {
            this.on(db.raw('CONCAT(player, "_", lid) = X.Group1'))
            this.andOn('uid', '=', 'maxuid')
          })
        }
      )

    // insert transactions
    const insertTransactions = []
    for (const player of acceptingTeamPlayers) {
      insertTransactions.push({
        userid: trade.userid,
        tid: trade.pid,
        lid: leagueId,
        player,
        type: constants.transactions.TRADE,
        value: transactionHistory.find(t => t.player === player).value,
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
        value: transactionHistory.find(t => t.player === player).value,
        year: constants.season.year,
        timestamp: Math.round(Date.now() / 1000)
      })
    }

    // insert trade transactions
    if (insertTransactions.length) {
      const tranIds = await db('transactions').insert(insertTransactions)
      await db('trades_transactions')
        .insert(tranIds.map(t => ({ transactionid: t, tradeid: trade.uid })))
    }

    // update receiving roster
    if (acceptingTeamPlayers.length || proposingTeamPlayers.length) {
      await db('rosters_players').del().where({ rid: acceptingTeamRoster.uid })
      await db('rosters_players').insert(acceptingTeamRoster.players)
    }

    // update proposing team roster
    if (acceptingTeamPlayers.length || proposingTeamPlayers.length) {
      await db('rosters_players').del().where({ rid: proposingTeamRoster.uid })
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
    const tradeRows = await db('trades')
      .innerJoin('trades_picks', 'trades.uid', 'trades_picks.tradeid')
      .whereIn('trades_picks.pickid', pickRows.map(p => p.pickid))
      .whereNull('trades.accepted')
      .whereNull('trades.cancelled')
      .whereNull('trades.rejected')
      .whereNull('trades.vetoed')

    if (tradeRows.length) {
      // TODO - broadcast on WS
      // TODO - broadcast notifications
      const tradeids = tradeRows.map(t => t.uid)
      await db('trades')
        .whereIn('uid', tradeids)
        .update({ cancelled: Math.round(Date.now() / 1000) })
    }

    const teams = await db('teams').whereIn('uid', [trade.pid, trade.tid])
    const proposingTeam = teams.find(t => t.uid === trade.pid)
    const acceptingTeam = teams.find(t => t.uid === trade.tid)
    const proposingTeamItems = []
    const acceptingTeamItems = []
    for (const playerId of proposingTeamPlayers) {
      const player = players.find(p => p.player === playerId)
      proposingTeamItems.push(`${player.fname} ${player.lname} (${player.pos1})`)
    }
    for (const playerId of acceptingTeamPlayers) {
      const player = players.find(p => p.player === playerId)
      acceptingTeamItems.push(`${player.fname} ${player.lname} (${player.pos1})`)
    }

    const picks = await db('draft').whereIn('uid', pickRows.map(p => p.pickid))
    for (const pick of picks) {
      const pickNum = (pick.pick % league.nteams) || league.nteams
      const pickStr = pick.year === constants.season.year
        ? `${pick.year} ${pick.round}.${('0' + pickNum).slice(-2)}`
        : `${pick.year} ${pick.round}`

      // pick.tid is the team the pick belongs to
      const pickTradeInfo = pickRows.find(p => p.pickid === pick.uid)
      if (pickTradeInfo.tid === trade.pid) {
        proposingTeamItems.push(pickStr)
      } else {
        acceptingTeamItems.push(pickStr)
      }
    }
    const proposingTeamStr = proposingTeamItems.length > 1
      ? proposingTeamItems.slice(0, -1).join(', ') + ', and ' + proposingTeamItems.slice(-1)
      : proposingTeamItems.toString()
    const acceptingTeamStr = acceptingTeamItems.length > 1
      ? acceptingTeamItems.slice(0, -1).join(', ') + ', and ' + acceptingTeamItems.slice(-1)
      : acceptingTeamItems.toString()

    let message = `${proposingTeam.name} has traded ${proposingTeamStr} to ${acceptingTeam.name} in exchange for ${acceptingTeamStr}.`

    if (dropPlayers.length) {
      const dropItems = []
      for (const playerId of dropPlayers) {
        const player = players.find(p => p.player === playerId)
        dropItems.push(`${player.fname} ${player.lname} (${player.pos1})`)
      }
      const dropItemsStr = dropItems.length > 1
        ? dropItems.slice(0, -1).join(', ') + ', and ' + dropItems.slice(-1)
        : dropItems.toString()
      message = `${message} ${dropItemsStr} have been dropped.`
    }

    await sendNotifications({
      leagueId,
      league: true,
      message
    })

    if (league.groupme_token && league.groupme_id) {
      API.Bots.post(league.groupme_token, league.groupme_id, message, {}, (err) => logger(err))
    }

    next()
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
}, getTrade)

router.post('/reject', async (req, res, next) => {
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
      return res.status(400).send({ error: `no valid trade with tradeid: ${tradeId}` })
    }

    const trade = trades[0]

    await db('trades')
      .where({ uid: tradeId })
      .update({ rejected: Math.round(Date.now() / 1000) })

    await sendNotifications({
      leagueId,
      teamIds: [trade.pid],
      message: `${trade.name} (${trade.abbrv}) has rejected your trade offer.`
    })

    next()
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
}, getTrade)

router.post('/cancel', async (req, res, next) => {
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
      return res.status(400).send({ error: `no valid trade with tradeid: ${tradeId}` })
    }

    const trade = trades[0]

    await db('trades')
      .where({ uid: tradeId })
      .update({ cancelled: Math.round(Date.now() / 1000) })

    await sendNotifications({
      leagueId,
      teamIds: [trade.tid],
      message: `${trade.name} (${trade.abbrv}) has cancelled their trade offer.`
    })

    next()
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
}, getTrade)

router.post('/veto', async (req, res, next) => {
  const { db, logger } = req.app.locals
  try {
    const { tradeId, leagueId } = req.params

    const leagues = await db('leagues').where('uid', leagueId)
    const league = leagues[0]
    if (league.commishid !== req.user.userId) {
      return res.status(401).send({ error: 'only the commissioner can veto trades' })
    }

    const trades = await db('trades').where({ uid: tradeId, lid: leagueId })
    if (!trades.length) {
      return res.status(400).send({ error: `no valid trade with tradeid: ${tradeId}` })
    }

    const trade = trades[0]

    await db('trades')
      .where({ uid: tradeId, lid: leagueId })
      .update({ vetoed: Math.round(Date.now() / 1000) })

    const message = `The commissioner has vetoed trade #${tradeId}.`

    await sendNotifications({
      leagueId,
      league: true,
      teamIds: [trade.tid, trade.pid],
      message
    })

    if (league.groupme_token && league.groupme_id) {
      API.Bots.post(league.groupme_token, league.groupme_id, message, {}, (err) => logger(err))
    }

    next()
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
}, getTrade)

module.exports = router
module.exports.getTrade = getTrade
