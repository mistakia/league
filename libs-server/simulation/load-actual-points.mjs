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

  // Whether a week has been played is a property of the WEEK, not of any one
  // row in it, because the two writers in scripts/process-playoffs.mjs disagree
  // about what an unplayed week looks like. Seeding inserts rows with no
  // `points` key, which land NULL. Scoring sets points to 0 and accumulates per
  // starter, logging a warning and continuing on every gamelog miss — so a week
  // scored before its gamelogs load is written as a real 0 and passes the
  // whereNotNull above. Requiring some team to have scored above zero is what
  // separates the two; a per-team test instead would drop a team that really
  // scored zero and report a partial week.
  //
  // `points_manual` is the manual correction that overrides the computed score,
  // matched to the post-season standings in scripts/process-playoffs.mjs so the
  // forecast's actual-results winner cannot disagree with the recorded champion.
  const points_by_week = new Map()

  for (const entry of playoff_entries) {
    const points = entry.points_manual || entry.points

    if (!points_by_week.has(entry.week)) {
      points_by_week.set(entry.week, new Map())
    }
    points_by_week.get(entry.week).set(entry.tid, points)
  }

  const actual_points = new Map()

  for (const [week, week_points] of points_by_week) {
    const week_was_played = [...week_points.values()].some(
      (points) => points > 0
    )
    if (week_was_played) {
      actual_points.set(week, week_points)
    }
  }

  return {
    actual_points,
    weeks_with_results: [...actual_points.keys()].sort((a, b) => a - b)
  }
}
