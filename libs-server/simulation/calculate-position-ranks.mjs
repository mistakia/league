/**
 * Calculate position ranks for players within their NFL team.
 * Used to determine WR1/WR2/WR3, RB1/RB2, TE1 rankings for correlation defaults.
 */

import debug from 'debug'

import db from '#db'

const log = debug('simulation:calculate-position-ranks')

/**
 * Load position ranks for a set of players.
 * Ranks are calculated based on season-to-date stats within each NFL team.
 *
 * @param {Object} params
 * @param {string[]} params.player_ids - Array of player IDs
 * @param {number} params.year - NFL year
 * @param {number} params.week - Current NFL week (ranks through this week)
 * @returns {Promise<Map>} Map of pid -> position_rank (e.g., 'WR1', 'RB2', 'TE1')
 */
export async function load_position_ranks({ player_ids, year, week }) {
  if (!player_ids.length) {
    return new Map()
  }

  log(
    `Calculating position ranks for ${player_ids.length} players through week ${week}`
  )

  // Load player info (position, current team)
  const players = await db('player')
    .select('pid', 'pos', 'current_nfl_team')
    .whereIn('pid', player_ids)

  const player_teams = new Map()
  const player_positions = new Map()
  players.forEach((p) => {
    player_teams.set(p.pid, p.current_nfl_team)
    player_positions.set(p.pid, p.pos)
  })

  const position_ranks = new Map()

  // QB doesn't need positional ranking - only one starter per team
  for (const p of players) {
    if (p.pos === 'QB') {
      position_ranks.set(p.pid, 'QB')
    } else if (p.pos === 'K') {
      position_ranks.set(p.pid, 'K')
    } else if (p.pos === 'DST') {
      position_ranks.set(p.pid, 'DST')
    }
  }

  // Get WR/TE ranks by target share
  const wr_te_ranks = await calculate_target_share_ranks({
    player_ids: player_ids.filter((pid) => {
      const pos = player_positions.get(pid)
      return pos === 'WR' || pos === 'TE'
    }),
    year,
    week
  })

  wr_te_ranks.forEach((rank, pid) => position_ranks.set(pid, rank))

  // Get RB ranks by opportunity share
  const rb_ranks = await calculate_opportunity_share_ranks({
    player_ids: player_ids.filter((pid) => player_positions.get(pid) === 'RB'),
    year,
    week
  })

  rb_ranks.forEach((rank, pid) => position_ranks.set(pid, rank))

  log(`Calculated ranks for ${position_ranks.size} players`)
  return position_ranks
}

/**
 * Calculate WR/TE ranks by target share within team.
 */
async function calculate_target_share_ranks({ player_ids, year, week }) {
  if (!player_ids.length) {
    return new Map()
  }

  // Get season-to-date targets by player
  const gamelogs = await db('player_gamelogs')
    .join('nfl_games', 'player_gamelogs.esbid', 'nfl_games.esbid')
    .join('player', 'player_gamelogs.pid', 'player.pid')
    .whereIn('player_gamelogs.pid', player_ids)
    .where('nfl_games.year', year)
    .where('nfl_games.week', '<=', week)
    .whereIn('player.pos', ['WR', 'TE'])
    .select(
      'player_gamelogs.pid',
      'player.pos',
      'player.current_nfl_team',
      db.raw('SUM(player_gamelogs.trg) as total_targets')
    )
    .groupBy('player_gamelogs.pid', 'player.pos', 'player.current_nfl_team')

  // Group by team and position, then rank
  const team_position_players = new Map()

  for (const row of gamelogs) {
    const key = `${row.current_nfl_team}:${row.pos}`
    if (!team_position_players.has(key)) {
      team_position_players.set(key, [])
    }
    team_position_players.get(key).push({
      pid: row.pid,
      targets: parseInt(row.total_targets) || 0
    })
  }

  const position_ranks = new Map()

  for (const [key, players_list] of team_position_players) {
    const position = key.split(':')[1]

    // Sort by targets descending
    players_list.sort((a, b) => b.targets - a.targets)

    // Assign ranks
    players_list.forEach((p, index) => {
      const rank = index + 1
      if (position === 'WR') {
        if (rank === 1) position_ranks.set(p.pid, 'WR1')
        else if (rank === 2) position_ranks.set(p.pid, 'WR2')
        else position_ranks.set(p.pid, 'WR3')
      } else if (position === 'TE') {
        position_ranks.set(p.pid, 'TE1') // Only track TE1
      }
    })
  }

  // For players with no gamelogs, use default rank (batch query)
  const missing_pids = player_ids.filter((pid) => !position_ranks.has(pid))
  if (missing_pids.length > 0) {
    const missing_players = await db('player')
      .select('pid', 'pos')
      .whereIn('pid', missing_pids)

    for (const p of missing_players) {
      if (p.pos === 'WR') {
        position_ranks.set(p.pid, 'WR3')
      } else if (p.pos === 'TE') {
        position_ranks.set(p.pid, 'TE1')
      }
    }
  }

  return position_ranks
}

/**
 * Calculate RB ranks by opportunity share (carries + targets) within team.
 */
async function calculate_opportunity_share_ranks({ player_ids, year, week }) {
  if (!player_ids.length) {
    return new Map()
  }

  // Get season-to-date opportunities by player
  const gamelogs = await db('player_gamelogs')
    .join('nfl_games', 'player_gamelogs.esbid', 'nfl_games.esbid')
    .join('player', 'player_gamelogs.pid', 'player.pid')
    .whereIn('player_gamelogs.pid', player_ids)
    .where('nfl_games.year', year)
    .where('nfl_games.week', '<=', week)
    .where('player.pos', 'RB')
    .select(
      'player_gamelogs.pid',
      'player.current_nfl_team',
      db.raw(
        'SUM(player_gamelogs.ra + player_gamelogs.trg) as total_opportunities'
      )
    )
    .groupBy('player_gamelogs.pid', 'player.current_nfl_team')

  // Group by team, then rank
  const team_players = new Map()

  for (const row of gamelogs) {
    if (!team_players.has(row.current_nfl_team)) {
      team_players.set(row.current_nfl_team, [])
    }
    team_players.get(row.current_nfl_team).push({
      pid: row.pid,
      opportunities: parseInt(row.total_opportunities) || 0
    })
  }

  const position_ranks = new Map()

  for (const [, players_list] of team_players) {
    // Sort by opportunities descending
    players_list.sort((a, b) => b.opportunities - a.opportunities)

    // Assign ranks
    players_list.forEach((p, index) => {
      const rank = index + 1
      if (rank === 1) position_ranks.set(p.pid, 'RB1')
      else position_ranks.set(p.pid, 'RB2')
    })
  }

  // For players with no gamelogs, use default rank
  for (const pid of player_ids) {
    if (!position_ranks.has(pid)) {
      position_ranks.set(pid, 'RB2')
    }
  }

  return position_ranks
}

/**
 * Get position rank for a single player.
 *
 * @param {Object} params
 * @param {string} params.player_id - Player ID
 * @param {number} params.year - NFL year
 * @param {number} params.week - Current week
 * @returns {Promise<string>} Position rank (e.g., 'WR1', 'RB2')
 */
export async function get_position_rank({ player_id, year, week }) {
  const ranks = await load_position_ranks({
    player_ids: [player_id],
    year,
    week
  })
  return ranks.get(player_id) || 'UNKNOWN'
}
