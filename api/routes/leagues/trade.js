const API = require('groupme').Stateless
const express = require('express')
const router = express.Router({ mergeParams: true })
const { constants, Roster, getEligibleSlots } = require('../../../common')

const getTrade = async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { tradeId } = req.params
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
    trade.sendPlayers = []
    trade.receivePlayers = []
    trade.sendPicks = []
    trade.receivePicks = []

    for (const player of drops) {
      trade.dropPlayers.push(player.player)
    }

    for (const pick of picks) {
      if (pick.tid === trade.pid) {
        trade.receivePicks.push(pick)
      } else {
        trade.sendPicks.push(pick)
      }
    }

    for (const player of players) {
      if (player.tid === trade.pid) {
        trade.receivePlayers.push(player.player)
      } else {
        trade.sendPlayers.push(player.player)
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
      .where({ uid: tradeId })
      .whereNull('accepted')
      .whereNull('rejected')
      .whereNull('cancelled')
      .whereNull('vetoed')

    const trade = trades[0]
    if (!trade) {
      res.status(400).send({ error: `no valid trade with tradeid: ${tradeId}` })
    }

    // TODO - get send drop players

    const dropPlayers = req.body.dropPlayers
      ? (Array.isArray(req.body.dropPlayers)
        ? req.body.dropPlayers
        : [req.body.dropPlayers])
      : []

    const playerRows = await db('trades_players').where({ tradeid: tradeId })
    const receivePlayers = [] // from proposed team going to accepting team
    const sendPlayers = [] // from accepting team going to proposed team
    for (const row of playerRows) {
      if (row.tid === trade.pid) {
        receivePlayers.push(row.player)
      } else {
        sendPlayers.push(row.player)
      }
    }
    const rosters = await db('rosters')
      .where({ lid: leagueId, year: constants.year })
      .whereIn('tid', [trade.tid, trade.pid])
      .orderBy('week', 'desc')
      .limit(2)

    const tradedPlayers = sendPlayers.concat(receivePlayers)
    const leagues = await db('leagues').where({ uid: leagueId })
    const players = await db('player').whereIn('player', tradedPlayers)
    const league = leagues[0]

    // validate receiving roster
    const rRosterRow = rosters.find(r => r.tid === trade.tid)
    const rRoster = new Roster(rRosterRow)
    dropPlayers.forEach(p => rRoster.removePlayer(p))
    receivePlayers.forEach(p => rRoster.removePlayer(p))
    for (const playerId of sendPlayers) {
      const player = players.find(p => p.player === playerId)
      const eligibleSlots = getEligibleSlots({ bench: true, pos: player.pos1, league })
      const openSlots = rRoster.getOpenSlots(eligibleSlots)
      if (!openSlots.length) {
        return res.status(400).send({ error: 'no slots available on receiving roster' })
      }
      rRoster.addPlayer(openSlots[0], playerId)
    }

    // insert receiving team drops
    const insertDrops = []
    for (const player of dropPlayers) {
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

    const transactionHistory = await db('transactions')
      .select('*')
      .distinct('player')
      .whereIn('player', tradedPlayers)
      .where({ lid: leagueId })
      .orderBy('timestamp', 'desc')
      .limit(tradedPlayers.length)

    // insert transactions
    const insertTransactions = []
    for (const player of sendPlayers) {
      insertTransactions.push({
        userid: trade.userid,
        tid: trade.pid,
        lid: leagueId,
        player,
        type: constants.transactions.TRADE,
        value: transactionHistory.find(t => t.player === player).value,
        year: constants.year,
        timestamp: Math.round(Date.now() / 1000)
      })
    }
    for (const player of receivePlayers) {
      insertTransactions.push({
        userid: req.user.userId,
        tid: trade.tid,
        lid: leagueId,
        player,
        type: constants.transactions.TRADE,
        value: transactionHistory.find(t => t.player === player).value,
        year: constants.year,
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
    if (sendPlayers.length || receivePlayers.length) {
      await db('rosters')
        .where({ tid: trade.tid, week: constants.week })
        .update(rRoster.slots)
    }

    // process sending roster
    const sRosterRow = rosters.find(r => r.tid === trade.pid)
    const sRoster = new Roster(sRosterRow)
    // dropPlayers.forEach(p => sRoster.removePlayer(p)) - TODO get send drop players
    sendPlayers.forEach(p => sRoster.removePlayer(p))
    for (const playerId of receivePlayers) {
      const player = players.find(p => p.player === playerId)
      const eligibleSlots = getEligibleSlots({ bench: true, pos: player.pos1, league })
      const openSlots = sRoster.getOpenSlots(eligibleSlots)
      if (!openSlots.length) {
        return res.status(400).send({ error: 'no slots available on sending roster' })
      }
      sRoster.addPlayer(openSlots[0], playerId)
    }

    // update sending roster
    if (sendPlayers.length || receivePlayers.length) {
      await db('rosters')
        .where({ tid: trade.pid, week: constants.week })
        .update(sRoster.slots)
    }

    const pickRows = await db('trades_picks').where({ tradeid: tradeId })
    for (const pick of pickRows) {
      await db('draft')
        .update({ tid: pick.tid })
        .where({ uid: pick.pickid })
    }

    if (league.groupme_token && league.groupme_id) {
      const teams = await db('teams').whereIn('uid', [trade.pid, trade.tid])
      const proposingTeam = teams.find(t => t.uid === trade.pid)
      const acceptingTeam = teams.find(t => t.uid === trade.tid)
      const traded = []
      const received = []
      for (const playerId of receivePlayers) {
        const player = players.find(p => p.player === playerId)
        traded.push(`${player.fname} ${player.lname} (${player.pos1})`)
      }
      for (const playerId of sendPlayers) {
        const player = players.find(p => p.player === playerId)
        received.push(`${player.fname} ${player.lname} (${player.pos1})`)
      }

      const picks = await db('draft').whereIn('uid', pickRows.map(p => p.pickid))
      for (const pick of picks) {
        const pickNum = (pick.pick % league.nteams) || league.nteams
        const pickStr = `${pick.year} ${pick.round}.${('0' + pickNum).slice(-2)}`
        const pickTradeInfo = pickRows.find(p => p.pickid === pick.uid)
        if (pickTradeInfo.tid === trade.pid) {
          received.push(pickStr)
        } else {
          traded.push(pickStr)
        }
      }
      const tradeStr = traded.slice(0, -1).join(', ') + ', and ' + traded.slice(-1)
      const receiveStr = received.slice(0, -1).join(', ') + ', and ' + received.slice(-1)
      const message = `${proposingTeam.name} has traded ${tradeStr} to ${acceptingTeam.name} in exchange for ${receiveStr}`
      API.Bots.post(league.groupme_token, league.groupme_id, message, {}, (err) => logger(err))

      // TODO drop message
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
    const { tradeId } = req.params

    const trades = await db('trades')
      .where({ uid: tradeId })
      .whereNull('accepted')
      .whereNull('vetoed')
      .whereNull('cancelled')
      .whereNull('rejected')

    if (!trades.length) {
      return res.status(400).send({ error: `no valid trade with tradeid: ${tradeId}` })
    }

    await db('trades')
      .where({ uid: tradeId })
      .update({ rejected: Math.round(Date.now() / 1000) })

    next()
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
}, getTrade)

router.post('/cancel', async (req, res, next) => {
  const { db, logger } = req.app.locals
  try {
    const { tradeId } = req.params

    const trades = await db('trades')
      .where({ uid: tradeId })
      .whereNull('accepted')
      .whereNull('vetoed')
      .whereNull('cancelled')
      .whereNull('rejected')

    if (!trades.length) {
      return res.status(400).send({ error: `no valid trade with tradeid: ${tradeId}` })
    }

    await db('trades')
      .where({ uid: tradeId })
      .update({ cancelled: Math.round(Date.now() / 1000) })

    next()
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
}, getTrade)

router.post('/veto', async (req, res, next) => {
  const { db, logger } = req.app.locals
  try {
    // TODO - verify league commissioner
    const { tradeId } = req.params
    await db('trades')
      .where({ uid: tradeId })
      .update({ vetoed: Math.round(Date.now() / 1000) })

    next()
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
}, getTrade)

module.exports = router
module.exports.getTrade = getTrade
