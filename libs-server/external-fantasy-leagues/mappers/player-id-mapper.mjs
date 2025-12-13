import debug from 'debug'

import find_player_row from '#libs-server/find-player-row.mjs'
import update_player from '#libs-server/update-player.mjs'

const log = debug('external:player-mapper')

// Cache configuration
const CACHE_MAX_SIZE = 10000 // Maximum number of entries
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes TTL

/**
 * Cross-platform player ID mapping utility
 * Maps external platform player IDs to internal PIDs using the existing find_player_row system
 *
 * Features:
 * - Supports all platforms with database columns (sleeper_id, espn_id, yahoo_id, etc.)
 * - Fallback matching by name/position/team when direct ID match fails
 * - Automatic player record updates when fallback matches are found
 * - Caching for performance (10,000 entries, 30-minute TTL)
 * - Expired entries cleaned on access and periodically
 */
export default class PlayerIdMapper {
  constructor() {
    this.cache = new Map() // key -> { value, timestamp }
    this.platform_column_map = {
      sleeper: 'sleeper_id',
      espn: 'espn_id',
      yahoo: 'yahoo_id',
      mfl: 'mfl_id',
      cbs: 'cbs_id',
      ffpc: 'ffpc_id',
      nffc: 'nffc_id',
      fantrax: 'fantrax_id',
      fleaflicker: 'fleaflicker_id',
      nfl: 'nfl_id',
      rtsports: 'rtsports_id'
    }
  }

  /**
   * Map external platform player ID to internal player ID (PID)
   * @param {Object} params - Parameters object
   * @param {string} params.platform - Platform identifier (sleeper, espn, yahoo, mfl, etc.)
   * @param {string|number} params.external_player_id - Platform-specific player identifier
   * @param {Object} [params.fallback_data] - Optional player data for fallback matching:
   *   - name: Player name
   *   - position: Player position (QB, RB, WR, etc.)
   *   - team: NFL team abbreviation
   * @returns {Promise<string|null>} Internal player ID (PID) if found, null otherwise
   */
  async map_to_internal({ platform, external_player_id, fallback_data = {} }) {
    if (!external_player_id) {
      log('No external player ID provided')
      return null
    }

    const cache_key = `${platform}:${external_player_id}`

    // Check cache first (with TTL validation)
    const cached_entry = this.cache.get(cache_key)
    if (cached_entry) {
      const age = Date.now() - cached_entry.timestamp
      if (age < CACHE_TTL_MS) {
        log(`Cache hit for ${cache_key}`)
        return cached_entry.value
      }
      // Entry expired, remove it
      this.cache.delete(cache_key)
      log(`Cache expired for ${cache_key}`)
    }

    try {
      const column = this.platform_column_map[platform.toLowerCase()]
      if (!column) {
        log(`Unsupported platform: ${platform}`)
        return null
      }

      // Primary lookup using platform-specific ID
      const lookup_params = {
        [column]: external_player_id
      }

      let player_row = await find_player_row(lookup_params)

      // Fallback to name/position/team matching if no direct ID match
      if (!player_row && fallback_data.name) {
        log(
          `No direct ID match for ${platform}:${external_player_id}, trying fallback with name: ${fallback_data.name}`
        )

        const fallback_params = {
          name: fallback_data.name,
          pos: fallback_data.position,
          team: fallback_data.team,
          ignore_retired: true,
          ignore_free_agent: false
        }

        player_row = await find_player_row(fallback_params)

        // If we found a match via fallback, update the player record with the external ID
        if (player_row) {
          log(
            `Fallback match found for ${fallback_data.name}, updating ${column}`
          )
          await this.update_player_external_id({
            pid: player_row.pid,
            column,
            external_id: external_player_id
          })
        }
      }

      const result = player_row ? player_row.pid : null

      // Evict oldest entries if cache is full
      if (this.cache.size >= CACHE_MAX_SIZE) {
        this.evict_oldest_entries()
      }

      // Cache the result with timestamp (including null results to avoid repeated failed lookups)
      this.cache.set(cache_key, { value: result, timestamp: Date.now() })

      if (result) {
        log(`Mapped ${platform}:${external_player_id} to PID:${result}`)
      } else {
        log(`Could not map ${platform}:${external_player_id}`)
      }

      return result
    } catch (error) {
      log(`Error mapping ${platform}:${external_player_id}: ${error.message}`)
      return null
    }
  }

  /**
   * Bulk map multiple external player IDs to internal PIDs
   * @param {Object} params - Parameters object
   * @param {string} params.platform - Platform identifier
   * @param {Array<Object>} params.players - Array of player objects:
   *   - external_id: Platform-specific player ID
   *   - fallback_data: Optional player data for fallback matching
   * @returns {Promise<Map<string|number, string>>} Map of external_player_id -> internal_pid
   */
  async bulk_map_to_internal({ platform, players }) {
    const results = new Map()

    for (const player of players) {
      const pid = await this.map_to_internal({
        platform,
        external_player_id: player.external_id,
        fallback_data: player.fallback_data
      })
      results.set(player.external_id, pid)
    }

    return results
  }

  /**
   * Update player record with external platform ID
   * @param {Object} params - Parameters object
   * @param {string} params.pid - Internal player ID
   * @param {string} params.column - Database column name for the external ID
   * @param {string|number} params.external_id - External platform player ID
   * @private
   */
  async update_player_external_id({ pid, column, external_id }) {
    try {
      const update_data = { [column]: external_id }
      const changes = await update_player({
        pid,
        update: update_data,
        allow_protected_props: true
      })

      if (changes > 0) {
        log(`Updated player ${pid} with ${column}: ${external_id}`)
      } else {
        log(`No changes made to player ${pid} for ${column}: ${external_id}`)
      }
    } catch (error) {
      log(`Error updating player ${pid} with ${column}: ${error.message}`)
    }
  }

  /**
   * Get all supported platforms
   * @returns {Array<string>} Array of supported platform identifiers
   */
  get_supported_platforms() {
    return Object.keys(this.platform_column_map)
  }

  /**
   * Check if a platform is supported
   * @param {Object} params - Parameters object
   * @param {string} params.platform - Platform identifier
   * @returns {boolean} True if platform is supported
   */
  is_platform_supported({ platform }) {
    return platform.toLowerCase() in this.platform_column_map
  }

  /**
   * Clear the mapping cache
   */
  clear_cache() {
    this.cache.clear()
    log('Cache cleared')
  }

  /**
   * Evict oldest entries to make room for new ones
   * Removes 10% of entries (oldest first) when cache is full
   * @private
   */
  evict_oldest_entries() {
    const entries_to_remove = Math.ceil(CACHE_MAX_SIZE * 0.1) // Remove 10%

    // Sort entries by timestamp (oldest first)
    const sorted_entries = [...this.cache.entries()].sort(
      (a, b) => a[1].timestamp - b[1].timestamp
    )

    // Remove oldest entries
    for (let i = 0; i < entries_to_remove && i < sorted_entries.length; i++) {
      this.cache.delete(sorted_entries[i][0])
    }

    log(`Evicted ${entries_to_remove} oldest cache entries`)
  }

  /**
   * Remove expired entries from cache
   * @returns {number} Number of entries removed
   */
  clean_expired_entries() {
    const now = Date.now()
    let removed = 0

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp >= CACHE_TTL_MS) {
        this.cache.delete(key)
        removed++
      }
    }

    if (removed > 0) {
      log(`Cleaned ${removed} expired cache entries`)
    }
    return removed
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  get_cache_stats() {
    const now = Date.now()
    let expired_count = 0
    let oldest_age_ms = 0

    for (const [, entry] of this.cache.entries()) {
      const age = now - entry.timestamp
      if (age >= CACHE_TTL_MS) {
        expired_count++
      }
      if (age > oldest_age_ms) {
        oldest_age_ms = age
      }
    }

    return {
      size: this.cache.size,
      max_size: CACHE_MAX_SIZE,
      ttl_ms: CACHE_TTL_MS,
      expired_count,
      oldest_age_ms,
      platforms: [
        ...new Set([...this.cache.keys()].map((key) => key.split(':')[0]))
      ]
    }
  }
}
