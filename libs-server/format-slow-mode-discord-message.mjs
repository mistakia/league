import db from '#db'
import { getTeam } from '#libs-server'

/**
 * Get player information for Discord messaging
 * @param {string} pid - Player ID
 * @returns {Promise<object|null>} Player object with name and position
 */
const get_player_info = async (pid) => {
  try {
    const players = await db('player')
      .select('pid', 'fname', 'lname', 'formatted', 'pos', 'pos1')
      .where({ pid })
      .limit(1)

    return players[0] || null
  } catch (error) {
    console.error('Error getting player info:', error)
    return null
  }
}

/**
 * Get team information for Discord messaging
 * @param {number} tid - Team ID
 * @returns {Promise<object|null>} Team object with name
 */
const get_team_info = async (tid) => {
  try {
    return await getTeam(tid)
  } catch (error) {
    console.error('Error getting team info:', error)
    return null
  }
}

/**
 * Format team list for Discord display
 * @param {number[]} team_ids - Array of team IDs
 * @returns {Promise<string>} Formatted team names string
 */
const format_team_list = async (team_ids) => {
  if (!team_ids || team_ids.length === 0) {
    return 'No teams'
  }

  try {
    const team_info_promises = team_ids.map((tid) => get_team_info(tid))
    const teams = await Promise.all(team_info_promises)

    const team_names = teams
      .filter((team) => team !== null)
      .map((team) => team.name || `Team ${team.uid}`)
      .join(', ')

    return team_names || 'Unknown teams'
  } catch (error) {
    console.error('Error formatting team list:', error)
    return 'Error loading teams'
  }
}

/**
 * Format player name for Discord display
 * @param {object} player - Player object from database
 * @returns {string} Formatted player name with position
 */
const format_player_display = (player) => {
  if (!player) {
    return 'Unknown Player'
  }

  const name = `${player.fname} ${player.lname}` || player.formatted
  const position = player.pos || player.pos1 || ''

  return position ? `${name} (${position})` : name
}

/**
 * Format nomination message for Discord
 * @param {string} team_id - Team ID that nominated the player
 * @param {string} player_id - Player ID
 * @param {number} bid_amount - Current bid amount
 * @param {number[]} eligible_teams - Array of eligible team IDs
 * @returns {Promise<string>} Formatted Discord message
 */
export const format_nomination_message = async ({
  team_id,
  player_id,
  bid_amount,
  eligible_teams
}) => {
  const player = await get_player_info(player_id)
  if (!player) {
    throw new Error(`Player not found: ${player_id}`)
  }

  const team = await get_team_info(team_id)
  if (!team) {
    throw new Error(`Team not found: ${team_id}`)
  }

  const player_display = format_player_display(player)
  const team_name = team.name || `Team ${team.uid}`
  const teams_display = await format_team_list(eligible_teams)

  return `${team_name} has nominated ${player_display} at $${bid_amount}. Eligible teams: ${teams_display}. Teams must pass or bid to continue.`
}

/**
 * Format nomination complete message for Discord
 * @param {string} pid - Player ID
 * @param {number} winning_bid - Final winning bid amount
 * @param {number} winning_team_id - Team ID that won the auction
 * @returns {Promise<string>} Formatted Discord message
 */
export const format_nomination_complete_message = async ({
  player_id,
  winning_bid_amount,
  winning_team_id
}) => {
  const player = await get_player_info(player_id)
  if (!player) {
    throw new Error(`Player not found: ${player_id}`)
  }

  const winning_team = await get_team_info(winning_team_id)
  if (!winning_team) {
    throw new Error(`Team not found: ${winning_team_id}`)
  }

  const team_name = winning_team.name
  const team_abbrv = winning_team.abbrv || ''

  return `${team_name}${team_abbrv ? ` (${team_abbrv})` : ''} has signed free agent ${player.fname} ${player.lname} (${player.pos}) for $${winning_bid_amount}.`
}

export default {
  format_nomination_message,
  format_nomination_complete_message
}
