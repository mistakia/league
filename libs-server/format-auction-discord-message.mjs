import dayjs from 'dayjs'
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
      .select(
        'pid',
        'first_name',
        'last_name',
        'formatted_name',
        'primary_position',
        'secondary_position'
      )
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
 * Format player name for Discord display
 * @param {object} player - Player object from database
 * @returns {string} Formatted player name with position
 */
const format_player_display = (player) => {
  if (!player) {
    return 'Unknown Player'
  }

  const name =
    `${player.first_name} ${player.last_name}` || player.formatted_name
  const position = player.primary_position || player.secondary_position || ''

  return position ? `${name} (${position})` : name
}

/**
 * Format a claim message for Discord.
 *
 * ANNOUNCES THE CLAIM AND NOTHING ELSE. Whom the auction is still waiting on
 * is the client's surface -- `AUCTION_SETTLEMENT_STATUS` carries the
 * outstanding team ids and the settlement-status component renders them -- so
 * this names only who claimed the player and at what amount.
 *
 * @param {string} team_id - Team ID that nominated or bid on the player
 * @param {string} player_id - Player ID
 * @param {number} bid_amount - The claimed amount
 * @param {boolean} is_nomination - Whether the message is for a nomination or a bid
 * @returns {Promise<string>} Formatted Discord message
 */
export const format_nomination_message = async ({
  team_id,
  player_id,
  bid_amount,
  is_nomination
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
  const team_name = team.name || `Team ${team.team_id}`

  return `${team_name} has ${is_nomination ? 'nominated' : 'bid on'} ${player_display} at $${bid_amount}.`
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
  const team_abbrv = winning_team.abbreviation || ''

  return `${team_name}${team_abbrv ? ` (${team_abbrv})` : ''} has signed free agent ${player.first_name} ${player.last_name} (${player.primary_position}) for $${winning_bid_amount}.`
}

/**
 * Format the announcement for a live block that has just convened.
 *
 * A BLOCK IS FINALIZED AND ANNOUNCED, and the announcement is not decoration.
 * Every other event in this design waits for a manager who is paying attention;
 * a block is the one that requires them to SHOW UP, at an instant the league
 * agreed to but nobody chose. With no clock in election mode, being told is a
 * manager's only prompt to act.
 *
 * It names the duration rather than the end instant, because a merged run of
 * consecutive slots is what the league actually opted into and "45 minutes" is
 * the fact a manager plans around.
 */
export const format_block_convened_message = async ({
  block_at,
  end_at,
  eligible_team_count,
  is_extension = false
}) => {
  // `toUTCString` rather than a dayjs format: this league's managers sit in
  // London, Eastern and Pacific, so the instant has to carry its zone, and
  // dayjs's `.utc()` needs a plugin nothing in this module loads -- calling it
  // unextended is a TypeError inside a notification that must never take the
  // block down with it.
  const minutes = dayjs(end_at).diff(dayjs(block_at), 'minute')
  const window = `${new Date(block_at).toUTCString()} for ${minutes} minutes`

  // AN EXTENSION IS NOT A SECOND BLOCK. Consecutive unanimous slots run as one
  // session, so announcing each one as a new convening would tell the league
  // three blocks are coming when one longer one is.
  if (is_extension) {
    return (
      `The live auction block has been EXTENDED and now runs ${window}. ` +
      `Consecutive slots the league opted into run as one session.`
    )
  }

  return (
    `A LIVE AUCTION BLOCK has convened: ${window}, on unanimous opt-in among ` +
    `the ${eligible_team_count} team(s) with an open roster spot. Bidding runs ` +
    `on the clock for that window, and standing maximum bids bid for anyone ` +
    `who cannot attend.`
  )
}

export default {
  format_nomination_message,
  format_nomination_complete_message,
  format_block_convened_message
}
