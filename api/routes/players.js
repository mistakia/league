import { constants } from '../../common'
const express = require('express')
const router = express.Router()

router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const search = req.query.q

    const includePlayerIds = []

    const latestRanking = db('rankings')
      .select(db.raw('max(timestamp) as maxtime'))
      .where('year', constants.season.year)
      .where('sf', 1)
      .where('rookie', 0)
      .where('ppr', constants.scoring.HALF)
      .where('sourceid', constants.sources.FANTASYPROS)
      .where('dynasty', 0)
    const maxtime = latestRanking.length ? latestRanking[0].maxtime : null

    if (maxtime) {
      const topPlayers = db('rankings')
        .where({
          timestamp: maxtime,
          sf: 1,
          dynasty: 0,
          ppr: constants.scoring.HALF,
          rookie: 0,
          year: constants.season.year,
          sourceid: constants.sources.FANTASYPROS
        })

      topPlayers.forEach(p => includePlayerIds.push(p.player))
    }

    if (req.user) {
      const leagues = await db('leagues')
        .select('leagues.uid')
        .join('teams', 'leagues.uid', 'teams.lid')
        .join('users_teams', 'teams.uid', 'users_teams.tid')
        .where('users_teams.userid', req.user.userId)

      const leagueIds = leagues.map(l => l.uid)

      const playerSlots = await db('rosters_players')
        .join('rosters', 'rosters_players.rid', 'rosters.uid')
        .whereIn('rosters.lid', leagueIds)
        .where('rosters.year', constants.season.year)
        .groupBy('rosters_players.player')

      playerSlots.forEach(s => includePlayerIds.push(s.player))
    }

    const selects = [
      'player.player',
      'player.fname',
      'player.lname',
      'player.pname',
      'player.start',
      'player.col',
      'player.dv',
      'player.pos',
      'player.posd',
      'player.cteam',
      'player.gsisid',
      'player.gsispid',

      'min(players.status) as status',
      'min(players.injury_status) as injuryStatus',
      'min(players.injury_body_part) as injuryBodyPart',
      'practice.status as gamestatus'
    ]

    const query = db('player')
      .select(db.raw(selects.join(',')))
      .leftJoin('players', 'player.player', 'players.player')
      .leftJoin('practice', function () {
        this.on('player.player', '=', 'practice.player').andOn('practice.week', '=', constants.season.week).andOn('practice.year', '=', constants.season.year)
      })
      .whereIn('player.pos', constants.positions)
      .groupBy('player.player')

    if (search) {
      query.whereRaw('MATCH(fname, lname) AGAINST(? IN BOOLEAN MODE)', search)
    } else {
      if (includePlayerIds.length) {
        query.whereIn('player.player', includePlayerIds)
      }

      query.orWhere(function () {
        this.where('player.pos', 'QB')
          .whereNot('player.posd', 'PS')
          .whereNot('player.cteam', 'INA')
      }).orWhere(function () {
        this.where('player.pos', 'RB')
          .where('player.posd', 'RB')
          .where('player.dcp', '<', 3)
          .whereNot('player.cteam', 'INA')
      }).orWhere(function () {
        this.where('player.pos', 'WR')
          .whereNot('player.posd', 'PS')
          .whereNot('player.cteam', 'INA')
          .where('player.dcp', '<', 3)
      }).orWhere(function () {
        this.where('player.pos', 'TE')
          .whereNot('player.posd', 'PS')
          .whereNot('player.cteam', 'INA')
          .where('player.dcp', '<', 2)
      }).orWhere(function () {
        this.where('player.pos', 'K')
          .whereNot('player.posd', 'PS')
          .whereNot('player.cteam', 'INA')
          .where('player.dcp', '<=', 1)
      }).orWhere('player.pos', 'DST')
    }

    const data = await query
    logger(`responding with ${data.length} players`)
    res.send(data)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.get('/:playerId', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { playerId } = req.params

    const players = await db('player').where({ player: playerId }).limit(1)
    const player = players[0]
    const practice = await db('practice').where({ player: playerId, year: constants.season.year })

    // snaps per game by year

    // redzone stats by year

    // injury stats

    // penalties and yardage by year

    // advanced
    // - charted stats

    // advanced rushing
    // - yardage by direction
    res.send({ ...player, practice })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

module.exports = router
