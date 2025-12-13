import debug from 'debug'

import { transaction_types, current_season } from '#constants'

const log = debug('external:transaction-mapper')

/**
 * Helper to get value from Map or plain object mapping
 * Handles type coercion for numeric/string key lookups (e.g., "123" vs 123)
 * Used for mapping external platform IDs to internal IDs
 * @param {Map|Object} mapping - Map or plain object containing ID mappings
 * @param {string|number} key - External ID to look up
 * @returns {string|number|undefined} Internal ID if found, undefined otherwise
 */
const get_mapping_value = (mapping, key) => {
  if (!mapping) return undefined
  if (mapping instanceof Map) {
    // Try exact key first, then string/number coercion
    if (mapping.has(key)) return mapping.get(key)
    const string_key = String(key)
    if (mapping.has(string_key)) return mapping.get(string_key)
    return undefined
  }
  // For plain objects, try both key forms
  if (key in mapping) return mapping[key]
  const string_key = String(key)
  if (string_key in mapping) return mapping[string_key]
  return undefined
}

/**
 * Transaction mapper
 * Maps external platform transaction data to internal transaction format
 * Handles platform-specific transaction types, field names, and data structures
 */
export default class TransactionMapper {
  constructor() {
    // Platform-specific transaction type mappings
    this.transaction_mappings = {
      sleeper: {
        add: transaction_types.ROSTER_ADD,
        drop: transaction_types.ROSTER_RELEASE,
        trade: transaction_types.TRADE,
        waiver: transaction_types.ROSTER_ADD, // Waiver claims (may include adds and drops)
        waiver_add: transaction_types.ROSTER_ADD,
        waiver_drop: transaction_types.ROSTER_RELEASE,
        free_agent: transaction_types.ROSTER_ADD,
        commissioner: transaction_types.ROSTER_ADD // Commissioner moves
      },
      espn: {
        ROSTER_ADD: transaction_types.ROSTER_ADD,
        ROSTER_DROP: transaction_types.ROSTER_RELEASE,
        TRADE: transaction_types.TRADE,
        WAIVER_ADD: transaction_types.ROSTER_ADD,
        WAIVER_DROP: transaction_types.ROSTER_RELEASE,
        FA_ADD: transaction_types.ROSTER_ADD,
        FA_DROP: transaction_types.ROSTER_RELEASE,
        LINEUP: null, // Skip lineup changes
        DRAFT_ADD: transaction_types.ROSTER_ADD
      },
      yahoo: {
        add: transaction_types.ROSTER_ADD,
        drop: transaction_types.ROSTER_RELEASE,
        trade: transaction_types.TRADE,
        commish_move: transaction_types.ROSTER_ADD
      },
      mfl: {
        BBID_WAIVER: transaction_types.ROSTER_ADD,
        SURVIVOR_DROP: transaction_types.ROSTER_RELEASE,
        TRADE_ACCEPT: transaction_types.TRADE,
        FREE_AGENT: transaction_types.ROSTER_ADD,
        IR_MOVE: transaction_types.ROSTER_ACTIVATE,
        TAXI_MOVE: transaction_types.PRACTICE_ADD
      }
    }

    // Standard transaction fields
    this.required_fields = ['pid', 'type', 'timestamp', 'tid', 'lid']
    this.optional_fields = ['userid', 'value', 'week', 'year', 'waiverid']
  }

  /**
   * Map external platform transaction to internal transaction format
   * @param {Object} params - Parameters object
   * @param {string} params.platform - Platform identifier (sleeper, espn, yahoo, mfl)
   * @param {Object} params.external_transaction - External platform transaction data
   * @param {Object} params.context - Mapping context containing:
   *   - league_id: Internal league ID
   *   - year: Season year
   *   - week: NFL week number
   *   - player_mappings: Map of external_player_id -> internal_pid
   *   - team_mappings: Map of external_team_id -> internal_tid
   *   - user_mappings: Map of external_user_id -> internal_userid (optional)
   * @returns {Object|null} Mapped internal transaction object or null if skipped/invalid
   */
  map_transaction({ platform, external_transaction, context }) {
    try {
      const mapping = this.transaction_mappings[platform.toLowerCase()]
      if (!mapping) {
        log(`No transaction mapping found for platform: ${platform}`)
        return null
      }

      // Map transaction type
      const external_type = this.extract_transaction_type({
        platform,
        external_transaction
      })
      const internal_type = mapping[external_type]

      if (internal_type === null) {
        log(
          `Skipping transaction type: ${external_type} for platform: ${platform}`
        )
        return null
      }

      if (internal_type === undefined) {
        log(
          `Unknown transaction type: ${external_type} for platform: ${platform}`
        )
        return null
      }

      // Build internal transaction object
      const internal_transaction = {
        type: internal_type,
        lid: context.league_id,
        year: context.year || current_season.year,
        week: context.week || this.extract_week(external_transaction),
        timestamp: this.extract_timestamp(external_transaction)
      }

      // Map platform-specific fields (pid, tid, value, userid, etc.)
      this.map_platform_fields({
        platform,
        external_transaction,
        transaction: internal_transaction,
        context
      })

      // Validate required fields are present
      if (!this.validate_transaction(internal_transaction)) {
        log(
          `Invalid transaction after mapping: ${JSON.stringify(internal_transaction)}`
        )
        return null
      }

      log(`Mapped ${platform} transaction: ${external_type} → ${internal_type}`)
      return internal_transaction
    } catch (error) {
      log(`Error mapping transaction for ${platform}: ${error.message}`)
      return null
    }
  }

  /**
   * Extract transaction type from external transaction
   * @param {Object} params - Parameters object
   * @param {string} params.platform - Platform identifier
   * @param {Object} params.external_transaction - External transaction data
   * @returns {string} Transaction type
   * @private
   */
  extract_transaction_type({ platform, external_transaction }) {
    switch (platform.toLowerCase()) {
      case 'sleeper':
        return (
          external_transaction.type || external_transaction.transaction_type
        )

      case 'espn':
        return external_transaction.type || external_transaction.transactionType

      case 'yahoo':
        return (
          external_transaction.type || external_transaction.transaction_type
        )

      case 'mfl':
        return external_transaction.type || external_transaction.transaction

      default:
        return (
          external_transaction.type ||
          external_transaction.transaction_type ||
          'unknown'
        )
    }
  }

  /**
   * Extract Unix timestamp from external transaction
   * Handles various timestamp formats (milliseconds, seconds, ISO strings)
   * @param {Object} external_transaction - External transaction data
   * @returns {number} Unix timestamp in seconds
   * @private
   */
  extract_timestamp(external_transaction) {
    // Try various timestamp field names used by different platforms
    const timestamp_fields = [
      'timestamp',
      'created',
      'date',
      'transaction_date',
      'transactionDate',
      'time'
    ]

    for (const field of timestamp_fields) {
      if (
        external_transaction[field] !== undefined &&
        external_transaction[field] !== null
      ) {
        let ts = external_transaction[field]

        // Convert milliseconds to seconds if needed (timestamp > year 2286)
        if (typeof ts === 'number' && ts > 9999999999) {
          ts = Math.floor(ts / 1000)
        }

        // Convert date string to Unix timestamp
        if (typeof ts === 'string') {
          const parsed_date = new Date(ts)
          if (!isNaN(parsed_date.getTime())) {
            ts = Math.floor(parsed_date.getTime() / 1000)
          } else {
            continue // Invalid date string, try next field
          }
        }

        return ts
      }
    }

    // Fallback: use current timestamp if no valid timestamp found
    log('No timestamp found in transaction, using current time')
    return Math.floor(Date.now() / 1000)
  }

  /**
   * Extract NFL week number from external transaction
   * @param {Object} external_transaction - External transaction data
   * @returns {number} NFL week number (1-18, or 0 for offseason)
   * @private
   */
  extract_week(external_transaction) {
    // Prefer explicit week field if available
    if (
      external_transaction.week !== undefined &&
      external_transaction.week !== null
    ) {
      return external_transaction.week
    }

    // Fallback: could derive week from timestamp based on NFL season calendar
    // For now, use current season week as default
    // TODO: Implement week calculation from timestamp using NFL season dates
    return current_season.week
  }

  /**
   * Map platform-specific fields to internal transaction
   * Extracts and maps player IDs, team IDs, bid amounts, and user IDs
   * @param {Object} params - Parameters object
   * @param {string} params.platform - Platform identifier
   * @param {Object} params.external_transaction - External platform transaction data
   * @param {Object} params.transaction - Internal transaction object being built (modified in place)
   * @param {Object} params.context - Mapping context with player_mappings, team_mappings, etc.
   * @private
   */
  map_platform_fields({
    platform,
    external_transaction,
    transaction,
    context
  }) {
    switch (platform.toLowerCase()) {
      case 'sleeper':
        this.map_sleeper_fields({ external_transaction, transaction, context })
        break

      case 'espn':
        this.map_espn_fields({ external_transaction, transaction, context })
        break

      case 'yahoo':
        this.map_yahoo_fields({ external_transaction, transaction, context })
        break

      case 'mfl':
        this.map_mfl_fields({ external_transaction, transaction, context })
        break

      default:
        this.map_generic_fields({ external_transaction, transaction, context })
    }
  }

  /**
   * Map Sleeper-specific transaction fields
   * @param {Object} params - Parameters object
   * @private
   */
  map_sleeper_fields({ external_transaction, transaction, context }) {
    // Map player ID
    if (external_transaction.player_id) {
      transaction.pid =
        get_mapping_value(
          context.player_mappings,
          external_transaction.player_id
        ) || external_transaction.player_id
    }

    // Map team ID
    if (external_transaction.roster_id) {
      transaction.tid =
        get_mapping_value(
          context.team_mappings,
          external_transaction.roster_id
        ) || external_transaction.roster_id
    }

    // Map bid amount for waivers
    if (external_transaction.waiver_budget) {
      transaction.value = external_transaction.waiver_budget
    }

    // Map creator (user who made the transaction)
    if (external_transaction.creator) {
      transaction.userid =
        get_mapping_value(
          context.user_mappings,
          external_transaction.creator
        ) || external_transaction.creator
    }
  }

  /**
   * Map ESPN-specific transaction fields
   * @param {Object} params - Parameters object
   * @private
   */
  map_espn_fields({ external_transaction, transaction, context }) {
    // ESPN transactions often have different structure
    if (external_transaction.playerId) {
      transaction.pid =
        get_mapping_value(
          context.player_mappings,
          external_transaction.playerId
        ) || external_transaction.playerId
    }

    if (external_transaction.teamId) {
      transaction.tid =
        get_mapping_value(context.team_mappings, external_transaction.teamId) ||
        external_transaction.teamId
    }

    if (external_transaction.bidAmount) {
      transaction.value = external_transaction.bidAmount
    }
  }

  /**
   * Map Yahoo-specific transaction fields
   * @param {Object} params - Parameters object
   * @private
   */
  map_yahoo_fields({ external_transaction, transaction, context }) {
    // Yahoo has their own field naming
    if (external_transaction.player_key) {
      transaction.pid =
        get_mapping_value(
          context.player_mappings,
          external_transaction.player_key
        ) || external_transaction.player_key
    }

    if (external_transaction.team_key) {
      transaction.tid =
        get_mapping_value(
          context.team_mappings,
          external_transaction.team_key
        ) || external_transaction.team_key
    }
  }

  /**
   * Map MyFantasyLeague-specific transaction fields
   * @param {Object} params - Parameters object
   * @private
   */
  map_mfl_fields({ external_transaction, transaction, context }) {
    // MFL uses different field names
    if (external_transaction.player) {
      transaction.pid =
        get_mapping_value(
          context.player_mappings,
          external_transaction.player
        ) || external_transaction.player
    }

    if (external_transaction.franchise) {
      transaction.tid =
        get_mapping_value(
          context.team_mappings,
          external_transaction.franchise
        ) || external_transaction.franchise
    }

    if (external_transaction.amount) {
      transaction.value = external_transaction.amount
    }
  }

  /**
   * Map generic transaction fields
   * @param {Object} params - Parameters object
   * @private
   */
  map_generic_fields({ external_transaction, transaction, context }) {
    // Generic field mapping for unknown platforms
    const player_id_fields = ['player_id', 'playerId', 'player', 'pid']
    const team_id_fields = ['team_id', 'teamId', 'roster_id', 'tid']
    const value_fields = ['value', 'amount', 'bid', 'bid_amount']

    for (const field of player_id_fields) {
      if (external_transaction[field]) {
        transaction.pid =
          get_mapping_value(
            context.player_mappings,
            external_transaction[field]
          ) || external_transaction[field]
        break
      }
    }

    for (const field of team_id_fields) {
      if (external_transaction[field]) {
        transaction.tid =
          get_mapping_value(
            context.team_mappings,
            external_transaction[field]
          ) || external_transaction[field]
        break
      }
    }

    for (const field of value_fields) {
      if (external_transaction[field]) {
        transaction.value = external_transaction[field]
        break
      }
    }
  }

  /**
   * Bulk map multiple external transactions to internal format
   * @param {Object} params - Parameters object
   * @param {string} params.platform - Platform identifier
   * @param {Array<Object>} params.external_transactions - Array of external platform transactions
   * @param {Object} params.context - Mapping context (same as map_transaction)
   * @returns {Array<Object>} Array of successfully mapped internal transactions (skipped ones excluded)
   */
  bulk_map_transactions({ platform, external_transactions, context }) {
    const mapped_transactions = []

    for (const external_transaction of external_transactions) {
      const mapped = this.map_transaction({
        platform,
        external_transaction,
        context
      })
      if (mapped) {
        mapped_transactions.push(mapped)
      }
    }

    log(
      `Mapped ${mapped_transactions.length} of ${external_transactions.length} transactions for ${platform}`
    )
    return mapped_transactions
  }

  /**
   * Validate mapped internal transaction has all required fields
   * @param {Object} transaction - Mapped internal transaction object
   * @returns {boolean} True if transaction is valid and complete
   */
  validate_transaction(transaction) {
    // Check required fields
    for (const field of this.required_fields) {
      if (transaction[field] === undefined || transaction[field] === null) {
        log(`Missing required field: ${field}`)
        return false
      }
    }

    // Validate timestamp is reasonable
    if (transaction.timestamp < 1000000000) {
      // Before 2001
      log(`Invalid timestamp: ${transaction.timestamp}`)
      return false
    }

    // Validate transaction type is valid
    const valid_types = Object.values(transaction_types)
    if (!valid_types.includes(transaction.type)) {
      log(`Invalid transaction type: ${transaction.type}`)
      return false
    }

    return true
  }

  /**
   * Get supported platforms
   * @returns {Array<string>} Array of supported platform identifiers
   */
  get_supported_platforms() {
    return Object.keys(this.transaction_mappings)
  }

  /**
   * Check if platform is supported
   * @param {Object} params - Parameters object
   * @param {string} params.platform - Platform identifier
   * @returns {boolean} True if platform is supported
   */
  is_platform_supported({ platform }) {
    return platform.toLowerCase() in this.transaction_mappings
  }
}
