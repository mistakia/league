import debug from 'debug'

import db from '#db'
import {
  bookmakers,
  team_game_market_types
} from '#libs-shared/bookmaker-constants.mjs'

const log = debug('simulation:load-game-environment')

// Preferred source order for game markets
const SOURCE_PREFERENCE = [
  bookmakers.FANDUEL,
  bookmakers.DRAFTKINGS,
  bookmakers.CAESARS
]

/**
 * Load game environment data (totals, spreads) from prop markets.
 *
 * @param {Object} params
 * @param {number[]} params.esbids - Array of game ESBIDs to load environment for
 * @param {number} [params.week] - NFL week (alternative to esbids)
 * @param {number} [params.year] - NFL year (alternative to esbids)
 * @returns {Promise<Map>} Map of esbid -> { game_total, home_spread, away_spread, home_team, away_team }
 */
export async function load_game_environment({ esbids, week, year }) {
  let game_filter_esbids = esbids

  // If week/year provided instead of esbids, get the games for that week
  if (!esbids && week && year) {
    const games = await db('nfl_games')
      .where({ week, year, seas_type: 'REG' })
      .select('esbid')

    game_filter_esbids = games.map((g) => g.esbid)
  }

  if (!game_filter_esbids || game_filter_esbids.length === 0) {
    return new Map()
  }

  log(`Loading game environment for ${game_filter_esbids.length} games`)

  // Get game info for home/away teams
  const games = await db('nfl_games')
    .whereIn('esbid', game_filter_esbids)
    .select('esbid', 'h as home_team', 'v as away_team')

  const game_info_map = new Map()
  for (const game of games) {
    game_info_map.set(game.esbid, {
      home_team: game.home_team,
      away_team: game.away_team
    })
  }

  // Get game totals and spreads
  const markets = await db('prop_markets_index')
    .join('prop_market_selections_index', function () {
      this.on(
        'prop_markets_index.source_id',
        'prop_market_selections_index.source_id'
      ).andOn(
        'prop_markets_index.source_market_id',
        'prop_market_selections_index.source_market_id'
      )
    })
    .whereIn('prop_markets_index.esbid', game_filter_esbids)
    .whereIn('prop_markets_index.market_type', [
      team_game_market_types.GAME_TOTAL,
      team_game_market_types.GAME_SPREAD
    ])
    .whereIn('prop_markets_index.source_id', SOURCE_PREFERENCE)
    .where('prop_markets_index.time_type', 'CLOSE')
    .select(
      'prop_markets_index.esbid',
      'prop_markets_index.market_type',
      'prop_markets_index.source_id',
      'prop_market_selections_index.selection_name',
      'prop_market_selections_index.selection_metric_line as line'
    )

  log(`Found ${markets.length} game market lines`)

  // Group by game and market type
  const game_markets = new Map()

  for (const market of markets) {
    const { esbid, market_type, source_id, selection_name, line } = market

    if (!game_markets.has(esbid)) {
      game_markets.set(esbid, {
        totals: [],
        spreads: []
      })
    }

    const game_data = game_markets.get(esbid)
    const source_priority = SOURCE_PREFERENCE.indexOf(source_id)

    if (market_type === team_game_market_types.GAME_TOTAL) {
      game_data.totals.push({
        source_id,
        source_priority,
        line: parseFloat(line)
      })
    } else if (market_type === team_game_market_types.GAME_SPREAD) {
      game_data.spreads.push({
        source_id,
        source_priority,
        selection_name,
        line: parseFloat(line)
      })
    }
  }

  // Build result map
  const result = new Map()

  for (const esbid of game_filter_esbids) {
    const game_info = game_info_map.get(esbid)
    if (!game_info) continue

    const market_data = game_markets.get(esbid)

    let game_total = null
    let home_spread = null
    let away_spread = null

    if (market_data) {
      // Get best total (by source priority)
      if (market_data.totals.length > 0) {
        const best_total = market_data.totals.sort(
          (a, b) => a.source_priority - b.source_priority
        )[0]
        game_total = best_total.line
      }

      // Get best spread (by source priority)
      if (market_data.spreads.length > 0) {
        const sorted_spreads = market_data.spreads.sort(
          (a, b) => a.source_priority - b.source_priority
        )

        // Find home and away spreads
        for (const spread of sorted_spreads) {
          const selection_upper = (spread.selection_name || '').toUpperCase()

          // Check if this is home team spread
          if (
            selection_upper.includes(game_info.home_team) &&
            home_spread === null
          ) {
            home_spread = spread.line
          }

          // Check if this is away team spread
          if (
            selection_upper.includes(game_info.away_team) &&
            away_spread === null
          ) {
            away_spread = spread.line
          }
        }

        // If we have one spread, calculate the other
        if (home_spread !== null && away_spread === null) {
          away_spread = -home_spread
        } else if (away_spread !== null && home_spread === null) {
          home_spread = -away_spread
        }
      }
    }

    result.set(esbid, {
      game_total,
      home_spread,
      away_spread,
      home_team: game_info.home_team,
      away_team: game_info.away_team
    })
  }

  log(`Loaded environment for ${result.size} games`)

  return result
}

export default load_game_environment
