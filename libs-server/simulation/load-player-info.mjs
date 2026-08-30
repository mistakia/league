// @ts-check
/**
 * Load player position and current team for simulation.
 */

import db from '#db'

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
