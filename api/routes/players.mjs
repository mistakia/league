import express from 'express'
import cron from 'node-cron'

import cache from '#api/cache.mjs'
import {
  getPlayers,
  getTransitionBids,
  getLeague,
  get_data_view_results
} from '#libs-server'

const router = express.Router()

const leagueIds = [0, 1]
const loadPlayers = async () => {
  for (const leagueId of leagueIds) {
    const players = await getPlayers({
      leagueId,
      include_all_active_players: true
    })
    const cacheKey = `/players/${leagueId}`
    cache.set(cacheKey, players, 1800) // 30 mins
  }
}

if (process.env.NODE_ENV !== 'test') {
  loadPlayers()

  cron.schedule('*/5 * * * *', loadPlayers)
}

router.post('/?', async (req, res) => {
  const { logger } = req.app.locals
  try {
    const search = req.body.q
    const { leagueId } = req.body
    const userId = req.auth ? req.auth.userId : null
    const pids = req.body.pids
      ? Array.isArray(req.body.pids)
        ? req.body.pids
        : [req.body.pids]
      : []

    const cacheKey = `/players/${leagueId || 0}`
    if (!search && !pids.length) {
      const players = cache.get(cacheKey)
      if (players) {
        logger('USING CACHE')
        if (userId) {
          const bids = await getTransitionBids({
            userId,
            leagueId
          })

          if (!bids.length) {
            return res.send(players)
          }

          return res.send(
            players.map((p) => {
              const { bid } = bids.find((b) => b.pid === p.pid) || {}
              return { bid, ...p }
            })
          )
        }

        return res.send(players)
      }
    }

    const players = await getPlayers({
      leagueId,
      pids,
      textSearch: search,
      include_all_active_players: !pids.length
    })

    if (!search && !pids.length) {
      cache.set(cacheKey, players, 1800) // 30 mins
    }

    if (userId) {
      const bids = await getTransitionBids({ userId, leagueId })
      if (!bids.length) {
        return res.send(players)
      }

      return res.send(
        players.map((p) => {
          const { bid } = bids.find((b) => b.pid === p.pid) || {}
          return { bid, ...p }
        })
      )
    }

    res.send(players)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.post('/search/?', async (req, res) => {
  const { logger } = req.app.locals
  try {
    const { where, columns, sort, offset, prefix_columns, splits } = req.body
    if (where) {
      // TODO validate where
    }

    if (columns) {
      // TODO validate columns
    }

    if (sort) {
      // TODO validate sort
    }

    if (offset) {
      // TODO validate offset
    }

    const query = get_data_view_results({
      where,
      columns,
      sort,
      offset,
      prefix_columns,
      splits
    })

    const result = await query

    res.send(result)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.get('/:pid', async (req, res) => {
  const { db, logger, cache } = req.app.locals
  try {
    const { pid } = req.params

    const cacheKey = `/player/${pid}`
    const cached_player_row = cache.get(cacheKey)
    if (cached_player_row) {
      return res.send(cached_player_row)
    }

    const player_rows = await db('player').where({ pid }).limit(1)
    const player_row = player_rows[0]

    // snaps per game by year

    // redzone stats by year

    // injury stats

    // penalties and yardage by year

    // advanced
    // - charted stats

    // advanced rushing
    // - yardage by direction

    cache.set(cacheKey, player_row, 1800) // 30 mins
    res.send(player_row)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.get('/:pid/practices/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { pid } = req.params
    if (!pid) {
      return res.status(400).send({ error: 'missing pid' })
    }

    const data = await db('practice').where({ pid })
    res.send(data)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.get('/:pid/gamelogs/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { pid } = req.params
    const leagueId = Number(req.query.leagueId || 0) || 0
    if (!pid) {
      return res.status(400).send({ error: 'missing pid' })
    }

    const query = db('player_gamelogs')
      .select(
        'player_gamelogs.*',
        'nfl_games.day',
        'nfl_games.date',
        'nfl_games.week',
        'nfl_games.year',
        'nfl_games.seas_type',
        'nfl_games.timestamp'
      )
      .join('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
      .where('player_gamelogs.pid', pid)

    const league = await getLeague({ lid: leagueId })

    if (!league) {
      return res.status(400).send({ error: 'invalid leagueId' })
    }

    query
      .leftJoin('scoring_format_player_gamelogs', function () {
        this.on(
          'scoring_format_player_gamelogs.pid',
          '=',
          'player_gamelogs.pid'
        ).andOn(
          'scoring_format_player_gamelogs.esbid',
          '=',
          'player_gamelogs.esbid'
        )
      })
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
        'scoring_format_player_gamelogs.points',
        'scoring_format_player_gamelogs.pos_rnk',
        'league_format_player_gamelogs.points_added'
      )
      .where(function () {
        this.where(
          'scoring_format_player_gamelogs.scoring_format_hash',
          league.scoring_format_hash
        ).orWhereNull('scoring_format_player_gamelogs.scoring_format_hash')
      })
      .where(function () {
        this.where(
          'league_format_player_gamelogs.league_format_hash',
          league.league_format_hash
        ).orWhereNull('league_format_player_gamelogs.league_format_hash')
      })

    const data = await query
    res.send(data)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

router.get('/:pid/markets/?', async (req, res) => {
  const { db, logger } = req.app.locals
  try {
    const { pid } = req.params

    // Query to get markets and selections for the player
    const markets_and_selections = await db('prop_markets_index')
      .select(
        'prop_markets_index.*',
        'prop_market_selections_index.source_selection_id',
        'prop_market_selections_index.selection_name',
        'prop_market_selections_index.selection_metric_line',
        'prop_market_selections_index.odds_decimal',
        'prop_market_selections_index.odds_american',
        'prop_market_selections_index.result',
        'prop_market_selections_index.timestamp as selection_timestamp',
        'prop_market_selections_index.time_type as selection_time_type',
        'nfl_games.h',
        'nfl_games.v',
        'nfl_games.week',
        'nfl_games.date',
        'nfl_games.time_est'
      )
      .join('prop_market_selections_index', function () {
        this.on(
          'prop_markets_index.source_id',
          '=',
          'prop_market_selections_index.source_id'
        ).andOn(
          'prop_markets_index.source_market_id',
          '=',
          'prop_market_selections_index.source_market_id'
        )
      })
      .leftJoin('nfl_games', 'prop_markets_index.esbid', 'nfl_games.esbid')
      .where('prop_market_selections_index.selection_pid', pid)
      .orderBy('prop_markets_index.timestamp', 'desc')

    // Group selections by market
    const grouped_markets = markets_and_selections.reduce((acc, row) => {
      const market_key = `${row.source_id}_${row.source_market_id}`
      if (!acc[market_key]) {
        acc[market_key] = {
          market_type: row.market_type,
          source_id: row.source_id,
          source_market_id: row.source_market_id,
          source_market_name: row.source_market_name,
          esbid: row.esbid,
          source_event_id: row.source_event_id,
          source_event_name: row.source_event_name,
          open: row.open,
          live: row.live,
          settled: row.settled,
          winning_selection_id: row.winning_selection_id,
          metric_result_value: row.metric_result_value,
          time_type: row.time_type,
          timestamp: row.timestamp,
          year: row.year,
          week: row.week,
          event_date: row.date,
          event_time_est: row.time_est,
          home_team: row.h,
          away_team: row.v,
          selections: []
        }
      }

      acc[market_key].selections.push({
        source_selection_id: row.source_selection_id,
        selection_name: row.selection_name,
        selection_metric_line: row.selection_metric_line,
        odds_decimal: row.odds_decimal,
        odds_american: row.odds_american,
        result: row.result,
        timestamp: row.selection_timestamp,
        time_type: row.selection_time_type
      })

      return acc
    }, {})

    const result = Object.values(grouped_markets)
    res.send(result)
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
