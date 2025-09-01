import { redis_cache } from './redis_adapter.mjs'
import { constants } from '#libs-shared'

/**
 * Redis key structure for slow mode auction state
 *
 * Keys:
 * - auction_slow_mode:{year}:{lid}:{pid} - Main nomination state
 * - auction_slow_mode_passes:{year}:{lid}:{pid} - Set of team IDs that have passed
 * - auction_slow_mode_eligible:{year}:{lid}:{pid} - Set of eligible team IDs
 */

const REDIS_KEY_PREFIX = 'auction_slow_mode'

/**
 * Generate Redis key for nomination state
 * @param {number} lid - League ID
 * @param {string} pid - Player ID
 * @param {number} year - Season year (optional, defaults to current)
 * @returns {string} Redis key
 */
const get_nomination_key = (lid, pid, year = constants.season.year) =>
  `${REDIS_KEY_PREFIX}:${year}:${lid}:${pid}`

/**
 * Generate Redis key for team passes
 * @param {number} lid - League ID
 * @param {string} pid - Player ID
 * @param {number} year - Season year (optional, defaults to current)
 * @returns {string} Redis key
 */
const get_passes_key = (lid, pid, year = constants.season.year) =>
  `${REDIS_KEY_PREFIX}_passes:${year}:${lid}:${pid}`

/**
 * Generate Redis key for eligible teams
 * @param {number} lid - League ID
 * @param {string} pid - Player ID
 * @param {number} year - Season year (optional, defaults to current)
 * @returns {string} Redis key
 */
const get_eligible_key = (lid, pid, year = constants.season.year) =>
  `${REDIS_KEY_PREFIX}_eligible:${year}:${lid}:${pid}`

/**
 * Initialize slow mode nomination state in Redis
 * @param {number} lid - League ID
 * @param {string} pid - Player ID
 * @param {number} initial_bid - Initial bid amount
 * @param {number[]} eligible_teams - Array of eligible team IDs
 * @returns {Promise<boolean>} Success status
 */
export const initialize_slow_mode_nomination = async ({
  lid,
  pid,
  initial_bid,
  eligible_teams = [],
  nominating_team_id
}) => {
  try {
    if (!lid || !pid || initial_bid === undefined || !nominating_team_id) {
      throw new Error(
        'Missing required parameters: lid, pid, initial_bid, or nominating_team_id'
      )
    }

    const nomination_state = {
      lid,
      pid,
      current_bid: initial_bid,
      bid_team_id: nominating_team_id, // The nominating team is the initial bidder
      created_at: Date.now(),
      eligible_teams,
      passed_teams: [],
      completed: false
    }

    const nomination_key = get_nomination_key(lid, pid)
    const passes_key = get_passes_key(lid, pid)
    const eligible_key = get_eligible_key(lid, pid)

    // Store nomination state
    await redis_cache.set(nomination_key, nomination_state)

    // Initialize empty passes set and eligible teams set
    await redis_cache.set(passes_key, [])
    await redis_cache.set(eligible_key, eligible_teams)

    return true
  } catch (error) {
    console.error('Error initializing slow mode nomination:', error)
    return false
  }
}

/**
 * Record a team pass for the current nomination
 * @param {number} lid - League ID
 * @param {string} pid - Player ID
 * @param {number} tid - Team ID that is passing
 * @returns {Promise<boolean>} Success status
 */
export const record_team_pass = async (lid, pid, tid) => {
  try {
    if (!lid || !pid || !tid) {
      throw new Error('Missing required parameters: lid, pid, or tid')
    }

    const nomination_key = get_nomination_key(lid, pid)
    const passes_key = get_passes_key(lid, pid)

    // Get current nomination state
    const nomination_state = await redis_cache.get(nomination_key)
    if (!nomination_state) {
      throw new Error(
        `No active nomination found for league ${lid}, player ${pid}`
      )
    }

    // Get current passes
    const current_passes = (await redis_cache.get(passes_key)) || []

    // Check if team has already passed
    if (current_passes.includes(tid)) {
      return true // Already passed, no need to record again
    }

    // Add team to passes
    const updated_passes = [...current_passes, tid]

    // Update nomination state
    nomination_state.passed_teams = updated_passes
    nomination_state.updated_at = Date.now()

    // Save updated state
    await redis_cache.set(nomination_key, nomination_state)
    await redis_cache.set(passes_key, updated_passes)

    return true
  } catch (error) {
    console.error('Error recording team pass:', error)
    return false
  }
}

/**
 * Update current bid for the nomination and recalculate eligible teams
 * @param {number} lid - League ID
 * @param {string} pid - Player ID
 * @param {number} new_bid - New bid amount
 * @param {number} bidding_team_id - Team ID that placed the bid
 * @param {number[]} eligible_teams - Updated list of eligible team IDs
 * @returns {Promise<boolean>} Success status
 */
export const update_current_bid = async (
  lid,
  pid,
  new_bid,
  bidding_team_id,
  eligible_teams = []
) => {
  try {
    if (!lid || !pid || new_bid === undefined || !bidding_team_id) {
      throw new Error(
        'Missing required parameters: lid, pid, new_bid, or bidding_team_id'
      )
    }

    const nomination_key = get_nomination_key(lid, pid)
    const passes_key = get_passes_key(lid, pid)
    const eligible_key = get_eligible_key(lid, pid)

    // Get current nomination state
    const nomination_state = await redis_cache.get(nomination_key)
    if (!nomination_state) {
      throw new Error(
        `No active nomination found for league ${lid}, player ${pid}`
      )
    }

    // RESET all passes on new bid - each bid starts fresh pass tracking
    const updated_passes = []

    // Update nomination state
    nomination_state.current_bid = new_bid
    nomination_state.bid_team_id = bidding_team_id
    nomination_state.passed_teams = updated_passes
    nomination_state.eligible_teams = eligible_teams
    nomination_state.updated_at = Date.now()

    // Save updated state
    await redis_cache.set(nomination_key, nomination_state)
    await redis_cache.set(passes_key, updated_passes)
    await redis_cache.set(eligible_key, eligible_teams)

    return true
  } catch (error) {
    console.error('Error updating current bid:', error)
    return false
  }
}

/**
 * Check if nomination is complete (all eligible teams have passed OR no other teams eligible)
 * @param {number} lid - League ID
 * @param {string} pid - Player ID
 * @returns {Promise<{complete: boolean, reason?: string}>}
 */
export const check_nomination_complete = async ({ lid, pid }) => {
  try {
    if (!lid || !pid) {
      throw new Error('Missing required parameters: lid or pid')
    }

    const nomination_key = get_nomination_key(lid, pid)
    const eligible_key = get_eligible_key(lid, pid)
    const passes_key = get_passes_key(lid, pid)

    // Get current state
    const nomination_state = await redis_cache.get(nomination_key)
    const eligible_teams = (await redis_cache.get(eligible_key)) || []
    const passed_teams = (await redis_cache.get(passes_key)) || []

    if (!nomination_state) {
      return { complete: false }
    }

    // There should always be a bidding team after nomination
    const other_eligible = eligible_teams.filter(
      (tid) => tid !== nomination_state.bid_team_id
    )

    if (other_eligible.length === 0) {
      return { complete: true, reason: 'no_other_eligible_teams' }
    }

    // Check if all other eligible teams have passed
    const all_others_passed = other_eligible.every((tid) =>
      passed_teams.includes(tid)
    )
    if (all_others_passed) {
      return { complete: true, reason: 'all_others_passed' }
    }

    return { complete: false }
  } catch (error) {
    console.error('Error checking nomination completion:', error)
    return { complete: false }
  }
}

/**
 * Complete slow mode nomination and mark for cleanup
 * @param {number} lid - League ID
 * @param {string} pid - Player ID
 * @returns {Promise<object|null>} Final nomination state or null
 */
export const complete_slow_mode_nomination = async (lid, pid) => {
  try {
    if (!lid || !pid) {
      throw new Error('Missing required parameters: lid or pid')
    }

    const nomination_key = get_nomination_key(lid, pid)

    // Get final state
    const nomination_state = await redis_cache.get(nomination_key)
    if (!nomination_state) {
      return null
    }

    // Mark as completed
    nomination_state.completed = true
    nomination_state.completed_at = Date.now()

    // Save final state with shorter TTL (1 hour for debugging/auditing)
    await redis_cache.set(nomination_key, nomination_state, 3600)

    return nomination_state
  } catch (error) {
    console.error('Error completing slow mode nomination:', error)
    return null
  }
}

/**
 * Clear slow mode nomination state (cleanup)
 * @param {number} lid - League ID
 * @param {string} pid - Player ID
 * @returns {Promise<boolean>} Success status
 */
export const clear_slow_mode_nomination = async (lid, pid) => {
  try {
    if (!lid || !pid) {
      throw new Error('Missing required parameters: lid or pid')
    }

    const nomination_key = get_nomination_key(lid, pid)
    const eligible_key = get_eligible_key(lid, pid)
    const passes_key = get_passes_key(lid, pid)

    // Note: Redis cache doesn't have a delete method in the adapter
    // Instead, we set a very short TTL (1 second) to effectively delete
    await Promise.all([
      redis_cache.set(nomination_key, null, 1),
      redis_cache.set(eligible_key, null, 1),
      redis_cache.set(passes_key, null, 1)
    ])

    return true
  } catch (error) {
    console.error('Error clearing slow mode nomination:', error)
    return false
  }
}

/**
 * Get current slow mode nomination state including passes
 * @param {number} lid - League ID
 * @param {string} pid - Player ID
 * @param {number} year - Season year (optional, defaults to current)
 * @returns {Promise<object|null>} Nomination state with passes or null
 */
export const get_slow_mode_nomination_state = async ({
  lid,
  pid,
  year = constants.season.year
}) => {
  try {
    if (!lid || !pid) {
      throw new Error('Missing required parameters: lid or pid')
    }

    const nomination_key = get_nomination_key(lid, pid, year)
    const passes_key = get_passes_key(lid, pid, year)
    const eligible_key = get_eligible_key(lid, pid, year)

    // Get current state
    const nomination_state = await redis_cache.get(nomination_key)
    if (!nomination_state) {
      return null
    }

    // Get current passes and eligible teams
    const passed_teams = (await redis_cache.get(passes_key)) || []
    const eligible_teams = (await redis_cache.get(eligible_key)) || []

    return {
      ...nomination_state,
      passed_teams,
      eligible_teams
    }
  } catch (error) {
    console.error('Error getting slow mode nomination state:', error)
    return null
  }
}

export default {
  initialize_slow_mode_nomination,
  record_team_pass,
  update_current_bid,
  check_nomination_complete,
  complete_slow_mode_nomination,
  clear_slow_mode_nomination,
  get_slow_mode_nomination_state
}
