/**
 * Unified roster loading for simulations.
 *
 * This module provides a clean interface for loading team rosters:
 * - Current/past weeks: Uses actual roster slot assignments from rosters_players
 * - Future weeks: Computes optimal lineup from current roster pool using projections
 *
 * This replaces the previous approach that relied on pre-computed league_team_lineup_starters,
 * which was stale and didn't reflect actual roster decisions.
 */

import debug from 'debug'

import db from '#db'
import {
  starting_lineup_slots,
  active_roster_slots,
  current_season
} from '#constants'
import { optimizeStandingsLineup } from '#libs-shared'

import { load_player_projections } from './load-projection-data.mjs'
import { load_player_info } from './load-player-info.mjs'
import { load_simulation_context } from './simulation-helpers.mjs'

const log = debug('simulation:load-team-rosters')

/**
 * Read one team's counterfactual roster override.
 *
 * The collection is accepted either as a Map keyed by team_id or as a plain
 * object keyed by team_id, because a caller assembling one from JSON or from a
 * script argument cannot build a Map. An override present but empty on both
 * sides is treated as absent, so an "override" that changes nothing takes the
 * unmodified code path rather than a parallel one that happens to agree.
 *
 * @param {object} params
 * @param {Map<number, {add?: string[], remove?: string[]}> | Record<string|number, {add?: string[], remove?: string[]}> | null} [params.roster_overrides] - Overrides keyed by team_id
 * @param {number} params.team_id - Fantasy team ID
 * @returns {{add: string[], remove: string[]} | null} The team's override, or null
 */
const resolve_roster_override = ({ roster_overrides, team_id }) => {
  if (!roster_overrides) return null

  const override =
    roster_overrides instanceof Map
      ? (roster_overrides.get(team_id) ?? roster_overrides.get(String(team_id)))
      : roster_overrides[team_id]

  if (!override) return null

  const add = override.add || []
  const remove = override.remove || []

  if (!add.length && !remove.length) return null

  return { add, remove }
}

/**
 * Apply a roster override to a roster pool.
 *
 * Removals run before additions, and an addition already in the pool is not
 * duplicated -- a pid listed twice would be optimized twice into the same
 * lineup and scored twice into the team's total.
 *
 * @param {object} params
 * @param {string[]} params.roster_pids - The pool read from rosters_players
 * @param {{add: string[], remove: string[]} | null} params.override - Override to apply
 * @returns {string[]} The modified pool
 */
const apply_roster_override = ({ roster_pids, override }) => {
  if (!override) return roster_pids

  const removed = new Set(override.remove)
  const pool = roster_pids.filter((pid) => !removed.has(pid))

  for (const pid of override.add) {
    if (!pool.includes(pid)) pool.push(pid)
  }

  return pool
}

/**
 * Load starters for a single team.
 *
 * For current/past weeks: Returns actual starters from roster slot assignments.
 * For future weeks: Computes optimal lineup from current roster pool.
 *
 * @param {object} params
 * @param {number} params.league_id - League ID
 * @param {number} params.team_id - Fantasy team ID
 * @param {number} params.week - Target week to get starters for
 * @param {number} params.year - NFL year
 * @param {number} params.current_week - The actual current week (for determining actual vs optimal)
 * @param {string} params.scoring_format_id - Scoring format hash for projections
 * @param {object} params.league - League settings for optimizer constraints
 * @param {Map<number, {add?: string[], remove?: string[]}> | Record<string|number, {add?: string[], remove?: string[]}> | null} [params.roster_overrides] -
 *   Counterfactual roster changes keyed by team_id. Absent or empty is a strict
 *   no-op.
 * @param {number} [params.roster_week] - Week to read the roster POOL from.
 *   Defaults to the week the league itself considers current.
 * @returns {Promise<object>} { team_id, player_ids: string[] }
 */
export async function load_team_starters({
  league_id,
  team_id,
  week,
  year,
  current_week,
  scoring_format_id,
  league,
  roster_overrides = null,
  roster_week = current_season.fantasy_season_week
}) {
  // Validate current_week to prevent undefined comparison issues
  if (typeof current_week !== 'number' || current_week < 1) {
    throw new Error(
      `current_week must be a positive integer, got: ${current_week}`
    )
  }

  const override = resolve_roster_override({ roster_overrides, team_id })

  // An overridden team takes the optimal path whatever the week. The actual
  // path reads slot assignments recorded in rosters_players, which cannot
  // express a counterfactual: a player added by the override was never
  // assigned a slot and a player removed still holds one, so routing an
  // overridden team through it would ignore the override in silence and report
  // the unmodified forecast as the answer to the question that was asked.
  if (week <= current_week && !override) {
    // Current/past week: use actual roster slot assignments
    const player_ids = await load_actual_starters({
      league_id,
      team_id,
      week,
      year
    })
    return { team_id, player_ids }
  } else {
    // Future week: compute optimal from current roster pool.
    //
    // The POOL week and the TARGET week are different questions, and conflating
    // them read a stale roster for the whole preseason. `current_week` here is
    // `active_fantasy_week`, floored to 1 because the branch above refuses a
    // target week below 1 -- but that floor is about the week being projected,
    // not about which roster snapshot is live. In the preseason the live
    // snapshot is week 0, which is the week `get-roster.mjs` reads and
    // therefore the one the league's own cap, auction and poach paths act on;
    // week 1 is a snapshot written ahead of it. For league 1 in 2026 the two
    // disagreed by three players -- Jeanty, Nabers and Burden sat in a reserve
    // slot in the week 1 rows and on the active roster in week 0 -- so every
    // forecast optimized a lineup missing its best three players.
    //
    // `fantasy_season_week` rather than `week`: the two agree from the
    // preseason through the season, and it is what get-roster.mjs reads, so the
    // pool and the league's authoritative roster are the same row by
    // construction. `week` keeps counting past the season's end, where it would
    // name a roster week that was never written.
    const player_ids = await calculate_optimal_starters({
      league_id,
      team_id,
      roster_week,
      projection_week: week,
      year,
      scoring_format_id,
      league,
      override
    })
    return { team_id, player_ids }
  }
}

/**
 * Load starters for multiple teams in a single week.
 *
 * Returns an Array (not a Map) since the caller provides specific team_ids
 * and typically processes all results. Use load_all_teams_starters() if you
 * need a Map keyed by team_id for lookups.
 *
 * @param {object} params
 * @param {number} params.league_id - League ID
 * @param {number[]} params.team_ids - Array of fantasy team IDs
 * @param {number} params.week - Target week to get starters for
 * @param {number} params.year - NFL year
 * @param {number} [params.current_week] - Current week (defaults to current_season.week)
 * @returns {Promise<Array<{team_id: number, player_ids: string[]}>>} Array of team rosters
 */
export async function load_teams_starters({
  league_id,
  team_ids,
  week,
  year,
  current_week = current_season.week
}) {
  log(`Loading starters for ${team_ids.length} teams, week ${week}`)

  // Load league context for scoring format and optimizer constraints
  const { league, scoring_format_id } = await load_simulation_context({
    league_id,
    year
  })

  // Load all teams in parallel for better performance
  const all_results = await Promise.all(
    team_ids.map((team_id) =>
      load_team_starters({
        league_id,
        team_id,
        week,
        year,
        current_week,
        scoring_format_id,
        league
      })
    )
  )

  // Filter to teams with starters and log any missing
  const results = []
  for (const result of all_results) {
    if (result.player_ids.length > 0) {
      results.push(result)
    } else {
      log(`No starters found for team ${result.team_id}, week ${week}`)
    }
  }

  log(`Loaded starters for ${results.length} teams`)
  return results
}

/**
 * Load starters for all teams in a league for a single week.
 *
 * Returns a Map keyed by team_id for efficient lookups when processing
 * matchups. Use load_teams_starters() if you have specific team_ids and
 * want an Array result.
 *
 * @param {object} params
 * @param {number} params.league_id - League ID
 * @param {number} params.week - Target week
 * @param {number} params.year - NFL year
 * @param {number} [params.current_week] - Current week (defaults to current_season.week)
 * @param {Map<number, {add?: string[], remove?: string[]}> | Record<string|number, {add?: string[], remove?: string[]}> | null} [params.roster_overrides] -
 *   Counterfactual roster changes keyed by team_id. Absent or empty is a strict
 *   no-op.
 * @returns {Promise<Map<number, {player_ids: string[]}>>} Map of team_id -> roster
 */
export async function load_all_teams_starters({
  league_id,
  week,
  year,
  current_week = current_season.week,
  roster_overrides = null
}) {
  log(`Loading all team starters for league ${league_id}, week ${week}`)

  // Get all team IDs for the league
  const teams = await db('teams')
    .where({ lid: league_id, season_year: year })
    .select('team_id')

  const team_ids = teams.map((t) => t.team_id)

  // Load league context
  const { league, scoring_format_id } = await load_simulation_context({
    league_id,
    year
  })

  // Load all teams in parallel for better performance
  const all_results = await Promise.all(
    team_ids.map((team_id) =>
      load_team_starters({
        league_id,
        team_id,
        week,
        year,
        current_week,
        scoring_format_id,
        league,
        roster_overrides
      })
    )
  )

  // Build map from results, filtering out teams without starters
  const rosters = new Map()
  for (const result of all_results) {
    if (result.player_ids.length > 0) {
      rosters.set(result.team_id, { player_ids: result.player_ids })
    }
  }

  log(`Loaded starters for ${rosters.size} teams`)
  return rosters
}

/**
 * Load actual starters from roster slot assignments.
 * Used for current and past weeks where we have actual lineup data.
 *
 * @param {object} params
 * @param {number} params.league_id - League ID
 * @param {number} params.team_id - Fantasy team ID
 * @param {number} params.week - NFL week
 * @param {number} params.year - NFL year
 * @returns {Promise<string[]>} Array of player IDs in starting slots
 */
async function load_actual_starters({ league_id, team_id, week, year }) {
  const roster_players = await db('rosters_players')
    .where({
      lid: league_id,
      tid: team_id,
      week,
      season_year: year
    })
    .whereIn('slot', starting_lineup_slots)
    .select('pid')

  return roster_players.map((r) => r.pid)
}

/**
 * Calculate optimal starters for a future week.
 * Uses current roster pool with projections for the target week.
 *
 * @param {object} params
 * @param {number} params.league_id - League ID
 * @param {number} params.team_id - Fantasy team ID
 * @param {number} params.roster_week - Week to get roster pool from (usually current week)
 * @param {number} params.projection_week - Week to get projections for
 * @param {number} params.year - NFL year
 * @param {string} params.scoring_format_id - Scoring format hash
 * @param {object} params.league - League settings for optimizer
 * @param {{add: string[], remove: string[]} | null} [params.override] - Already
 *   resolved roster override for this team
 * @returns {Promise<string[]>} Array of optimal starter player IDs
 */
async function calculate_optimal_starters({
  league_id,
  team_id,
  roster_week,
  projection_week,
  year,
  scoring_format_id,
  league,
  override = null
}) {
  log(
    `Calculating optimal starters for team ${team_id}, roster week ${roster_week}, projection week ${projection_week}`
  )

  // Load active roster from roster_week
  const roster_players = await db('rosters_players')
    .where({
      lid: league_id,
      tid: team_id,
      week: roster_week,
      season_year: year
    })
    .whereIn('slot', active_roster_slots)
    .select('pid')

  // The override applies to the POOL, before anything is loaded for it, so an
  // added player flows through the projection and player-info loads below like
  // any other roster member and is optimized on a real projection rather than
  // a special-cased zero.
  const roster_pids = apply_roster_override({
    roster_pids: roster_players.map((r) => r.pid),
    override
  })

  if (roster_pids.length === 0) {
    log(`No roster players found for team ${team_id}, week ${roster_week}`)
    return []
  }

  if (override) {
    log(
      `Applied roster override for team ${team_id}: +${override.add.length} -${override.remove.length}, pool ${roster_pids.length}`
    )
  }

  // Load projections for target week and player info in parallel
  const [projections, player_info] = await Promise.all([
    load_player_projections({
      player_ids: roster_pids,
      week: projection_week,
      year,
      scoring_format_id
    }),
    load_player_info({ player_ids: roster_pids })
  ])

  // Build players for optimizer
  const players = []
  for (const pid of roster_pids) {
    const info = player_info.get(pid)
    const pos = info?.position

    if (!pos) {
      log(`No position found for player ${pid}, skipping`)
      continue
    }

    players.push({
      pid,
      pos,
      points: projections.get(pid) || 0
    })
  }

  if (players.length === 0) {
    log(`No valid players for optimization for team ${team_id}`)
    return []
  }

  // Run optimizer
  const result = optimizeStandingsLineup({ players, league })

  log(
    `Optimal lineup for team ${team_id}: ${result.starters.length} starters, ${result.total?.toFixed(1)} projected points`
  )

  return result.starters
}

/**
 * Load starters for multiple weeks (used by championship simulations).
 * Efficiently batches loading across weeks with parallel execution.
 *
 * Returns a Map keyed by week number, where each value is an Array of
 * team rosters for that week.
 *
 * @param {object} params
 * @param {number} params.league_id - League ID
 * @param {number[]} params.team_ids - Array of fantasy team IDs
 * @param {number[]} params.weeks - Array of weeks to load
 * @param {number} params.year - NFL year
 * @param {number} [params.current_week] - Current week (defaults to current_season.week)
 * @param {Map<number, {add?: string[], remove?: string[]}> | Record<string|number, {add?: string[], remove?: string[]}> | null} [params.roster_overrides] -
 *   Counterfactual roster changes keyed by team_id. Absent or empty is a strict
 *   no-op.
 * @returns {Promise<Map<number, Array<{team_id: number, player_ids: string[]}>>>} Map of week -> team rosters
 */
export async function load_teams_starters_by_week({
  league_id,
  team_ids,
  weeks,
  year,
  current_week = current_season.week,
  roster_overrides = null
}) {
  log(
    `Loading starters for ${team_ids.length} teams across ${weeks.length} weeks`
  )

  // Load league context once
  const { league, scoring_format_id } = await load_simulation_context({
    league_id,
    year
  })

  // Load all weeks in parallel, with teams parallelized within each week
  const week_results = await Promise.all(
    weeks.map(async (week) => {
      const all_results = await Promise.all(
        team_ids.map((team_id) =>
          load_team_starters({
            league_id,
            team_id,
            week,
            year,
            current_week,
            scoring_format_id,
            league,
            roster_overrides
          })
        )
      )

      // Filter to teams with starters
      const week_rosters = all_results.filter((r) => r.player_ids.length > 0)
      return { week, rosters: week_rosters }
    })
  )

  // Build map from results
  const rosters_by_week = new Map()
  for (const { week, rosters } of week_results) {
    rosters_by_week.set(week, rosters)
  }

  log(`Loaded starters across ${rosters_by_week.size} weeks`)
  return rosters_by_week
}
