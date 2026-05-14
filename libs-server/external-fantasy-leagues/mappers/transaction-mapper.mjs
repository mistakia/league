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
    // Sleeper transactions nest player IDs in `adds`/`drops` dicts and may
    // include both sides in a single transaction (e.g. waiver claims that
    // also drop a player, trades that move multiple players). The mapper
    // fans these out into one internal row per moved player; the per-action
    // map below selects the internal type for each side independently.
    this.sleeper_action_mappings = {
      add: { add: transaction_types.ROSTER_ADD },
      drop: { drop: transaction_types.ROSTER_RELEASE },
      trade: {
        add: transaction_types.TRADE,
        drop: transaction_types.TRADE
      },
      waiver: {
        add: transaction_types.ROSTER_ADD,
        drop: transaction_types.ROSTER_RELEASE
      },
      waiver_add: { add: transaction_types.ROSTER_ADD },
      waiver_drop: { drop: transaction_types.ROSTER_RELEASE },
      free_agent: {
        add: transaction_types.ROSTER_ADD,
        drop: transaction_types.ROSTER_RELEASE
      },
      commissioner: {
        add: transaction_types.ROSTER_ADD,
        drop: transaction_types.ROSTER_RELEASE
      }
    }

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
   * @returns {Array<Object>} Mapped internal transaction rows (empty if skipped/invalid).
   *   A single external transaction may map to multiple internal rows
   *   (Sleeper trades and waiver claims fan out one row per moved player).
   */
  map_transaction({ platform, external_transaction, context }) {
    try {
      const platform_lower = platform.toLowerCase()
      if (!this.transaction_mappings[platform_lower]) {
        log(`No transaction mapping found for platform: ${platform}`)
        return []
      }

      const base = {
        lid: context.league_id,
        year: context.year || current_season.year,
        week: context.week || this.extract_week(external_transaction),
        timestamp: this.extract_timestamp(external_transaction)
      }

      const candidates =
        platform_lower === 'sleeper'
          ? this.build_sleeper_transactions({
              external_transaction,
              base,
              context
            })
          : this.build_legacy_single_transaction({
              platform: platform_lower,
              external_transaction,
              base,
              context
            })

      const valid = []
      for (const candidate of candidates) {
        if (this.validate_transaction(candidate)) {
          valid.push(candidate)
        } else {
          log(`Invalid transaction after mapping: ${JSON.stringify(candidate)}`)
        }
      }

      return valid
    } catch (error) {
      log(`Error mapping transaction for ${platform}: ${error.message}`)
      return []
    }
  }

  /**
   * Build internal transaction rows for a single Sleeper transaction.
   * Sleeper transactions encode player movement as `adds`/`drops` dicts
   * keyed by player_id with roster_id values, so one external transaction
   * yields one internal row per add and per drop entry. For trades, both
   * sides emit TRADE rows (tid = receiving roster for adds, tid =
   * relinquishing roster for drops).
   * @private
   */
  build_sleeper_transactions({ external_transaction, base, context }) {
    // Accept either the raw Sleeper transaction shape (as returned by
    // /league/{id}/transactions/{week} and the platform-response fixtures)
    // or the canonical adapter output (which preserves the original under
    // `platform_data`). Either form carries the `adds`/`drops` dicts the
    // fan-out depends on.
    const raw = external_transaction.platform_data || external_transaction

    const sleeper_type = this.extract_transaction_type({
      platform: 'sleeper',
      external_transaction: raw
    })
    const action_map = this.sleeper_action_mappings[sleeper_type]
    if (!action_map) {
      log(`Unknown Sleeper transaction type: ${sleeper_type}`)
      return []
    }

    const adds = raw.adds || {}
    const drops = raw.drops || {}

    const userid = raw.creator
      ? get_mapping_value(context.user_mappings, raw.creator) || raw.creator
      : undefined

    const waiver_bid =
      raw.settings?.waiver_bid ??
      (typeof raw.waiver_budget === 'number' ? raw.waiver_budget : undefined)

    const rows = []

    if (action_map.add !== undefined) {
      for (const [player_id, roster_id] of Object.entries(adds)) {
        const row = {
          ...base,
          type: action_map.add,
          pid:
            get_mapping_value(context.player_mappings, player_id) || player_id,
          tid: get_mapping_value(context.team_mappings, roster_id) || roster_id
        }
        if (userid !== undefined) row.userid = userid
        if (
          row.type === transaction_types.ROSTER_ADD &&
          waiver_bid !== undefined &&
          waiver_bid !== null
        ) {
          row.value = waiver_bid
        }
        rows.push(row)
      }
    }

    if (action_map.drop !== undefined) {
      for (const [player_id, roster_id] of Object.entries(drops)) {
        const row = {
          ...base,
          type: action_map.drop,
          pid:
            get_mapping_value(context.player_mappings, player_id) || player_id,
          tid: get_mapping_value(context.team_mappings, roster_id) || roster_id
        }
        if (userid !== undefined) row.userid = userid
        rows.push(row)
      }
    }

    return rows
  }

  /**
   * Legacy single-row mapping path for ESPN/Yahoo/MFL and unknown platforms.
   * These adapters have not been validated against real fixtures yet; the
   * fan-out treatment is currently Sleeper-specific.
   * @private
   */
  build_legacy_single_transaction({
    platform,
    external_transaction,
    base,
    context
  }) {
    const mapping = this.transaction_mappings[platform]
    const external_type = this.extract_transaction_type({
      platform,
      external_transaction
    })
    const internal_type = mapping[external_type]

    if (internal_type === null) {
      log(
        `Skipping transaction type: ${external_type} for platform: ${platform}`
      )
      return []
    }

    if (internal_type === undefined) {
      log(
        `Unknown transaction type: ${external_type} for platform: ${platform}`
      )
      return []
    }

    const internal_transaction = {
      ...base,
      type: internal_type
    }

    this.map_platform_fields({
      platform,
      external_transaction,
      transaction: internal_transaction,
      context
    })

    return [internal_transaction]
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
      for (const row of mapped) {
        mapped_transactions.push(row)
      }
    }

    log(
      `Mapped ${mapped_transactions.length} internal rows from ${external_transactions.length} ${platform} transactions`
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
