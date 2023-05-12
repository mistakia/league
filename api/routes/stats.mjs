import express from 'express'

import { constants } from '#common'
import { getLeague } from '#utils'

const router = express.Router()

router.get('/gamelogs/players', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { leagueId } = req.query
    const year = req.query.year || constants.season.year

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
