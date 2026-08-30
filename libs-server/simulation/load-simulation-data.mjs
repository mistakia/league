// @ts-check
/**
 * Load simulation data from database.
 * Database queries and data loading for simulation.
 */

import debug from 'debug'

import db from '#db'

import { load_nfl_schedule } from './load-nfl-schedule.mjs'
import { load_market_projections } from './load-market-projections.mjs'
import {
  load_player_projections,
  load_player_projection_stats
} from './load-projection-data.mjs'
import { merge_player_projections } from './merge-player-projections.mjs'

const log = debug('simulation:load-simulation-data')

// Re-export from split files for backwards compatibility
export {
  load_player_variance,
  load_player_archetypes
} from './load-player-variance.mjs'

export {
  merge_market_stats_with_traditional,
  load_player_projections,
  load_player_projection_stats
} from './load-projection-data.mjs'

/**
 * Load player info (position, current team) for a set of player IDs.
 *
 * @param {object} params
 * @param {string[]} params.player_ids - Array of player IDs
 * @returns {Promise<Map<string, { position: string, nfl_team: string }>>}
 */
export async function load_player_info({ player_ids }) {
  if (!player_ids.length) {
    return new Map()
  }

  const players = await db('player')
    .select('pid', 'primary_position', 'current_nfl_team')
    .whereIn('pid', player_ids)

  const player_map = new Map()
  for (const p of players) {
    player_map.set(p.pid, {
      position: p.primary_position,
      nfl_team: p.current_nfl_team
    })
  }

  return player_map
}

/**
 * Load scoring format by hash.
 *
 * @param {object} params
 * @param {string} params.scoring_format_id - Scoring format hash
 * @returns {Promise<import('#db/schema-types.js').LeagueScoringFormatsRow>} Scoring format configuration
 */
export async function load_scoring_format({ scoring_format_id }) {
  const scoring_format = await db('league_scoring_formats')
    .where({ id: scoring_format_id })
    .first()

  if (!scoring_format) {
    throw new Error(`Scoring format not found: ${scoring_format_id}`)
  }

  return scoring_format
}

/**
 * Load actual fantasy points for players from completed games.
 * Uses pre-calculated points from scoring_format_player_gamelogs.
 *
 * @param {object} params
 * @param {string[]} params.player_ids - Array of player IDs
 * @param {number[]} params.esbids - Array of completed game esbids
 * @param {string} params.scoring_format_id - Scoring format hash
 * @returns {Promise<Map<string, number>>} pid -> actual points
 */
export async function load_actual_player_points({
  player_ids,
  esbids,
  scoring_format_id
}) {
  if (!player_ids.length || !esbids.length) {
    return new Map()
  }

  log(
    `Loading actual points for ${player_ids.length} players from ${esbids.length} completed games`
  )

  const rows = await db('scoring_format_player_gamelogs')
    .whereIn('pid', player_ids)
    .whereIn('esbid', esbids)
    .where('scoring_format_id', scoring_format_id)
    .select('pid', 'points')

  const points_map = new Map()
  for (const row of rows) {
    // A gamelog row can exist with no score yet. Leaving the pid out of the map
    // makes that read downstream as "no actual points"; putting a null in would
    // read as a real score of zero and poison every total it reaches.
    if (row.points === null) continue
    points_map.set(row.pid, row.points)
  }

  log(`Loaded actual points for ${points_map.size} players`)
  return points_map
}

/**
 * Load player points with game status (actual or projected).
 * Returns actual points for completed games, projections for pending games.
 * Merges market projections with traditional projections (market takes precedence)
 * to match what the simulation uses.
 *
 * @param {object} params
 * @param {string[]} params.player_ids - Array of player IDs
 * @param {number} params.week - NFL week
 * @param {number} params.year - NFL year
 * @param {string} params.scoring_format_id - Scoring format hash
 * @returns {Promise<Map<string, { points: number, is_actual: boolean, source: string }>>}
 */
export async function load_player_points_with_game_status({
  player_ids,
  week,
  year,
  scoring_format_id
}) {
  if (!player_ids.length) {
    return new Map()
  }

  // Positions feed the TD stat mapping in the market merge; NFL teams key the
  // schedule lookup below.
  const player_info = await load_player_info({ player_ids })

  // The schedule is keyed by NFL team abbreviation, and carries the season_type
  // filter this lookup needs so a PRE game cannot displace the REG game in the
  // same numbered week. Its JSDoc declares only `object`, so narrow it to the
  // two fields read below.
  const schedule =
    /** @type {Record<string, { esbid: number, is_final: boolean }>} */ (
      await load_nfl_schedule({ season_year: year, week })
    )

  // Categorize players by game status
  const completed_players = []
  const pending_players = []
  const completed_esbids = new Set()

  for (const pid of player_ids) {
    const team = player_info.get(pid)?.nfl_team
    const game_info = team ? schedule[team] : undefined
    if (game_info?.is_final) {
      completed_players.push(pid)
      completed_esbids.add(game_info.esbid)
    } else {
      pending_players.push(pid)
    }
  }

  // Load actual points for completed games
  const actual_points_map = await load_actual_player_points({
    player_ids: completed_players,
    esbids: [...completed_esbids],
    scoring_format_id
  })

  // Load scoring format for market projection calculation
  const league_settings = await load_scoring_format({ scoring_format_id })

  // Load raw projection stats for stat-level merging
  const traditional_stats = await load_player_projection_stats({
    player_ids: pending_players,
    week,
    year
  })

  // Load market projections for pending players
  let market_projections = new Map()
  if (pending_players.length > 0) {
    market_projections = await load_market_projections({
      player_ids: pending_players,
      week,
      year,
      league: league_settings
    })
  }

  // Load pre-calculated projections as fallback (same as simulation uses)
  const traditional_projections = await load_player_projections({
    player_ids: pending_players,
    week,
    year,
    scoring_format_id
  })

  // Merge projections: market stats override traditional stats where available
  const { projections: merged_points } = merge_player_projections({
    player_ids: pending_players,
    traditional_projections,
    traditional_stats,
    market_projections,
    player_info,
    league_settings
  })

  // Convert to format with source tracking
  const merged_projections = new Map()
  for (const pid of pending_players) {
    if (merged_points.has(pid)) {
      const market_had_data = market_projections.has(pid)
      merged_projections.set(pid, {
        points: merged_points.get(pid),
        source: market_had_data ? 'merged' : 'traditional'
      })
    }
  }

  // Combine into result map with is_actual flag and source
  const result = new Map()
  for (const pid of player_ids) {
    if (actual_points_map.has(pid)) {
      result.set(pid, {
        points: actual_points_map.get(pid),
        is_actual: true,
        source: 'actual'
      })
    } else if (merged_projections.has(pid)) {
      const proj = merged_projections.get(pid)
      result.set(pid, {
        points: proj.points,
        is_actual: false,
        source: proj.source
      })
    }
  }

  log(
    `Loaded points for ${result.size} players (${actual_points_map.size} actual, ${merged_projections.size} projected [${market_projections.size} with market data])`
  )
  return result
}

/**
 * Load actual playoff points from the playoffs table.
 * Returns a map of week -> Map<tid, points> for weeks that have actual results.
 *
 * @param {object} params
 * @param {number} params.league_id - League ID
 * @param {number[]} params.team_ids - Team IDs to load
 * @param {number[]} params.weeks - Weeks to check
 * @param {number} params.year - NFL year
 * @returns {Promise<object>} { actual_points: Map<week, Map<tid, points>>, weeks_with_results: number[] }
 */
export async function load_actual_playoff_points({
  league_id,
  team_ids,
  weeks,
  year
}) {
  const playoff_entries = await db('playoffs')
    .where({ lid: league_id, season_year: year })
    .whereIn('week', weeks)
    .whereIn('tid', team_ids)
    .whereNotNull('points')

  const actual_points = new Map()
  const weeks_with_results = new Set()

  for (const entry of playoff_entries) {
    // process-playoffs.mjs inserts a playoff row with a null `points` and fills
    // it in once the week is scored, so the whereNotNull above is the whole
    // "this week has a result" test — a team that legitimately scored zero
    // still counts. `points_manual` is the manual correction that overrides the
    // computed score, matched to the post-season standings in
    // scripts/process-playoffs.mjs so the forecast's actual-results winner
    // cannot disagree with the recorded champion.
    const points = entry.points_manual || entry.points

    if (!actual_points.has(entry.week)) {
      actual_points.set(entry.week, new Map())
    }
    actual_points.get(entry.week).set(entry.tid, points)
    weeks_with_results.add(entry.week)
  }

  return {
    actual_points,
    weeks_with_results: [...weeks_with_results].sort((a, b) => a - b)
  }
}
