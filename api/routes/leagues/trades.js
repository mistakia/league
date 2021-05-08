const express = require('express')
const dayjs = require('dayjs')
const router = express.Router({ mergeParams: true })
const { constants, Roster } = require('../../../common')
const { getRoster } = require('../../../utils')

const trade = require('./trade')

router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { teamId } = req.query
    const trades = await db('trades')
      .where('year', constants.season.year)
      .where(function () {
        this.where('pid', teamId).orWhere('tid', teamId)
      })
    const tradeids = trades.map((t) => t.uid)

    const drops = await db('trades_drops').whereIn('tradeid', tradeids)
    const players = await db('trades_players').whereIn('tradeid', tradeids)
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
      .whereIn('tradeid', tradeids)
      .join('draft', 'trades_picks.pickid', 'draft.uid')

    for (const trade of trades) {
      trade.proposingTeamDropPlayers = []
      trade.acceptingTeamDropPlayers = []
      trade.proposingTeamPlayers = []
      trade.acceptingTeamPlayers = []
      trade.proposingTeamPicks = []
      trade.acceptingTeamPicks = []

      for (const player of drops) {
        if (player.tradeid !== trade.uid) continue
        if (player.tid === trade.pid) {
          trade.proposingTeamDropPlayers.push(player.player)
        } else {
          trade.acceptingTeamDropPlayers.push(player.player)
        }
      }

      for (const pick of picks) {
        if (pick.tradeid !== trade.uid) continue
        if (pick.tid === trade.pid) {
          trade.proposingTeamPicks.push(pick)
        } else {
          trade.acceptingTeamPicks.push(pick)
        }
      }

      for (const player of players) {
        if (player.tradeid !== trade.uid) continue
        if (player.tid === trade.pid) {
          trade.proposingTeamPlayers.push(player.player)
        } else {
          trade.acceptingTeamPlayers.push(player.player)
        }
      }
    }
    res.send(trades)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.post(
  '/?',
  async (req, res, next) => {
    const { db, logger } = req.app.locals
    try {
      const proposingTeamPlayers = req.body.proposingTeamPlayers
        ? Array.isArray(req.body.proposingTeamPlayers)
          ? req.body.proposingTeamPlayers
          : [req.body.proposingTeamPlayers]
        : []
      const acceptingTeamPlayers = req.body.acceptingTeamPlayers
        ? Array.isArray(req.body.acceptingTeamPlayers)
          ? req.body.acceptingTeamPlayers
          : [req.body.acceptingTeamPlayers]
        : []
      const proposingTeamPicks = req.body.proposingTeamPicks
        ? Array.isArray(req.body.proposingTeamPicks)
          ? req.body.proposingTeamPicks
          : [req.body.proposingTeamPicks]
        : []
      const acceptingTeamPicks = req.body.acceptingTeamPicks
        ? Array.isArray(req.body.acceptingTeamPicks)
          ? req.body.acceptingTeamPicks
          : [req.body.acceptingTeamPicks]
        : []
      const dropPlayers = req.body.dropPlayers
        ? Array.isArray(req.body.dropPlayers)
          ? req.body.dropPlayers
          : [req.body.dropPlayers]
        : []

      const { leagueId } = req.params
      const { pid, tid } = req.body

      if (!pid) {
        return res.status(400).send({ error: 'missing param pid' })
      }

      if (!tid) {
        return res.status(400).send({ error: 'missing param tid' })
      }

      // make sure no player is on the practice squad with an existing poaching claim
      const allPlayers = proposingTeamPlayers.concat(
        acceptingTeamPlayers,
        dropPlayers
      )
      const psPlayers = await db('rosters_players')
        .join('rosters', 'rosters_players.rid', 'rosters.uid')
        .join('poaches', 'rosters_players.player', 'poaches.player')
        .where({
          year: constants.season.year,
          week: constants.season.week,
          slot: constants.slots.PS
        })
        .whereNull('poaches.processed')
        .where('poaches.lid', leagueId)
        .whereIn('rosters_players.player', allPlayers)

      if (psPlayers.length) {
        return res.status(400).send({ error: 'player has poaching claim' })
      }

      const leagues = await db('leagues').where({ uid: leagueId })
      const league = leagues[0]

      // make sure trade deadline has not passed
      const deadline = dayjs.unix(league.tddate)
      if (dayjs().isAfter(deadline)) {
        return res.status(400).send({ error: 'deadline has passed' })
      }

      const proposingTeamRosterRow = await getRoster({ tid: pid })
      const proposingTeamRoster = new Roster({
        roster: proposingTeamRosterRow,
        league
      })

      // valdiate drop players
      for (const player of dropPlayers) {
        if (!proposingTeamRoster.has(player)) {
          return res.status(400).send({ error: 'drop player not on team' })
        }
      }

      // validate sending players
      for (const player of proposingTeamPlayers) {
        if (!proposingTeamRoster.has(player)) {
          return res
            .status(400)
            .send({ error: 'proposing team player is not on proposing team' })
        }
      }

      const pickids = proposingTeamPicks.concat(acceptingTeamPicks)
      const picks = await db('draft')
        .whereIn('uid', pickids)
        .whereNull('player')

      // validate sending picks
      for (const pick of proposingTeamPicks) {
        const p = picks.find((p) => p.uid === pick)
        if (!p) {
          return res.status(400).send({ error: 'pick is not valid' })
        }

        if (p.tid !== pid) {
          return res
            .status(400)
            .send({ error: 'pick is not owned by proposing team' })
        }
      }

      // validate receiving players
      const acceptingTeamRosterRow = await getRoster({ tid })
      const acceptingTeamRoster = new Roster({
        roster: acceptingTeamRosterRow,
        league
      })
      for (const player of acceptingTeamPlayers) {
        if (!acceptingTeamRoster.has(player)) {
          return res
            .status(400)
            .send({ error: 'accepting team player not on accepting team' })
        }
      }

      // validate receiving picks
      for (const pick of acceptingTeamPicks) {
        const p = picks.find((p) => p.uid === pick)
        if (!p) {
          return res.status(400).send({ error: 'pick is not valid' })
        }

        if (p.tid !== tid) {
          return res
            .status(400)
            .send({ error: 'pick is not owned by accepting team' })
        }
      }

      // validate proposing team roster
      const sub = db('transactions')
        .select(db.raw('max(uid) as uid'))
        .whereIn('player', acceptingTeamPlayers)
        .where('lid', leagueId)
        .groupBy('player')

      const players = await db
        .select('player.*', 'transactions.value')
        .from(db.raw('(' + sub.toString() + ') AS X'))
        .join('transactions', 'X.uid', 'transactions.uid')
        .join('player', 'transactions.player', 'player.player')
        .whereIn('player.player', acceptingTeamPlayers)

      dropPlayers.forEach((p) => proposingTeamRoster.removePlayer(p))
      proposingTeamPlayers.forEach((p) => proposingTeamRoster.removePlayer(p))
      for (const playerId of acceptingTeamPlayers) {
        const player = players.find((p) => p.player === playerId)
        const hasSlot = proposingTeamRoster.hasOpenBenchSlot(player.pos)
        if (!hasSlot) {
          return res.status(400).send({ error: 'no slots available' })
        }
        proposingTeamRoster.addPlayer({
          slot: constants.slots.BENCH,
          player: playerId,
          pos: player.pos,
          value: player.value
        })
      }

      // insert trade
      const result = await db('trades').insert({
        pid,
        tid,
        userid: req.user.userId,
        year: constants.season.year,
        lid: leagueId,
        offered: Math.round(Date.now() / 1000)
      })
      const tradeid = result[0]

      // insert join entries
      const insertPlayers = []
      const insertPicks = []
      for (const player of proposingTeamPlayers) {
        insertPlayers.push({
          tradeid,
          tid: pid,
          player
        })
      }
      for (const player of acceptingTeamPlayers) {
        insertPlayers.push({
          tradeid,
          tid,
          player
        })
      }
      for (const pickid of proposingTeamPicks) {
        insertPicks.push({
          tradeid,
          pickid,
          tid: pid
        })
      }
      for (const pickid of acceptingTeamPicks) {
        insertPicks.push({
          tradeid,
          pickid,
          tid
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
  },
  trade.getTrade
)

router.use('/:tradeId([0-9]+)', trade)

module.exports = router
