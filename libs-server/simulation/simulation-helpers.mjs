/**
 * Shared helper functions for simulation orchestrators.
 * These functions are used by both simulate-matchup.mjs and simulate-league-week.mjs.
 */

import debug from 'debug'

import db from '#db'
import { getLeague } from '#libs-server'
import {
  roster_slot_types,
  starting_lineup_slots
} from '#libs-shared/constants/roster-constants.mjs'

const log = debug('simulation:helpers')

/**
 * Load simulation context (league and scoring format).
 *
 * @param {Object} params
 * @param {number} params.league_id - League ID
 * @param {number} params.year - NFL year
 * @returns {Promise<Object>} { league, scoring_format_hash }
 */
export async function load_simulation_context({ league_id, year }) {
  const league = await getLeague({ lid: league_id })
  if (!league) {
    throw new Error(`League not found: ${league_id}`)
  }

  const season = await db('seasons').where({ lid: league_id, year }).first()
  if (!season) {
    throw new Error(`Season not found for league ${league_id}, year ${year}`)
  }

  return {
    league,
    scoring_format_hash: season.scoring_format_hash
  }
}

/**
 * Categorize players into locked (completed games) vs pending (to simulate).
 *
 * @param {Object} params
 * @param {string[]} params.player_ids - Array of player IDs
 * @param {Map} params.player_info - Map of pid -> { position, nfl_team }
 * @param {Object} params.schedule - NFL schedule with game status
 * @param {boolean} params.use_actual_results - Whether to use actual results for completed games
 * @returns {Object} { locked_player_ids, pending_player_ids, completed_esbids }
 */
export function categorize_players_by_game_status({
  player_ids,
  player_info,
  schedule,
  use_actual_results
}) {
  const locked_player_ids = []
  const pending_player_ids = []
  const completed_esbids = new Set()

  for (const pid of player_ids) {
    const info = player_info.get(pid)
    const game = schedule[info?.nfl_team]

    if (use_actual_results && game?.is_final) {
      locked_player_ids.push(pid)
      completed_esbids.add(game.esbid)
    } else {
      pending_player_ids.push(pid)
    }
  }

  return { locked_player_ids, pending_player_ids, completed_esbids }
}

/**
 * Build player objects for simulation from rosters and player info.
 *
 * @param {Object} params
 * @param {Object[]} params.rosters - Array of { team_id, player_ids }
 * @param {Map} params.player_info - Map of pid -> { position, nfl_team }
 * @param {Map} params.position_ranks - Map of pid -> position_rank
 * @returns {Object[]} Array of player objects for simulation
 */
export function build_simulation_players({
  rosters,
  player_info,
  position_ranks
}) {
  const players = []
  for (const roster of rosters) {
    for (const pid of roster.player_ids) {
      const info = player_info.get(pid)
      if (!info) {
        log(`No player info for ${pid}, skipping`)
        continue
      }

      players.push({
        pid,
        nfl_team: info.nfl_team,
        position: info.position,
        position_rank: position_ranks.get(pid) || info.position,
        team_id: roster.team_id
      })
    }
  }
  return players
}

/**
 * Map players to their NFL games based on schedule.
 *
 * @param {Object} params
 * @param {Map} params.player_info - Map of pid -> { position, nfl_team }
 * @param {Object} params.schedule - NFL schedule object
 * @returns {Object} { games_map: Map<esbid, { players, is_final }>, bye_player_ids: string[] }
 */
export function map_players_to_nfl_games({ player_info, schedule }) {
  const games_map = new Map()
  const bye_player_ids = []

  for (const [pid, info] of player_info) {
    const game = schedule[info.nfl_team]

    if (!game) {
      bye_player_ids.push(pid)
      continue
    }

    if (!games_map.has(game.esbid)) {
      games_map.set(game.esbid, {
        players: [],
        is_final: game.is_final
      })
    }

    games_map.get(game.esbid).players.push({
      pid,
      nfl_team: info.nfl_team,
      position: info.position
    })
  }

  return { games_map, bye_player_ids }
}

/**
 * Build pseudo-schedule for a single NFL game.
 * Creates the minimal schedule object needed for correlation matrix building.
 *
 * @param {Object[]} players - Players in the game with nfl_team
 * @param {Object} schedule - Full NFL schedule
 * @returns {Object} Single-game schedule object
 */
export function build_game_schedule(players, schedule) {
  const game_schedule = {}
  const teams_seen = new Set()

  for (const player of players) {
    if (!teams_seen.has(player.nfl_team)) {
      const game = schedule[player.nfl_team]
      if (game) {
        game_schedule[player.nfl_team] = game
        // Also add opponent team for cross-team correlation detection
        if (!teams_seen.has(game.opponent)) {
          game_schedule[game.opponent] = schedule[game.opponent]
        }
        teams_seen.add(player.nfl_team)
        teams_seen.add(game.opponent)
      }
    }
  }

  return game_schedule
}

/**
 * Load all fantasy team rosters for a league in a given week.
 *
 * @param {Object} params
 * @param {number} params.league_id - League ID
 * @param {number} params.week - NFL week
 * @param {number} params.year - NFL year
 * @returns {Promise<Map>} Map of team_id -> { player_ids: string[], baseline_total: number }
 */
export async function load_all_league_rosters({ league_id, week, year }) {
  log(`Loading all rosters for league ${league_id}, week ${week}`)

  // Load lineup totals
  const lineups = await db('league_team_lineups')
    .where({ lid: league_id, week, year })
    .select('tid', 'baseline_total')

  // Load starter pids from league_team_lineup_starters
  const starters = await db('league_team_lineup_starters')
    .where({ lid: league_id, week, year })
    .select('tid', 'pid')

  // Group starters by team
  const starters_by_team = new Map()
  for (const row of starters) {
    if (!starters_by_team.has(row.tid)) {
      starters_by_team.set(row.tid, [])
    }
    starters_by_team.get(row.tid).push(row.pid)
  }

  // Combine lineups with starters
  const rosters = new Map()
  const teams_needing_fallback = []

  for (const row of lineups) {
    const player_ids = starters_by_team.get(row.tid) || []
    if (player_ids.length > 0) {
      rosters.set(row.tid, {
        player_ids,
        baseline_total: parseFloat(row.baseline_total) || 0
      })
    } else {
      teams_needing_fallback.push(row.tid)
    }
  }

  // Fallback: load from rosters_players for teams without lineup starters
  if (teams_needing_fallback.length > 0) {
    log(
      `Loading fallback rosters for ${teams_needing_fallback.length} teams from rosters_players`
    )

    const inactive_slots = [
      roster_slot_types.PS,
      roster_slot_types.PSP,
      roster_slot_types.PSD,
      roster_slot_types.PSDP,
      roster_slot_types.RESERVE_SHORT_TERM,
      roster_slot_types.RESERVE_LONG_TERM,
      roster_slot_types.COV
    ]

    const roster_players = await db('rosters_players')
      .where({ lid: league_id, week, year })
      .whereIn('tid', teams_needing_fallback)
      .whereNotIn('slot', inactive_slots)
      .select('tid', 'pid', 'slot')

    // Group by team and prioritize starters
    const players_by_team = new Map()
    for (const row of roster_players) {
      if (!players_by_team.has(row.tid)) {
        players_by_team.set(row.tid, [])
      }
      players_by_team.get(row.tid).push(row)
    }

    for (const tid of teams_needing_fallback) {
      const team_players = players_by_team.get(tid) || []
      const starters = team_players.filter((p) =>
        starting_lineup_slots.includes(p.slot)
      )
      const player_ids =
        starters.length > 0
          ? starters.map((p) => p.pid)
          : team_players.map((p) => p.pid)

      rosters.set(tid, {
        player_ids,
        baseline_total: 0
      })
    }
  }

  log(`Loaded rosters for ${rosters.size} teams`)
  return rosters
}

/**
 * Load all matchups for a league in a given week.
 *
 * @param {Object} params
 * @param {number} params.league_id - League ID
 * @param {number} params.week - NFL week
 * @param {number} params.year - NFL year
 * @returns {Promise<Object[]>} Array of { matchup_id, home_team_id, away_team_id }
 */
export async function load_league_matchups({ league_id, week, year }) {
  log(`Loading matchups for league ${league_id}, week ${week}`)

  const rows = await db('matchups')
    .where({ lid: league_id, week, year })
    .select('uid as matchup_id', 'hid as home_team_id', 'aid as away_team_id')

  log(`Loaded ${rows.length} matchups`)
  return rows
}

/**
 * Calculate matchup win/loss/tie counts from raw team scores.
 *
 * @param {Object} params
 * @param {number[]} params.home_scores - Array of scores for home team
 * @param {number[]} params.away_scores - Array of scores for away team
 * @param {number} params.n_simulations - Number of simulations
 * @returns {Object} { home_wins, away_wins, ties }
 */
export function calculate_matchup_outcomes({
  home_scores,
  away_scores,
  n_simulations
}) {
  let home_wins = 0
  let away_wins = 0
  let ties = 0

  for (let sim = 0; sim < n_simulations; sim++) {
    if (home_scores[sim] > away_scores[sim]) {
      home_wins++
    } else if (away_scores[sim] > home_scores[sim]) {
      away_wins++
    } else {
      ties++
    }
  }

  return { home_wins, away_wins, ties }
}

/**
 * Calculate score statistics from an array of scores.
 *
 * @param {number[]} scores - Array of scores
 * @returns {Object} { mean, std }
 */
export function calculate_score_stats(scores) {
  const n = scores.length
  if (n === 0) return { mean: 0, std: 0 }

  const mean = scores.reduce((sum, s) => sum + s, 0) / n
  const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / n

  return {
    mean,
    std: Math.sqrt(variance)
  }
}
