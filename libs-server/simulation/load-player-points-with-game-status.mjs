// @ts-check
/**
 * Resolve per-player points for a week, using recorded results where the game
 * is final and merged projections where it is not.
 */

import debug from 'debug'

import { load_nfl_schedule } from './load-nfl-schedule.mjs'
import { load_market_projections } from './load-market-projections.mjs'
import {
  load_player_projections,
  load_player_projection_stats
} from './load-projection-data.mjs'
import { merge_player_projections } from './merge-player-projections.mjs'
import { load_player_info } from './load-player-info.mjs'
import { load_scoring_format } from './load-scoring-format.mjs'
import { load_actual_player_points } from './load-actual-points.mjs'

const log = debug('simulation:load-player-points-with-game-status')

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

  // The schedule is keyed by NFL team abbreviation, so one entry per team per
  // week. Its season_type filter excludes PRE and nothing else: on the default
  // it admits REG and POST together (load-nfl-schedule.mjs), and nfl_games
  // numbers POST weeks from 1, so for weeks 1-4 of a season whose postseason
  // has been played two rows collide on the same team key. The query has no
  // ORDER BY, so which one survives is planner-dependent. A player whose entry
  // resolves to the POST game is then classified complete, finds no gamelog for
  // that esbid, and drops out of the returned map entirely. KNOWN DEFECT, not
  // handled here — every current caller asks for weeks 15-18, which cannot
  // collide. Its JSDoc declares only `object`, so narrow it to the two fields
  // read below.
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
  const { projections: merged_points, sources: merged_sources } =
    merge_player_projections({
      player_ids: pending_players,
      traditional_projections,
      traditional_stats,
      market_projections,
      player_info,
      league_settings
    })

  // Convert to format with source tracking. The label comes from the merge
  // rather than from market_projections.has(pid): a DST or K can be present in
  // the market data and still be scored from its pre-calculated projection.
  const merged_projections = new Map()
  for (const pid of pending_players) {
    if (merged_points.has(pid)) {
      merged_projections.set(pid, {
        points: merged_points.get(pid),
        source: merged_sources.get(pid)
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
