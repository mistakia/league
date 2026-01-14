import BaseAdapter from './base-adapter.mjs'
import AuthenticatedApiClient from '../utils/authenticated-api-client.mjs'
import { schema_validator } from '../utils/schema-validator.mjs'
import { platform_authenticator } from '../utils/platform-authenticator.mjs'
import { format_nfl_status, format_nfl_injury_status } from '#libs-shared'
import { player_nfl_status, current_season } from '#constants'

/**
 * Sleeper Fantasy Football adapter
 * Implements the BaseAdapter interface for Sleeper league import and sync
 * Uses ffscrapr-compatible authentication patterns
 */
export default class SleeperAdapter extends BaseAdapter {
  constructor(config = {}) {
    super(config)

    this.api_client = new AuthenticatedApiClient({
      base_url: 'https://api.sleeper.app/v1',
      requests_per_minute: 1000,
      requests_per_second: 30,
      window_ms: 2000,
      burst_limit: 100,
      auth_type: 'none',
      max_retries: 3,
      timeout: 30000,
      exponential_backoff: true,
      max_consecutive_failures: 5,
      circuit_breaker_timeout_ms: 60000
    })

    // Set no-auth authentication (Sleeper API is public)
    this.api_client.set_authentication({}, 'none')
    this.authenticated = true
    this.requires_authentication = false // Sleeper API is public
    this.supports_private_leagues = true // Public API can access both public and private leagues
  }

  /**
   * Authenticate with Sleeper using ffscrapr patterns (no auth required - API is public)
   * @param {Object} credentials - Not used for Sleeper
   * @returns {Promise<boolean>} Always returns true
   */
  async authenticate(credentials = {}) {
    try {
      const auth_result = await platform_authenticator.authenticate(
        'sleeper',
        credentials
      )

      if (auth_result.success) {
        this.api_client.set_authentication(
          auth_result.credentials,
          auth_result.auth_type
        )
        this.authenticated = true

        this.log(
          'info',
          'Sleeper authentication successful (no auth required)',
          {
            auth_type: auth_result.auth_type,
            public_leagues: auth_result.public_leagues,
            private_leagues: auth_result.private_leagues
          }
        )

        // Cache authentication result
        platform_authenticator.cache_auth('sleeper', auth_result)
        return true
      }

      throw new Error('Sleeper authentication failed unexpectedly')
    } catch (error) {
      this.log('error', 'Sleeper authentication error', {
        error: error.message
      })
      return false
    }
  }

  /**
   * Get user ID from username
   * @param {string} username - Sleeper username
   * @returns {Promise<string|null>} User ID or null if not found
   */
  async get_user_id(username) {
    try {
      const user = await this.api_client.get(`/user/${username}`)
      return user?.user_id || null
    } catch (error) {
      this.log('error', 'Failed to get user ID', {
        username,
        error: error.message
      })
      return null
    }
  }

  /**
   * Get user's leagues for a season
   * @param {Object} params - Parameters object
   * @param {string} params.user_id - Sleeper user ID
   * @param {number} [params.season] - NFL season year
   * @returns {Promise<Array>} Array of league objects
   */
  async get_user_leagues({ user_id, season = current_season.year }) {
    const leagues = await this.api_client.get(
      `/user/${user_id}/leagues/nfl/${season}`
    )
    return leagues.map((league) => ({
      external_id: league.league_id,
      name: league.name,
      platform: 'sleeper'
    }))
  }

  /**
   * Get league information in canonical format
   * @param {string} league_id - Sleeper league ID
   * @param {Object} [options={}] - Additional options (not currently used by Sleeper)
   * @returns {Promise<Object>} League configuration data in canonical format
   */
  async get_league(league_id, options = {}) {
    const [league_data, users] = await Promise.all([
      this.api_client.get(`/league/${league_id}`),
      this.api_client.get(`/league/${league_id}/users`)
    ])

    // Transform to standard league format
    const standard_league = {
      external_id: league_id,
      platform: 'SLEEPER',
      name: league_data.name,
      year: Number(league_data.season),
      settings: {
        num_teams: league_data.total_rosters,
        season_type: this.map_season_type(league_data.settings),
        playoff_teams: league_data.settings?.playoff_teams || 6,
        playoff_week_start: league_data.settings?.playoff_week_start || 15,
        regular_season_waiver_type: this.map_waiver_type(
          league_data.settings?.waiver_type
        ),
        trade_deadline: this.map_trade_deadline(
          league_data.settings?.trade_deadline
        ),
        playoff_bracket_type: 'SINGLE_ELIMINATION',
        playoff_reseeding_enabled: false,
        consolation_bracket_enabled: true,
        divisions_enabled: league_data.settings?.divisions > 0,
        division_count: league_data.settings?.divisions || 0,
        max_keepers: league_data.settings?.max_keepers || 0,
        keeper_deadline_week: league_data.settings?.keeper_deadline || null,
        draft_type: league_data.settings?.draft_type === 1 ? 'SNAKE' : 'LINEAR'
      },
      scoring_settings: this.map_scoring_settings_to_canonical(
        league_data.scoring_settings || {}
      ),
      roster_slots: this.map_roster_positions_to_canonical(
        league_data.roster_positions || []
      ),
      teams: users.map((user) => this.map_team_to_canonical(user, league_data)),

      // Additional metadata
      status: this.map_league_status(league_data.status),
      commissioner_id: users.find((u) => u.is_owner)?.user_id,
      created_at: league_data.created
        ? new Date(league_data.created).toISOString()
        : null,
      last_updated_at: new Date().toISOString(),

      // Store original platform data for reference
      platform_data: {
        league: league_data,
        users
      }
    }

    // Validate against standard league format schema
    const validation = await schema_validator.validate_league(standard_league)
    if (!validation.valid) {
      this.log('warn', 'Standard league format validation failed', {
        league_id,
        errors: validation.errors,
        data_summary: validation.data_summary
      })
    } else {
      this.log(
        'info',
        'League data successfully validated against canonical format',
        {
          league_id,
          team_count: standard_league.teams.length
        }
      )
    }

    return standard_league
  }

  /**
   * Get teams in a league
   * @param {string} league_id - Sleeper league ID
   * @returns {Promise<Array>} Array of team objects
   */
  async get_teams(league_id, options = {}) {
    const league_data = await this.get_league(league_id, options)
    return league_data.teams || []
  }

  /**
   * Get rosters for all teams in a league in canonical format
   * @param {Object} params - Parameters object
   * @param {string} params.league_id - Sleeper league ID
   * @param {number} [params.week] - Optional week number for historical data
   * @param {number} [params.year] - Optional year (not currently used by Sleeper API)
   * @returns {Promise<Array>} Array of roster objects in canonical format
   */
  async get_rosters({ league_id, week = null, year = null }) {
    // ffscrapr pattern: Sleeper does not support historical week rosters via API
    const endpoint = `/league/${league_id}/rosters`

    const rosters = await this.api_client.get(endpoint)

    const roster_data = rosters.map((roster) => {
      // Transform to standard roster format
      // Use owner_id as team_external_id to match league teams (which use user_id)
      const standard_roster = {
        external_roster_id: `${league_id}_${roster.roster_id}`,
        platform: 'SLEEPER',
        league_external_id: league_id,
        team_external_id:
          roster.owner_id?.toString() || roster.roster_id?.toString(),
        week:
          week ??
          (current_season.week > current_season.nflFinalWeek
            ? 0
            : current_season.week),
        year: current_season.year,
        roster_snapshot_date: new Date().toISOString(),

        // All players with their roster assignments
        players: (roster.players || []).map((player_id) => {
          const roster_slot_info = this.determine_roster_slot_info(
            player_id,
            roster
          )

          return {
            player_ids: {
              sleeper_id: player_id,
              espn_id: null,
              yahoo_id: null,
              mfl_id: null,
              cbs_id: null,
              fleaflicker_id: null,
              nfl_id: null,
              rts_id: null
            },
            roster_slot: roster_slot_info.slot,
            roster_slot_category: roster_slot_info.category,
            acquisition_date: null, // Sleeper doesn't provide acquisition dates in roster data
            acquisition_type: null,
            acquisition_cost: null,
            current_salary: null,
            contract_years_remaining: null,
            is_locked: false,
            keeper_eligible: true,
            protection_status: null,
            extension_count: 0,
            tag_type: 'NONE',
            tag_details: {},
            trade_block_status: 'AVAILABLE'
          }
        }),

        // Keeper designations (empty for Sleeper as they don't provide this in roster data)
        keeper_designations: [],

        // Practice squad and IR lists (using practice_squad terminology)
        practice_squad: (roster.taxi || []).map((player_id) => player_id),
        injured_reserve: (roster.reserve || []).map((player_id) => player_id),

        // Roster metadata
        roster_moves_remaining: roster.settings?.total_moves || null,
        trades_remaining: null, // Sleeper doesn't track individual trade limits
        total_salary_committed: null,
        available_salary_cap_space: null,
        roster_lock_status: 'UNLOCKED',
        auto_start_enabled: false,

        // Store original platform data for reference
        platform_data: roster
      }

      return standard_roster
    })

    // Validate each roster against canonical format
    const validated_rosters = []
    for (const roster of roster_data) {
      const validation = await schema_validator.validate_roster(roster)
      if (!validation.valid) {
        this.log('warn', 'Standard roster format validation failed', {
          team_id: roster.team_external_id,
          errors: validation.errors,
          data_summary: validation.data_summary
        })
      } else {
        this.log(
          'debug',
          'Roster data successfully validated against canonical format',
          {
            team_id: roster.team_external_id,
            player_count: roster.players.length
          }
        )
      }
      validated_rosters.push(roster)
    }

    return validated_rosters
  }

  /**
   * Get players available on the platform
   * @param {Object} [params] - Parameters object
   * @param {Object} [params.filters] - Optional filters for players
   * @returns {Promise<Array>} Array of player objects in canonical format
   */
  async get_players({ filters = {} } = {}) {
    const players = await this.api_client.get('/players/nfl')

    const player_list = Object.entries(players).map(
      ([player_id, player_data]) => {
        // Transform to standard player format
        const player_name =
          player_data.full_name ||
          `${player_data.first_name || ''} ${player_data.last_name || ''}`.trim() ||
          'Unknown'

        const standard_player = {
          // Required fields - all platform IDs (per schema expectations)
          player_ids: {
            sleeper_id: player_id,
            espn_id: player_data.espn_id || null,
            yahoo_id: player_data.yahoo_id || null,
            mfl_id: null, // Sleeper doesn't provide MFL IDs
            cbs_id: null, // Sleeper doesn't provide CBS IDs
            fleaflicker_id: null, // Sleeper doesn't provide Fleaflicker IDs
            nfl_id: null, // GSIS ID is string format, not NFL.com integer ID
            rts_id: null, // Sleeper doesn't provide RTS IDs
            rotowire_id: player_data.rotowire_id || null
          },
          platform: 'SLEEPER',
          player_name,

          // Basic identification
          first_name: player_data.first_name || null,
          last_name: player_data.last_name || null,

          // Position and team - use player position mapping for fantasy-relevant positions only
          position: this.map_player_position_to_canonical(player_data.position),
          positions: this.map_fantasy_positions_to_canonical(
            player_data.fantasy_positions || [player_data.position]
          ),
          team_abbreviation: player_data.team || null,
          jersey_number: player_data.number || null,

          // Status information
          roster_status: this.map_player_status_to_canonical(
            player_data.status
          ),
          game_designation: this.map_injury_status_to_canonical(
            player_data.injury_status
          ),

          // Physical attributes
          height: player_data.height || null,
          weight: this.parse_weight(player_data.weight),

          // Career information
          years_experience: player_data.years_exp || null,
          college: player_data.college || null,

          // Store original platform data for reference
          platform_data: player_data
        }

        return standard_player
      }
    )

    // Apply filters if provided
    let filtered_players = player_list
    if (filters.position) {
      filtered_players = filtered_players.filter(
        (p) =>
          p.position === filters.position ||
          p.fantasy_positions?.includes(filters.position)
      )
    }
    if (filters.team) {
      filtered_players = filtered_players.filter((p) => p.team === filters.team)
    }
    if (filters.status) {
      filtered_players = filtered_players.filter(
        (p) => p.status === filters.status
      )
    }

    // Validate each player against canonical format (sample validation on first 5 players to avoid performance issues)
    const sample_size = Math.min(5, filtered_players.length)
    for (let i = 0; i < sample_size; i++) {
      const player = filtered_players[i]
      const validation = await schema_validator.validate_player(player)
      if (!validation.valid) {
        this.log('warn', 'Standard player format validation failed (sample)', {
          player_id: player.external_id,
          player_name: player.name,
          errors: validation.errors,
          data_summary: validation.data_summary
        })
      }
    }

    this.log('info', 'Retrieved Sleeper players in canonical format', {
      total: player_list.length,
      filtered: filtered_players.length,
      filters,
      sample_validated: sample_size
    })

    return filtered_players
  }

  /**
   * Get transactions for a league in canonical format
   * @param {Object} params - Parameters object
   * @param {string} params.league_id - Sleeper league ID
   * @param {Object} [params.options={}] - Optional filters (week, transaction_type, team_id, etc.)
   * @param {number} [params.year] - Optional year (not currently used by Sleeper API)
   * @returns {Promise<Array>} Array of transaction objects in canonical format
   */
  async get_transactions({ league_id, options = {}, year = null }) {
    // ffscrapr references:
    // - /league/{league_id}/transactions/{week} requires week (current week usually)
    const week =
      options.week ??
      (current_season.week > current_season.nflFinalWeek
        ? 0
        : current_season.week)
    const transactions = await this.api_client.get(
      `/league/${league_id}/transactions/${week}`
    )

    const transaction_list = transactions.map((transaction) => {
      // Transform to standard transaction format
      const standard_transaction = {
        external_transaction_id: transaction.transaction_id,
        platform: 'SLEEPER',
        league_external_id: league_id,
        transaction_type: this.map_transaction_type_to_canonical(
          transaction.type
        ),
        transaction_date: transaction.created
          ? new Date(transaction.created).toISOString()
          : new Date().toISOString(),
        transaction_status: this.map_transaction_status_to_canonical(
          transaction.status
        ),

        // Timing information
        effective_date: transaction.status_updated
          ? new Date(transaction.status_updated).toISOString()
          : null,
        processing_date:
          transaction.status === 'complete' && transaction.status_updated
            ? new Date(transaction.status_updated).toISOString()
            : null,
        week: transaction.leg || week,
        year: current_season.year,

        // Teams involved (schema property name: involved_teams)
        involved_teams: this.extract_transaction_teams_standard(transaction),

        // Players involved (schema property name: player_moves)
        player_moves:
          this.map_transaction_players_to_schema_format(transaction),

        // Waiver-specific details
        waiver_details:
          transaction.type === 'waiver'
            ? {
                waiver_priority: transaction.settings?.waiver_priority || null,
                bid_amount: this.extract_waiver_bid(transaction),
                claim_date: transaction.created
                  ? new Date(transaction.created).toISOString()
                  : null,
                process_date: transaction.status_updated
                  ? new Date(transaction.status_updated).toISOString()
                  : null
              }
            : null,

        // Trade-specific details
        trade_details:
          transaction.type === 'trade'
            ? {
                trade_deadline_eligible: true, // Sleeper doesn't provide this
                trade_review_period: null,
                votes_for: null,
                votes_against: null,
                veto_threshold: null
              }
            : null,

        // Store original platform data for reference
        platform_data: transaction
      }

      return standard_transaction
    })

    // Validate each transaction against canonical format
    const validated_transactions = []
    for (const transaction of transaction_list) {
      const validation =
        await schema_validator.validate_transaction(transaction)
      if (!validation.valid) {
        this.log('warn', 'Standard transaction format validation failed', {
          transaction_id: transaction.external_transaction_id,
          type: transaction.transaction_type,
          errors: validation.errors,
          data_summary: validation.data_summary
        })
      } else {
        this.log(
          'debug',
          'Transaction data successfully validated against canonical format',
          {
            transaction_id: transaction.external_transaction_id,
            type: transaction.transaction_type,
            player_count: transaction.player_moves?.length || 0
          }
        )
      }
      validated_transactions.push(transaction)
    }

    // Apply additional filtering if specified
    let filtered_transactions = validated_transactions
    if (options.transaction_type) {
      filtered_transactions = filtered_transactions.filter(
        (t) => t.type === options.transaction_type
      )
    }
    if (options.team_id) {
      filtered_transactions = filtered_transactions.filter((t) =>
        t.teams.includes(options.team_id)
      )
    }

    return filtered_transactions
  }

  /**
   * Get matchups for a specific week
   * @param {Object} params - Parameters object
   * @param {string} params.league_id - Sleeper league ID
   * @param {number} params.week - Week number
   * @returns {Promise<Array>} Array of matchup objects
   */
  async get_matchups({ league_id, week }) {
    const matchups = await this.api_client.get(
      `/league/${league_id}/matchups/${week}`
    )

    // Group matchups by matchup_id to pair teams
    const matchup_pairs = {}
    matchups.forEach((team_matchup) => {
      const matchup_id = team_matchup.matchup_id
      if (!matchup_pairs[matchup_id]) {
        matchup_pairs[matchup_id] = []
      }
      matchup_pairs[matchup_id].push(team_matchup)
    })

    return Object.entries(matchup_pairs)
      .map(([matchup_id, teams]) => {
        if (teams.length === 2) {
          return {
            week,
            matchup_id: parseInt(matchup_id),
            team1_id: teams[0].roster_id?.toString(),
            team2_id: teams[1].roster_id?.toString(),
            team1_score: teams[0].points || 0,
            team2_score: teams[1].points || 0
          }
        }
        return null
      })
      .filter(Boolean)
  }

  /**
   * Get league scoring format/rules
   * @param {string} league_id - Sleeper league ID
   * @returns {Promise<Object>} Scoring format configuration
   */
  async get_scoring_format(league_id) {
    const league_data = await this.get_league(league_id)
    return league_data.settings.scoring_format
  }

  /**
   * Get draft results for a league
   * @param {string} league_id - Sleeper league ID
   * @returns {Promise<Array>} Array of draft pick objects
   */
  async get_draft_results(league_id) {
    const drafts = await this.api_client.get(`/league/${league_id}/drafts`)

    if (!drafts || drafts.length === 0) {
      return []
    }

    // Get the most recent draft (usually index 0)
    const draft_id = drafts[0].draft_id
    const picks = await this.api_client.get(`/draft/${draft_id}/picks`)

    return picks.map((pick) => ({
      round: pick.round,
      pick: pick.draft_slot,
      overall_pick: pick.pick_no,
      team_id: pick.roster_id?.toString(),
      player_id: pick.player_id,
      keeper_status: pick.is_keeper || false,
      draft_id
    }))
  }

  /**
   * Map external player ID to internal PID
   * @param {string} external_player_id - Sleeper player ID
   * @returns {Promise<string|null>} Internal player ID or null if not found
   */
  async map_player_to_internal(external_player_id) {
    this.log('info', 'Player ID mapping not yet implemented', {
      external_player_id
    })

    // TODO: Query database for player with sleeper_id = external_player_id
    // Example query: SELECT pid FROM player WHERE sleeper_id = ?

    return null
  }

  // Helper methods for data transformation

  map_league_status(sleeper_status) {
    const status_map = {
      pre_draft: 'pre_draft',
      drafting: 'drafting',
      in_season: 'in_season',
      complete: 'complete'
    }
    return status_map[sleeper_status] || 'unknown'
  }

  // Legacy helper methods - kept for backward compatibility but replaced by canonical format methods above

  determine_roster_slot(player_id, roster) {
    if (roster.starters?.includes(player_id)) return 'starter'
    if (roster.reserve?.includes(player_id)) return 'ir'
    if (roster.taxi?.includes(player_id)) return 'practice_squad' // Updated terminology
    return 'bench'
  }

  /**
   * Determine roster slot and category for canonical format
   * @param {string} player_id - Sleeper player ID
   * @param {Object} roster - Sleeper roster object
   * @returns {Object} Slot info with slot and category
   */
  determine_roster_slot_info(player_id, roster) {
    if (roster.starters?.includes(player_id)) {
      return {
        slot: null, // Starting slots would need position mapping from league settings
        category: 'STARTING'
      }
    }
    if (roster.reserve?.includes(player_id)) {
      return {
        slot: 'IR',
        category: 'INJURED_RESERVE'
      }
    }
    if (roster.taxi?.includes(player_id)) {
      return {
        slot: 'PRACTICE_SQUAD',
        category: 'PRACTICE_SQUAD'
      }
    }
    return {
      slot: 'BENCH',
      category: 'BENCH'
    }
  }

  get_bench_players(roster) {
    const all_players = roster.players || []
    const starters = roster.starters || []
    const ir = roster.reserve || []
    const practice_squad = roster.taxi || [] // Updated terminology

    return all_players.filter(
      (player_id) =>
        !starters.includes(player_id) &&
        !ir.includes(player_id) &&
        !practice_squad.includes(player_id)
    )
  }

  // Legacy transaction mapping methods replaced by canonical format methods above

  /**
   * Map Sleeper season type to canonical format
   * @param {Object} settings - Sleeper league settings
   * @returns {string} Standard season type
   */
  map_season_type(settings = {}) {
    if (settings.type === 1) return 'DYNASTY'
    if (settings.keeper_deadline) return 'KEEPER'
    if (settings.best_ball === 1) return 'BEST_BALL'
    return 'REDRAFT'
  }

  /**
   * Parse weight from string to integer
   * @param {string|number} weight - Weight value (may be string like "250" or integer)
   * @returns {number|null} Parsed weight as integer or null
   */
  parse_weight(weight) {
    if (weight === null || weight === undefined) return null
    const parsed = parseInt(weight, 10)
    return isNaN(parsed) ? null : parsed
  }

  /**
   * Map Sleeper player position to canonical format (for primary position)
   * Only returns positions in the standard schema enum, others return null
   * Standard schema enum: QB, RB, WR, TE, K, DST, DE, DT, OLB, MLB, CB, FS, SS, DL, LB, DB
   * @param {string} sleeper_position - Sleeper position code
   * @returns {string|null} Standard position or null if not fantasy-relevant
   */
  map_player_position_to_canonical(sleeper_position) {
    if (!sleeper_position) return null

    const valid_positions = {
      QB: 'QB',
      RB: 'RB',
      WR: 'WR',
      TE: 'TE',
      K: 'K',
      DEF: 'DST',
      DE: 'DE',
      DT: 'DT',
      OLB: 'OLB',
      MLB: 'MLB',
      CB: 'CB',
      FS: 'FS',
      SS: 'SS',
      DL: 'DL',
      LB: 'LB',
      DB: 'DB'
    }
    return valid_positions[sleeper_position] || null
  }

  /**
   * Map Sleeper fantasy positions array to canonical format
   * Filters out non-standard positions
   * @param {Array<string>} positions - Array of Sleeper positions
   * @returns {Array<string>} Array of standard positions (empty if none valid)
   */
  map_fantasy_positions_to_canonical(positions) {
    if (!positions || !Array.isArray(positions)) return []
    return positions
      .map((pos) => this.map_player_position_to_canonical(pos))
      .filter(Boolean)
  }

  /**
   * Map Sleeper trade deadline to canonical format
   * Standard schema: integer 1-18 or null (no deadline)
   * @param {number} deadline - Sleeper trade deadline week
   * @returns {number|null} Standard trade deadline
   */
  map_trade_deadline(deadline) {
    // Sleeper uses 99 to indicate no trade deadline
    // Standard schema accepts 1-18 or null for no deadline
    if (!deadline || deadline >= 99) {
      return null
    }
    // Clamp to valid range (1-18)
    return Math.min(Math.max(deadline, 1), 18)
  }

  /**
   * Map Sleeper waiver type to canonical format
   * Standard schema enum values: FAAB, PRIORITY, NONE
   * @param {number} waiver_type - Sleeper waiver type
   * @returns {string} Standard waiver type
   */
  map_waiver_type(waiver_type) {
    // Sleeper waiver types:
    // 0 = Reverse standings order (priority-based)
    // 1 = Rolling list/FAAB (FAAB bidding)
    // 2 = Continual rolling list (priority-based)
    const type_map = {
      0: 'PRIORITY', // Reverse standings = priority-based
      1: 'FAAB', // Rolling list/FAAB = FAAB bidding
      2: 'PRIORITY' // Continual rolling = priority-based
    }
    return type_map[waiver_type] || 'PRIORITY'
  }

  /**
   * Map Sleeper scoring settings to canonical format
   * @param {Object} scoring - Sleeper scoring settings
   * @returns {Object} Standard scoring settings
   */
  map_scoring_settings_to_canonical(scoring = {}) {
    return {
      passing_yards: scoring.pass_yd || 0,
      passing_touchdowns: scoring.pass_td || 0,
      passing_interceptions: scoring.pass_int || 0,
      passing_completions: scoring.pass_cmp || 0,
      passing_incompletions: scoring.pass_inc || 0,
      passing_attempts: scoring.pass_att || 0,
      passing_2pt_conversions: scoring.pass_2pt || 0,

      rushing_yards: scoring.rush_yd || 0,
      rushing_touchdowns: scoring.rush_td || 0,
      rushing_attempts: scoring.rush_att || 0,
      rushing_2pt_conversions: scoring.rush_2pt || 0,

      receiving_yards: scoring.rec_yd || 0,
      receiving_touchdowns: scoring.rec_td || 0,
      receptions: scoring.rec || 0,
      receiving_2pt_conversions: scoring.rec_2pt || 0,
      receiving_targets: scoring.rec_tgt || 0,

      fumbles: scoring.fum || 0,
      fumbles_lost: scoring.fum_lost || 0,

      // Defensive/ST scoring
      defensive_interceptions: scoring.def_int || 0,
      defensive_fumble_recoveries: scoring.def_fr || 0,
      defensive_touchdowns: scoring.def_td || 0,
      defensive_safeties: scoring.def_safe || 0,
      defensive_sacks: scoring.def_sack || 0,

      // Additional scoring
      bonus_rec_te: scoring.bonus_rec_te || 0,
      bonus_rush_yd_100: scoring.bonus_rush_yd_100 || 0,
      bonus_rec_yd_100: scoring.bonus_rec_yd_100 || 0,
      bonus_pass_yd_300: scoring.bonus_pass_yd_300 || 0
    }
  }

  /**
   * Map Sleeper roster positions to canonical format
   * Returns array of position strings as required by canonical-league-format schema
   * @param {Array<string>} positions - Sleeper roster positions array
   * @returns {Array<string>} Array of canonical position strings
   */
  map_roster_positions_to_canonical(positions = []) {
    // Map each position to canonical format, preserving order
    const mapped_positions = positions.map((pos) =>
      this.map_position_to_canonical(pos)
    )

    // If no roster positions were found, log error and return empty array
    // This will cause schema validation to fail, forcing the issue to be addressed
    if (mapped_positions.length === 0) {
      this.log(
        'error',
        'Sleeper API did not return roster positions. Cannot determine league roster structure.',
        {
          positions_provided: positions,
          message:
            'Roster slots are required for league validation. Please ensure the Sleeper API response includes roster_positions, or manually configure roster slots.'
        }
      )
      return []
    }

    return mapped_positions
  }

  /**
   * Map Sleeper position to canonical format
   * Standard schema enum values: QB, RB, WR, TE, RB_WR_FLEX, RB_WR_TE_FLEX, WR_TE_FLEX,
   * SUPERFLEX, K, DST, IDP_FLEX, DE, DT, OLB, MLB, CB, FS, SS, DL, LB, DB, BN, IR, PRACTICE_SQUAD
   * @param {string} sleeper_position - Sleeper position code
   * @returns {string} Standard position
   */
  map_position_to_canonical(sleeper_position) {
    const position_map = {
      QB: 'QB',
      RB: 'RB',
      WR: 'WR',
      TE: 'TE',
      FLEX: 'RB_WR_TE_FLEX', // Sleeper FLEX = RB/WR/TE
      REC_FLEX: 'WR_TE_FLEX', // WR/TE only flex
      SUPER_FLEX: 'SUPERFLEX', // Note: schema uses SUPERFLEX not SUPER_FLEX
      K: 'K',
      DEF: 'DST',
      DL: 'DL',
      LB: 'LB',
      DB: 'DB',
      DE: 'DE',
      DT: 'DT',
      OLB: 'OLB',
      MLB: 'MLB',
      CB: 'CB',
      FS: 'FS',
      SS: 'SS',
      IDP_FLEX: 'IDP_FLEX',
      BN: 'BENCH', // Map Sleeper's BN to canonical BENCH
      IR: 'IR',
      TAXI: 'PRACTICE_SQUAD' // Sleeper calls it taxi, standard uses practice_squad
    }
    return position_map[sleeper_position] || sleeper_position
  }

  /**
   * Map Sleeper user to standard team format
   * Required fields: external_team_id, owner_id, name (per canonical league format schema)
   * @param {Object} user - Sleeper user object
   * @param {Object} league_data - Sleeper league data
   * @returns {Object} Standard team format (canonical league format team definition)
   */
  map_team_to_canonical(user, league_data) {
    return {
      // Required schema fields (league format team definition)
      external_team_id: user.user_id, // Platform-specific unique identifier for the team
      owner_id: user.user_id, // Platform user ID of the team owner
      name: user.metadata?.team_name || user.display_name || user.username, // Team name

      // Optional fields
      avatar: user.avatar
        ? `https://sleepercdn.com/avatars/thumbs/${user.avatar}`
        : null,
      is_commissioner: user.is_owner || false,
      division: null, // Sleeper doesn't provide division info in user data
      draft_position: null,
      waiver_priority: null,
      waiver_budget: null,

      // Platform data for reference
      platform_data: user
    }
  }

  /**
   * Map Sleeper transaction type to canonical format
   * @param {string} sleeper_type - Sleeper transaction type
   * @returns {string} Standard transaction type
   */
  map_transaction_type_to_canonical(sleeper_type) {
    const type_map = {
      waiver: 'WAIVER_CLAIM',
      free_agent: 'FREE_AGENT_PICKUP',
      trade: 'TRADE'
    }
    return type_map[sleeper_type] || sleeper_type.toUpperCase()
  }

  /**
   * Map Sleeper transaction status to canonical format
   * @param {string} sleeper_status - Sleeper transaction status
   * @returns {string} Standard transaction status
   */
  map_transaction_status_to_canonical(sleeper_status) {
    const status_map = {
      complete: 'COMPLETED',
      failed: 'FAILED',
      null: 'PENDING'
    }
    return status_map[sleeper_status] || 'PENDING'
  }

  /**
   * Extract teams involved in a transaction
   * @param {Object} transaction - Sleeper transaction object
   * @returns {Array} Array of team IDs
   */
  extract_transaction_teams(transaction) {
    const teams = new Set()

    // Add teams from roster_ids if available
    if (transaction.roster_ids) {
      transaction.roster_ids.forEach((id) => teams.add(id.toString()))
    }

    // Add teams from adds/drops
    if (transaction.adds) {
      Object.values(transaction.adds).forEach((roster_id) => {
        if (roster_id) teams.add(roster_id.toString())
      })
    }
    if (transaction.drops) {
      Object.values(transaction.drops).forEach((roster_id) => {
        if (roster_id) teams.add(roster_id.toString())
      })
    }

    return Array.from(teams)
  }

  /**
   * Extract teams involved in a transaction - schema-compliant format
   * Returns array of objects with team_external_id and team_role per schema
   * @param {Object} transaction - Sleeper transaction object
   * @returns {Array} Array of team objects with team_external_id and team_role
   */
  extract_transaction_teams_standard(transaction) {
    const team_ids = this.extract_transaction_teams(transaction)

    return team_ids.map((team_id, index) => ({
      team_external_id: team_id,
      team_role: transaction.type === 'trade' ? 'SENDER' : 'BIDDER'
    }))
  }

  /**
   * Map transaction players to canonical format
   * @param {Object} transaction - Sleeper transaction object
   * @returns {Array} Array of player actions in canonical format
   */
  map_transaction_players_to_canonical(transaction) {
    const players = []

    // Added players
    if (transaction.adds) {
      Object.entries(transaction.adds).forEach(([player_id, roster_id]) => {
        players.push({
          player_external_id: player_id,
          action: 'ADDED',
          team_external_id: roster_id?.toString(),

          // Additional details
          waiver_bid: transaction.settings?.waiver_bid || null,
          trade_value: null // Sleeper doesn't provide trade values
        })
      })
    }

    // Dropped players
    if (transaction.drops) {
      Object.entries(transaction.drops).forEach(([player_id, roster_id]) => {
        players.push({
          player_external_id: player_id,
          action: 'DROPPED',
          team_external_id: roster_id?.toString(),

          // Additional details
          waiver_bid: null,
          trade_value: null
        })
      })
    }

    return players
  }

  /**
   * Map transaction players to schema-compliant player_moves format
   * @param {Object} transaction - Sleeper transaction object
   * @returns {Array} Array of player_move objects per schema
   */
  map_transaction_players_to_schema_format(transaction) {
    const player_moves = []

    // Added players - to_team is set, from_team is null (free agent/waiver pickup)
    if (transaction.adds) {
      Object.entries(transaction.adds).forEach(([player_id, roster_id]) => {
        // For adds, check if there's a corresponding drop from another team (trade)
        const is_trade = transaction.type === 'trade'
        const from_team =
          is_trade && transaction.drops
            ? Object.entries(transaction.drops).find(
                ([pid]) => pid === player_id
              )?.[1]
            : null

        player_moves.push({
          player_ids: {
            sleeper_id: player_id,
            espn_id: null,
            yahoo_id: null,
            mfl_id: null,
            cbs_id: null,
            fleaflicker_id: null,
            nfl_id: null,
            rts_id: null
          },
          from_team_external_id: from_team?.toString() || null,
          to_team_external_id: roster_id?.toString() || null,
          roster_slot: null, // Sleeper doesn't provide this in transaction data
          salary_impact: null
        })
      })
    }

    // Dropped players that aren't part of adds (pure drops)
    if (transaction.drops) {
      Object.entries(transaction.drops).forEach(([player_id, roster_id]) => {
        // Skip if this player was also added (already handled as a move)
        if (transaction.adds && player_id in transaction.adds) {
          return
        }

        player_moves.push({
          player_ids: {
            sleeper_id: player_id,
            espn_id: null,
            yahoo_id: null,
            mfl_id: null,
            cbs_id: null,
            fleaflicker_id: null,
            nfl_id: null,
            rts_id: null
          },
          from_team_external_id: roster_id?.toString() || null,
          to_team_external_id: null, // Dropped to free agents
          roster_slot: null,
          salary_impact: null
        })
      })
    }

    return player_moves
  }

  /**
   * Extract waiver bid amount from transaction
   * Sleeper stores waiver bid in multiple formats:
   * - settings.waiver_bid (single value)
   * - waiver_budget: [{ sender, receiver, amount }] (array of budget changes)
   * @param {Object} transaction - Sleeper transaction object
   * @returns {number|null} Waiver bid amount
   */
  extract_waiver_bid(transaction) {
    // First check settings.waiver_bid
    if (transaction.settings?.waiver_bid) {
      return transaction.settings.waiver_bid
    }

    // Check waiver_budget array format
    if (transaction.waiver_budget && Array.isArray(transaction.waiver_budget)) {
      const budget_entry = transaction.waiver_budget.find((b) => b.amount > 0)
      if (budget_entry) {
        return budget_entry.amount
      }
    }

    return null
  }

  /**
   * Extract trade partner team IDs
   * @param {Object} transaction - Sleeper transaction object
   * @returns {Array} Array of trade partner team IDs
   */
  extract_trade_partners(transaction) {
    if (transaction.type !== 'trade') return []

    const teams = this.extract_transaction_teams(transaction)
    return teams // For trades, all involved teams are partners
  }

  /**
   * Get the team ID that created/initiated the transaction
   * @param {Object} transaction - Sleeper transaction object
   * @returns {string|null} Creator team ID
   */
  get_transaction_creator_team(transaction) {
    // Sleeper provides creator user ID, need to map to roster/team ID
    if (
      transaction.creator &&
      transaction.roster_ids &&
      transaction.roster_ids.length > 0
    ) {
      return transaction.roster_ids[0]?.toString()
    }
    return null
  }

  /**
   * Map Sleeper player status to canonical format
   * @param {string} sleeper_status - Sleeper player status
   * @returns {string} Standard player status
   */
  map_player_status_to_canonical(sleeper_status) {
    try {
      return format_nfl_status(sleeper_status)
    } catch (error) {
      this.log(
        'warn',
        'Failed to format player status, using ACTIVE as default',
        {
          sleeper_status,
          error: error.message
        }
      )
      return player_nfl_status.ACTIVE
    }
  }

  /**
   * Map Sleeper injury status to canonical format
   * @param {string} sleeper_injury_status - Sleeper injury status
   * @returns {string|null} Standard injury status
   */
  map_injury_status_to_canonical(sleeper_injury_status) {
    if (!sleeper_injury_status) return null

    try {
      return format_nfl_injury_status(sleeper_injury_status)
    } catch (error) {
      this.log('warn', 'Failed to format injury status, returning null', {
        sleeper_injury_status,
        error: error.message
      })
      return null
    }
  }
}
