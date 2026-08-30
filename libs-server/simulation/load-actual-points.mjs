// @ts-check
/**
 * Load recorded results for simulation — what actually happened, as opposed to
 * what is projected. Player points come from completed NFL games; playoff
 * points come from the fantasy postseason table.
 */

import debug from 'debug'

import db from '#db'

const log = debug('simulation:load-actual-points')

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
