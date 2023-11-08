import express from 'express'

import { constants } from '#libs-shared'
import { getLeague } from '#libs-server'

const router = express.Router()

router.get('/gamelogs/players', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { leagueId } = req.query
    const year = req.query.year || constants.season.year
    const week = req.query.week ? Number(req.query.week) : null
    const nfl_team = req.query.nfl_team
    const opponent = req.query.opponent
    let position = req.query.position

    if (!position) {
      position = constants.positions
    } else if (!Array.isArray(position)) {
      position = [position]
    }

    const query = db('player_gamelogs')
      .select(
        'player_gamelogs.*',
        'nfl_games.week',
        'nfl_games.year',
        'nfl_games.day',
        'nfl_games.date',
        'nfl_games.seas_type',
        'nfl_games.timestamp'
      )
      .join('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
      .where('nfl_games.year', year)
      .where('nfl_games.seas_type', 'REG')
      .whereIn('player_gamelogs.pos', position)

    if (week) {
      query.where('nfl_games.week', week)
    }

    if (nfl_team) {
      query.where('player_gamelogs.tm', nfl_team)
    }

    if (opponent) {
      query.where('player_gamelogs.opp', opponent)
    }

    if (leagueId) {
      const league = await getLeague({ lid: leagueId })

      if (!league) {
        return res.status(400).send({ error: 'invalid leagueId' })
      }

      query
        .leftJoin('league_format_player_gamelogs', function () {
          this.on(
            'league_format_player_gamelogs.pid',
            '=',
            'player_gamelogs.pid'
          ).andOn(
            'league_format_player_gamelogs.esbid',
            '=',
            'player_gamelogs.esbid'
          )
        })
        .select(
          'league_format_player_gamelogs.points',
          'league_format_player_gamelogs.points_added',
          'league_format_player_gamelogs.pos_rnk'
        )
        .where(function () {
          this.where(
            'league_format_player_gamelogs.league_format_hash',
            league.league_format_hash
          ).orWhereNull('league_format_player_gamelogs.league_format_hash')
        })
    }

    const data = await query
    res.send(data)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
