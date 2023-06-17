import express from 'express'
import dayjs from 'dayjs'

import { constants, Roster } from '#libs-shared'
import {
  getRoster,
  getLeague,
  verifyRestrictedFreeAgency,
  verifyUserTeam
} from '#libs-server'
import trade, { getTrade } from './trade.mjs'

const router = express.Router({ mergeParams: true })

router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { teamId } = req.query
    const trades = await db('trades')
      .where('year', constants.season.year)
      .where(function () {
        this.where('propose_tid', teamId).orWhere('accept_tid', teamId)
      })
    const tradeids = trades.map((t) => t.uid)

    const trade_releases_rows = await db('trade_releases').whereIn(
      'tradeid',
      tradeids
    )
    const trade_players_rows = await db('trades_players').whereIn(
      'tradeid',
      tradeids
    )
    const trade_picks_rows = await db('trades_picks')
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
      trade.proposingTeamReleasePlayers = []
      trade.acceptingTeamReleasePlayers = []
      trade.proposingTeamPlayers = []
      trade.acceptingTeamPlayers = []
      trade.proposingTeamPicks = []
      trade.acceptingTeamPicks = []

      for (const row of trade_releases_rows) {
        if (row.tradeid !== trade.uid) continue
        if (row.tid === trade.propose_tid) {
          trade.proposingTeamReleasePlayers.push(row.pid)
        } else {
          trade.acceptingTeamReleasePlayers.push(row.pid)
        }
      }

      for (const row of trade_picks_rows) {
        if (row.tradeid !== trade.uid) continue
        if (row.tid === trade.propose_tid) {
          trade.proposingTeamPicks.push(row)
        } else {
          trade.acceptingTeamPicks.push(row)
        }
      }

      for (const row of trade_players_rows) {
        if (row.tradeid !== trade.uid) continue
        if (row.tid === trade.propose_tid) {
          trade.proposingTeamPlayers.push(row.pid)
        } else {
          trade.acceptingTeamPlayers.push(row.pid)
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
      const releasePlayers = req.body.releasePlayers
        ? Array.isArray(req.body.releasePlayers)
          ? req.body.releasePlayers
          : [req.body.releasePlayers]
        : []

      const { leagueId } = req.params
      const { propose_tid, accept_tid } = req.body

      if (!propose_tid) {
        return res.status(400).send({ error: 'missing param propose_tid' })
      }

      if (!accept_tid) {
        return res.status(400).send({ error: 'missing param accept_tid' })
      }

      try {
        await verifyUserTeam({
          userId: req.auth.userId,
          leagueId,
          teamId: propose_tid,
          requireLeague: true
        })
      } catch (error) {
        return res.status(400).send({ error: error.message })
      }

      // make sure no player is on the practice squad with an existing poaching claim
      const trade_pids = proposingTeamPlayers.concat(
        acceptingTeamPlayers,
        releasePlayers
      )
      const psPlayers = await db('rosters_players')
        .join('rosters', 'rosters_players.rid', 'rosters.uid')
        .join('poaches', 'rosters_players.pid', 'poaches.pid')
        .where({
          year: constants.season.year,
          week: constants.season.week
        })
        .where(function () {
          this.where({
            slot: constants.slots.PS
          }).orWhere({
            slot: constants.slots.PSD
          })
        })
        .whereNull('poaches.processed')
        .where('poaches.lid', leagueId)
        .whereIn('rosters_players.pid', trade_pids)

      if (psPlayers.length) {
        return res.status(400).send({ error: 'player has poaching claim' })
      }

      const league = await getLeague({ lid: leagueId })
      const now = dayjs()

      // check for restricted free agency players during RFA
      try {
        await verifyRestrictedFreeAgency({ league, pids: trade_pids })
      } catch (error) {
        return res.status(400).send({ error: error.message })
      }

      // make sure trade deadline has not passed
      const deadline = dayjs.unix(league.tddate)
      if (now.isAfter(deadline)) {
        return res.status(400).send({ error: 'deadline has passed' })
      }

      const proposingTeamRosterRow = await getRoster({ tid: propose_tid })
      const proposingTeamRoster = new Roster({
        roster: proposingTeamRosterRow,
        league
      })

      // valdiate release players
      for (const player of releasePlayers) {
        if (!proposingTeamRoster.has(player)) {
          return res.status(400).send({ error: 'release player not on team' })
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
      const draft_pick_rows = await db('draft')
        .whereIn('uid', pickids)
        .whereNull('pid')

      // validate sending picks
      for (const pick of proposingTeamPicks) {
        const p = draft_pick_rows.find((p) => p.uid === pick)
        if (!p) {
          return res.status(400).send({ error: 'pick is not valid' })
        }

        if (p.tid !== propose_tid) {
          return res
            .status(400)
            .send({ error: 'pick is not owned by proposing team' })
        }
      }

      // validate receiving players
      const acceptingTeamRosterRow = await getRoster({ tid: accept_tid })
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
        const p = draft_pick_rows.find((p) => p.uid === pick)
        if (!p) {
          return res.status(400).send({ error: 'pick is not valid' })
        }

        if (p.tid !== accept_tid) {
          return res
            .status(400)
            .send({ error: 'pick is not owned by accepting team' })
        }
      }

      // validate proposing team roster
      const sub = db('transactions')
        .select(db.raw('max(uid) as uid'))
        .whereIn('pid', acceptingTeamPlayers)
        .where('lid', leagueId)
        .groupBy('pid')

      const players = await db
        .select('player.*', 'transactions.value')
        .from(db.raw('(' + sub.toString() + ') AS X'))
        .join('transactions', 'X.uid', 'transactions.uid')
        .join('player', 'transactions.pid', 'player.pid')
        .whereIn('player.pid', acceptingTeamPlayers)

      releasePlayers.forEach((p) => proposingTeamRoster.removePlayer(p))
      proposingTeamPlayers.forEach((p) => proposingTeamRoster.removePlayer(p))
      for (const pid of acceptingTeamPlayers) {
        const player = players.find((p) => p.pid === pid)
        const hasSlot = proposingTeamRoster.hasOpenBenchSlot(player.pos)
        if (!hasSlot) {
          return res.status(400).send({ error: 'no slots available' })
        }
        proposingTeamRoster.addPlayer({
          slot: constants.slots.BENCH,
          pid,
          pos: player.pos,
          value: player.value
        })
      }

      // insert trade
      const result = await db('trades').insert({
        propose_tid,
        accept_tid,
        userid: req.auth.userId,
        year: constants.season.year,
        lid: leagueId,
        offered: Math.round(Date.now() / 1000)
      })
      const tradeid = result[0]

      // insert join entries
      const insertPlayers = []
      const insertPicks = []
      for (const pid of proposingTeamPlayers) {
        insertPlayers.push({
          tradeid,
          tid: propose_tid,
          pid
        })
      }
      for (const pid of acceptingTeamPlayers) {
        insertPlayers.push({
          tradeid,
          tid: accept_tid,
          pid
        })
      }
      for (const pickid of proposingTeamPicks) {
        insertPicks.push({
          tradeid,
          pickid,
          tid: propose_tid
        })
      }
      for (const pickid of acceptingTeamPicks) {
        insertPicks.push({
          tradeid,
          pickid,
          tid: accept_tid
        })
      }

      const insertReleases = []
      for (const pid of releasePlayers) {
        insertReleases.push({
          tradeid,
          pid,
          tid: propose_tid
        })
      }

      if (insertPicks.length) {
        await db('trades_picks').insert(insertPicks)
      }

      if (insertPlayers.length) {
        await db('trades_players').insert(insertPlayers)
      }

      if (insertReleases.length) {
        await db('trade_releases').insert(insertReleases)
      }

      req.params.tradeId = tradeid
      next()
    } catch (error) {
      logger(error)
      res.status(500).send({ error: error.toString() })
    }
  },
  getTrade
)

router.use('/:tradeId([0-9]+)', trade)

export default router
