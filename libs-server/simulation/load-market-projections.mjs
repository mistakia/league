import debug from 'debug'

import db from '#db'
import {
  bookmakers,
  player_game_prop_types
} from '#libs-shared/bookmaker-constants.mjs'
import calculatePoints from '#libs-shared/calculate-points.mjs'

const log = debug('simulation:load-market-projections')

// Mapping from market types to stat column names
const MARKET_TYPE_TO_STAT = {
  [player_game_prop_types.GAME_PASSING_YARDS]: 'py',
  [player_game_prop_types.GAME_PASSING_COMPLETIONS]: 'pc',
  [player_game_prop_types.GAME_PASSING_TOUCHDOWNS]: 'tdp',
  [player_game_prop_types.GAME_PASSING_INTERCEPTIONS]: 'ints',
  [player_game_prop_types.GAME_PASSING_ATTEMPTS]: 'pa',
  [player_game_prop_types.GAME_RUSHING_YARDS]: 'ry',
  [player_game_prop_types.GAME_RUSHING_ATTEMPTS]: 'ra',
  [player_game_prop_types.GAME_RUSHING_TOUCHDOWNS]: 'tdr',
  [player_game_prop_types.GAME_RECEIVING_YARDS]: 'recy',
  [player_game_prop_types.GAME_RECEPTIONS]: 'rec',
  [player_game_prop_types.GAME_RECEIVING_TOUCHDOWNS]: 'tdrec',
  [player_game_prop_types.GAME_RECEIVING_TARGETS]: 'trg'
}

// Market types we care about for fantasy projections
const FANTASY_RELEVANT_MARKET_TYPES = Object.keys(MARKET_TYPE_TO_STAT)

// Preferred source order
const SOURCE_PREFERENCE = [bookmakers.FANDUEL, bookmakers.DRAFTKINGS]

/**
 * Convert decimal odds to implied probability.
 *
 * @param {number} odds_decimal - Decimal odds (e.g., 2.5 for +150)
 * @returns {number} Implied probability (0-1)
 */
const convert_odds_to_probability = (odds_decimal) => {
  if (!odds_decimal || odds_decimal <= 1) {
    return 0
  }
  return 1 / odds_decimal
}

/**
 * Calculate expected touchdowns from multiple TD threshold market odds.
 *
 * The math: E[TD] = P(1+) + P(2+) + P(3+) + P(4+) + ...
 * This is because:
 *   P(exactly 1) = P(1+) - P(2+)
 *   P(exactly 2) = P(2+) - P(3+)
 *   E[TD] = 1*(P(1+)-P(2+)) + 2*(P(2+)-P(3+)) + 3*P(3+) = P(1+) + P(2+) + P(3+)
 *
 * @param {Object} odds - Object with odds for each threshold
 * @param {number} odds.one_plus - Decimal odds for 1+ TD
 * @param {number} [odds.two_plus] - Decimal odds for 2+ TD (optional)
 * @param {number} [odds.three_plus] - Decimal odds for 3+ TD (optional)
 * @param {number} [odds.four_plus] - Decimal odds for 4+ TD (optional)
 * @returns {number} Expected touchdowns
 */
const calculate_expected_tds = (odds) => {
  const prob_1plus = convert_odds_to_probability(odds.one_plus)
  const prob_2plus = odds.two_plus
    ? convert_odds_to_probability(odds.two_plus)
    : 0
  const prob_3plus = odds.three_plus
    ? convert_odds_to_probability(odds.three_plus)
    : 0
  const prob_4plus = odds.four_plus
    ? convert_odds_to_probability(odds.four_plus)
    : 0

  return prob_1plus + prob_2plus + prob_3plus + prob_4plus
}

/**
 * Check if position is eligible for anytime TD mapping.
 * - RBs, WRs, TEs: Use anytime TD for combined rush/rec TD expectation (anytime_td stat)
 * - QBs: Use anytime TD for rushing TDs only (tdr stat) since passing TDs come from GAME_PASSING_TOUCHDOWNS
 *
 * Note: In betting, "Anytime Touchdown Scorer" means the player physically scores.
 * For QBs, this is rushing TDs. Passing TDs go to the receiver, not the QB.
 *
 * @param {string} position - Player position (RB, WR, TE, QB, etc.)
 * @returns {boolean} True if position should use anytime TD
 */
const is_anytime_td_eligible = (position) => {
  return ['RB', 'WR', 'TE', 'QB'].includes(position)
}

/**
 * Load player prop market lines and convert to fantasy projections.
 *
 * @param {Object} params
 * @param {string[]} params.player_ids - Array of player IDs to load projections for
 * @param {number} params.week - NFL week
 * @param {number} params.year - NFL year
 * @param {Object} params.league - League settings for calculating fantasy points
 * @returns {Promise<Map>} Map of pid -> { projection, stats, source, market_types }
 */
export async function load_market_projections({
  player_ids,
  week,
  year,
  league
}) {
  if (!player_ids || player_ids.length === 0) {
    return new Map()
  }

  if (!league) {
    throw new Error('league settings required for point calculation')
  }

  log(
    `Loading market projections for ${player_ids.length} players, week ${week}, year ${year}`
  )

  // Get all relevant prop markets for these players
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
    .join('nfl_games', 'prop_markets_index.esbid', 'nfl_games.esbid')
    .whereIn('prop_markets_index.market_type', FANTASY_RELEVANT_MARKET_TYPES)
    .whereIn('prop_market_selections_index.selection_pid', player_ids)
    .whereIn('prop_markets_index.source_id', SOURCE_PREFERENCE)
    .where('nfl_games.week', week)
    .where('nfl_games.year', year)
    .where('prop_markets_index.time_type', 'CLOSE')
    .select(
      'prop_market_selections_index.selection_pid as pid',
      'prop_markets_index.market_type',
      'prop_markets_index.source_id',
      'prop_market_selections_index.selection_metric_line as line',
      'prop_markets_index.esbid'
    )

  log(`Found ${markets.length} market lines`)

  // Query ANYTIME_TOUCHDOWN props separately (need odds_decimal for conversion)
  const anytime_td_markets = await db('prop_markets_index')
    .join('prop_market_selections_index', function () {
      this.on(
        'prop_markets_index.source_id',
        'prop_market_selections_index.source_id'
      ).andOn(
        'prop_markets_index.source_market_id',
        'prop_market_selections_index.source_market_id'
      )
    })
    .join('nfl_games', 'prop_markets_index.esbid', 'nfl_games.esbid')
    .where(
      'prop_markets_index.market_type',
      player_game_prop_types.ANYTIME_TOUCHDOWN
    )
    .whereIn('prop_market_selections_index.selection_pid', player_ids)
    .whereIn('prop_markets_index.source_id', SOURCE_PREFERENCE)
    .where('nfl_games.week', week)
    .where('nfl_games.year', year)
    .where('prop_markets_index.time_type', 'CLOSE')
    .whereNotNull('prop_market_selections_index.odds_decimal')
    .where('prop_market_selections_index.odds_decimal', '>', 1)
    .select(
      'prop_market_selections_index.selection_pid as pid',
      'prop_markets_index.source_id',
      'prop_market_selections_index.odds_decimal',
      'prop_markets_index.esbid'
    )

  log(`Found ${anytime_td_markets.length} ANYTIME_TOUCHDOWN markets`)

  // Query GAME_TWO_PLUS_TOUCHDOWNS props for better expected TD calculation
  const two_plus_td_markets = await db('prop_markets_index')
    .join('prop_market_selections_index', function () {
      this.on(
        'prop_markets_index.source_id',
        'prop_market_selections_index.source_id'
      ).andOn(
        'prop_markets_index.source_market_id',
        'prop_market_selections_index.source_market_id'
      )
    })
    .join('nfl_games', 'prop_markets_index.esbid', 'nfl_games.esbid')
    .where(
      'prop_markets_index.market_type',
      player_game_prop_types.GAME_TWO_PLUS_TOUCHDOWNS
    )
    .whereIn('prop_market_selections_index.selection_pid', player_ids)
    .whereIn('prop_markets_index.source_id', SOURCE_PREFERENCE)
    .where('nfl_games.week', week)
    .where('nfl_games.year', year)
    .where('prop_markets_index.time_type', 'CLOSE')
    .whereNotNull('prop_market_selections_index.odds_decimal')
    .where('prop_market_selections_index.odds_decimal', '>', 1)
    .select(
      'prop_market_selections_index.selection_pid as pid',
      'prop_markets_index.source_id',
      'prop_market_selections_index.odds_decimal',
      'prop_markets_index.esbid'
    )

  log(`Found ${two_plus_td_markets.length} GAME_TWO_PLUS_TOUCHDOWNS markets`)

  // Query GAME_ALT_PASSING_TOUCHDOWNS for QB passing TD calculation
  // This market has lines at 0.5 (1+), 1.5 (2+), 2.5 (3+), 3.5 (4+)
  const alt_passing_td_markets = await db('prop_markets_index')
    .join('prop_market_selections_index', function () {
      this.on(
        'prop_markets_index.source_id',
        'prop_market_selections_index.source_id'
      ).andOn(
        'prop_markets_index.source_market_id',
        'prop_market_selections_index.source_market_id'
      )
    })
    .join('nfl_games', 'prop_markets_index.esbid', 'nfl_games.esbid')
    .where(
      'prop_markets_index.market_type',
      player_game_prop_types.GAME_ALT_PASSING_TOUCHDOWNS
    )
    .whereIn('prop_market_selections_index.selection_pid', player_ids)
    .whereIn('prop_markets_index.source_id', SOURCE_PREFERENCE)
    .where('nfl_games.week', week)
    .where('nfl_games.year', year)
    .where('prop_markets_index.time_type', 'CLOSE')
    .whereNotNull('prop_market_selections_index.odds_decimal')
    .where('prop_market_selections_index.odds_decimal', '>', 1)
    .select(
      'prop_market_selections_index.selection_pid as pid',
      'prop_markets_index.source_id',
      'prop_market_selections_index.selection_metric_line as line',
      'prop_market_selections_index.odds_decimal',
      'prop_markets_index.esbid'
    )

  log(
    `Found ${alt_passing_td_markets.length} GAME_ALT_PASSING_TOUCHDOWNS markets`
  )

  // Group by player and select best source for each market type
  const player_markets = new Map()

  for (const market of markets) {
    const { pid, market_type, source_id, line, esbid } = market

    if (!player_markets.has(pid)) {
      player_markets.set(pid, {
        markets: new Map(),
        anytime_td: null,
        two_plus_td: null,
        alt_passing_tds: null,
        esbid,
        sources: new Set()
      })
    }

    const player_data = player_markets.get(pid)
    const existing = player_data.markets.get(market_type)

    // Keep the better source (based on preference order)
    const existing_preference = existing
      ? SOURCE_PREFERENCE.indexOf(existing.source_id)
      : Infinity
    const new_preference = SOURCE_PREFERENCE.indexOf(source_id)

    if (new_preference < existing_preference) {
      player_data.markets.set(market_type, {
        source_id,
        line: parseFloat(line)
      })
      player_data.sources.add(source_id)
    }
  }

  // Add ANYTIME_TOUCHDOWN data to player markets
  for (const td_market of anytime_td_markets) {
    const { pid, source_id, odds_decimal, esbid } = td_market

    if (!player_markets.has(pid)) {
      player_markets.set(pid, {
        markets: new Map(),
        anytime_td: null,
        two_plus_td: null,
        alt_passing_tds: null,
        esbid,
        sources: new Set()
      })
    }

    const player_data = player_markets.get(pid)
    const existing_td = player_data.anytime_td

    // Keep the better source (based on preference order)
    const existing_preference = existing_td
      ? SOURCE_PREFERENCE.indexOf(existing_td.source_id)
      : Infinity
    const new_preference = SOURCE_PREFERENCE.indexOf(source_id)

    if (new_preference < existing_preference) {
      player_data.anytime_td = {
        source_id,
        odds_decimal: parseFloat(odds_decimal)
      }
      player_data.sources.add(source_id)
    }
  }

  // Add GAME_TWO_PLUS_TOUCHDOWNS data to player markets
  for (const td_market of two_plus_td_markets) {
    const { pid, source_id, odds_decimal, esbid } = td_market

    if (!player_markets.has(pid)) {
      player_markets.set(pid, {
        markets: new Map(),
        anytime_td: null,
        two_plus_td: null,
        alt_passing_tds: null,
        esbid,
        sources: new Set()
      })
    }

    const player_data = player_markets.get(pid)
    const existing_td = player_data.two_plus_td

    // Keep the better source (based on preference order)
    const existing_preference = existing_td
      ? SOURCE_PREFERENCE.indexOf(existing_td.source_id)
      : Infinity
    const new_preference = SOURCE_PREFERENCE.indexOf(source_id)

    if (new_preference < existing_preference) {
      player_data.two_plus_td = {
        source_id,
        odds_decimal: parseFloat(odds_decimal)
      }
      player_data.sources.add(source_id)
    }
  }

  // Add GAME_ALT_PASSING_TOUCHDOWNS data to player markets
  // Group by player and line value (0.5=1+, 1.5=2+, 2.5=3+, 3.5=4+)
  for (const td_market of alt_passing_td_markets) {
    const { pid, source_id, odds_decimal, line, esbid } = td_market

    if (!player_markets.has(pid)) {
      player_markets.set(pid, {
        markets: new Map(),
        anytime_td: null,
        two_plus_td: null,
        alt_passing_tds: null,
        esbid,
        sources: new Set()
      })
    }

    const player_data = player_markets.get(pid)

    // Initialize alt_passing_tds structure if needed
    if (!player_data.alt_passing_tds) {
      player_data.alt_passing_tds = {
        source_id: null,
        one_plus: null,
        two_plus: null,
        three_plus: null,
        four_plus: null
      }
    }

    // Map line value to the appropriate threshold
    // Only update if this source is preferred
    const existing_source = player_data.alt_passing_tds.source_id
    const existing_preference = existing_source
      ? SOURCE_PREFERENCE.indexOf(existing_source)
      : Infinity
    const new_preference = SOURCE_PREFERENCE.indexOf(source_id)

    if (new_preference <= existing_preference) {
      player_data.alt_passing_tds.source_id = source_id
      const odds = parseFloat(odds_decimal)
      const line_val = parseFloat(line)

      if (line_val === 0.5) {
        player_data.alt_passing_tds.one_plus = odds
      } else if (line_val === 1.5) {
        player_data.alt_passing_tds.two_plus = odds
      } else if (line_val === 2.5) {
        player_data.alt_passing_tds.three_plus = odds
      } else if (line_val === 3.5) {
        player_data.alt_passing_tds.four_plus = odds
      }

      player_data.sources.add(source_id)
    }
  }

  // Convert market lines to fantasy projections
  const result = new Map()

  for (const [pid, data] of player_markets) {
    const stats = {}
    const market_types = []

    for (const [market_type, market_data] of data.markets) {
      const stat_column = MARKET_TYPE_TO_STAT[market_type]
      if (stat_column) {
        stats[stat_column] = market_data.line
        market_types.push(market_type)
      }
    }

    // Get player position for scoring calculation
    const player = await db('player').where({ pid }).first('pos')
    const position = player?.pos || ''

    // Add expected TDs from ANYTIME_TOUCHDOWN and GAME_TWO_PLUS_TOUCHDOWNS markets
    // Uses formula: E[TD] = P(1+) + P(2+) for more accurate expectation
    // Maps to anytime_td stat for all positions (QB, RB, WR, TE)
    // - For QBs: Represents rushing TDs (passing TDs come from GAME_PASSING_TOUCHDOWNS)
    // - For RB/WR/TE: Represents combined rush/rec TDs
    // Only add if no specific TD props (tdr/tdrec) already exist
    if (data.anytime_td && is_anytime_td_eligible(position)) {
      if (stats.tdr === undefined && stats.tdrec === undefined) {
        const expected_td = calculate_expected_tds({
          one_plus: data.anytime_td.odds_decimal,
          two_plus: data.two_plus_td?.odds_decimal
        })
        stats.anytime_td = expected_td
        market_types.push(player_game_prop_types.ANYTIME_TOUCHDOWN)
        if (data.two_plus_td) {
          market_types.push(player_game_prop_types.GAME_TWO_PLUS_TOUCHDOWNS)
          log(
            `ANYTIME_TD: ${pid} (${position}) 1+_odds=${data.anytime_td.odds_decimal} 2+_odds=${data.two_plus_td.odds_decimal} -> anytime_td=${expected_td.toFixed(3)}`
          )
        } else {
          log(
            `ANYTIME_TD: ${pid} (${position}) 1+_odds=${data.anytime_td.odds_decimal} (no 2+ data) -> anytime_td=${expected_td.toFixed(3)}`
          )
        }
      }
    }

    // For QBs: Use GAME_ALT_PASSING_TOUCHDOWNS to calculate expected passing TDs
    // Uses formula: E[TD] = P(1+) + P(2+) + P(3+) + P(4+) for better accuracy
    // Prefer this over GAME_PASSING_TOUCHDOWNS line since it's more accurate
    if (position === 'QB' && data.alt_passing_tds?.one_plus) {
      const expected_tdp = calculate_expected_tds({
        one_plus: data.alt_passing_tds.one_plus,
        two_plus: data.alt_passing_tds.two_plus,
        three_plus: data.alt_passing_tds.three_plus,
        four_plus: data.alt_passing_tds.four_plus
      })
      const prev_tdp = stats.tdp
      stats.tdp = expected_tdp
      market_types.push(player_game_prop_types.GAME_ALT_PASSING_TOUCHDOWNS)
      log(
        `ALT_PASSING_TD: ${pid} 1+=${data.alt_passing_tds.one_plus?.toFixed(2)} 2+=${data.alt_passing_tds.two_plus?.toFixed(2)} 3+=${data.alt_passing_tds.three_plus?.toFixed(2)} 4+=${data.alt_passing_tds.four_plus?.toFixed(2)} -> tdp=${expected_tdp.toFixed(3)}${prev_tdp !== undefined ? ' (was line=' + prev_tdp.toFixed(1) + ')' : ''}`
      )
    }

    // Skip if no usable stats
    if (Object.keys(stats).length === 0) {
      continue
    }

    // Calculate fantasy points from market-implied stats
    const points_result = calculatePoints({
      stats,
      position,
      league
    })

    log(
      `Market projection: ${pid} (${position}) stats=${JSON.stringify(stats)} -> ${points_result.total?.toFixed(2)} pts (breakdown: ${JSON.stringify(points_result.breakdown || {})})`
    )

    result.set(pid, {
      projection: points_result.total,
      stats,
      source: [...data.sources].join(','),
      market_types,
      esbid: data.esbid
    })
  }

  log(
    `Generated projections for ${result.size} players from market data (${player_ids.length} requested)`
  )

  return result
}

export default load_market_projections
