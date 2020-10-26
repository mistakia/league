import { constants } from '../../common'
const express = require('express')
const router = express.Router()
const JSONStream = require('JSONStream')

router.get('/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const includePlayerIds = ['DB-5300', 'AB-3500']
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
      'player.pos1',
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
      .whereIn('pos1', constants.positions)
      .groupBy('player.player')
      .whereNot({ cteam: 'INA' })

    if (includePlayerIds.length) {
      query.orWhereIn('player.player', includePlayerIds)
    }

    const stream = query.stream()
    res.set('Content-Type', 'application/json')
    stream.pipe(JSONStream.stringify()).pipe(res)
    req.on('close', stream.end.bind(stream))
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
    const gamelogs = await db('gamelogs').where({ player: playerId })
    const practice = await db('practice').where({ player: playerId, year: constants.season.year })

    // snaps per game by year

    // redzone stats by year

    // injury stats

    // penalties and yardage by year

    // advanced
    // - charted stats

    // advanced rushing
    // - yardage by direction
    res.send({ ...player, gamelogs, practice })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

module.exports = router
