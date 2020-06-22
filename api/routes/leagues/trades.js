const express = require('express')
const router = express.Router({ mergeParams: true })
const { constants, getEligibleSlots, Roster } = require('../../../common')

const trade = require('./trade')

router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { teamId } = req.query
    const trades = await db('trades')
      .where('year', constants.year)
      .where(function () {
        this.where('pid', teamId).orWhere('tid', teamId)
      })
    const tradeids = trades.map(t => t.uid)

    const drops = await db('trades_drops').whereIn('tradeid', tradeids)
    const players = await db('trades_players').whereIn('tradeid', tradeids)
    const picks = await db('trades_picks')
      .select('trades_picks.*', 'draft.uid', 'draft.pick', 'draft.round', 'draft.year', 'draft.lid')
      .whereIn('tradeid', tradeids)
      .join('draft', 'trades_picks.pickid', 'draft.uid')

    for (const trade of trades) {
      trade.dropPlayers = []
      trade.sendPlayers = []
      trade.receivePlayers = []
      trade.sendPicks = []
      trade.receivePicks = []

      for (const player of drops) {
        if (player.tradeid !== trade.uid) continue
        trade.dropPlayers.push(player.player)
      }

      for (const pick of picks) {
        if (pick.tradeid !== trade.uid) continue
        if (pick.tid === trade.pid) {
          trade.receivePicks.push(pick)
        } else {
          trade.sendPicks.push(pick)
        }
      }

      for (const player of players) {
        if (player.tradeid !== trade.uid) continue
        if (player.tid === trade.pid) {
          trade.receivePlayers.push(player.player)
        } else {
          trade.sendPlayers.push(player.player)
        }
      }
    }
    res.send(trades)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.post('/?', async (req, res, next) => {
  const { db, logger } = req.app.locals
  try {
    const sendPlayers = req.body.sendPlayers
      ? (Array.isArray(req.body.sendPlayers)
        ? req.body.sendPlayers
        : [req.body.sendPlayers])
      : []
    const receivePlayers = req.body.receivePlayers
      ? (Array.isArray(req.body.receivePlayers)
        ? req.body.receivePlayers
        : [req.body.receivePlayers])
      : []
    const sendPicks = req.body.sendPicks
      ? (Array.isArray(req.body.sendPicks)
        ? req.body.sendPicks
        : [req.body.sendPicks])
      : []
    const receivePicks = req.body.receivePicks
      ? (Array.isArray(req.body.receivePicks)
        ? req.body.receivePicks
        : [req.body.receivePicks])
      : []
    const dropPlayers = req.body.dropPlayers
      ? (Array.isArray(req.body.dropPlayers)
        ? req.body.dropPlayers
        : [req.body.dropPlayers])
      : []

    const { leagueId } = req.params
    const { pid, tid } = req.body

    if (!pid) {
      return res.status(400).send({ error: 'missing param pid' })
    }

    if (!tid) {
      return res.status(400).send({ error: 'missing param tid' })
    }

    const sRosters = await db('rosters')
      .where({ lid: leagueId, year: constants.year, tid: pid })
      .orderBy('week', 'desc')
      .limit(1)
    const sRoster = new Roster(sRosters[0])

    // valdiate drop players
    for (const player of dropPlayers) {
      if (!sRoster.players.includes(player)) {
        return res.status(400).send({ error: 'drop player not on team' })
      }
    }

    // validate sending players
    for (const player of sendPlayers) {
      if (!sRoster.players.includes(player)) {
        return res.status(400).send({ error: 'send player not on team' })
      }
    }

    const pickids = sendPicks.concat(receivePicks)
    const picks = await db('trades_picks')
      .leftJoin('trades', 'trades_picks.tradeid', 'trades.uid')
      .whereNotNull('trades.accepted')
      .whereNull('trades.vetoed')
      .whereIn('trades_picks.pickid', pickids)
      .orderBy('trades.accepted', 'desc')

    // validate sending picks
    for (const pick of sendPicks) {
      const rows = picks.filter(p => pick.pickid === pick)
      if (rows.length && rows[0].tid !== pid) {
        return res.status(400).send({ error: 'pick is not owned by proposing team' })
      } else {
        const results = await db('draft').where({ uid: pick }).whereNull('player')
        if (!results.length) {
          return res.status(400).send({ error: 'pick is not valid' })
        } else if (results[0].tid !== pid) {
          return res.status(400).send({ error: 'pick is not owned by proposing team' })
        }
      }
    }

    const rRosters = await db('rosters')
      .where({ lid: leagueId, year: constants.year, tid })
      .orderBy('week', 'desc')
      .limit(1)

    // validate receiving players
    const rRoster = new Roster(rRosters[0])
    for (const player of receivePlayers) {
      if (!rRoster.players.includes(player)) {
        return res.status(400).send({ error: 'receive player not on team' })
      }
    }

    // validate receiving picks
    for (const pick of receivePicks) {
      const rows = picks.filter(p => pick.pickid === pick)
      if (rows.length && rows[0].tid !== tid) {
        return res.status(400).send({ error: 'pick is not owned by receiving team' })
      } else {
        const results = await db('draft').where({ uid: pick }).whereNull('player')
        if (!results.length) {
          return res.status(400).send({ error: 'pick is not valid' })
        } else if (results[0].tid !== tid) {
          return res.status(400).send({ error: 'pick is not owned by receiving team' })
        }
      }
    }

    // validate sending roster
    const leagues = await db('leagues').where({ uid: leagueId })
    const players = await db('player').whereIn('player', receivePlayers)
    const league = leagues[0]
    dropPlayers.forEach(p => sRoster.removePlayer(p))
    sendPlayers.forEach(p => sRoster.removePlayer(p))
    for (const playerId of receivePlayers) {
      const player = players.find(p => p.player === playerId)
      const eligibleSlots = getEligibleSlots({ bench: true, pos: player.pos1, league })
      const openSlots = sRoster.getOpenSlots(eligibleSlots)
      if (!openSlots.length) {
        return res.status(400).send({ error: 'no slots available' })
      }
      sRoster.addPlayer(openSlots[0], playerId)
    }

    // insert trade
    const result = await db('trades').insert({
      pid,
      tid,
      userid: req.user.userId,
      year: constants.year,
      lid: leagueId,
      offered: Math.round(Date.now() / 1000)
    })
    const tradeid = result[0]

    // insert join entries
    const insertPlayers = []
    const insertPicks = []
    for (const player of sendPlayers) {
      insertPlayers.push({
        tradeid,
        tid,
        player
      })
    }
    for (const player of receivePlayers) {
      insertPlayers.push({
        tradeid,
        tid: pid,
        player
      })
    }
    for (const pickid of sendPicks) {
      insertPicks.push({
        tradeid,
        pickid,
        tid
      })
    }
    for (const pickid of receivePicks) {
      insertPicks.push({
        tradeid,
        pickid,
        tid: pid
      })
    }

    const insertDrops = []
    for (const player of dropPlayers) {
      insertDrops.push({
        tradeid,
        player,
        tid: pid
      })
    }

    if (insertPicks.length) {
      await db('trades_picks').insert(insertPicks)
    }

    if (insertPlayers.length) {
      await db('trades_players').insert(insertPlayers)
    }

    if (insertDrops.length) {
      await db('trades_drops').insert(insertDrops)
    }

    req.params.tradeId = tradeid
    next()
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
}, trade.getTrade)

router.use('/:tradeId([0-9]+)', trade)

module.exports = router
