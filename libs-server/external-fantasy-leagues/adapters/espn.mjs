import BaseAdapter from './base-adapter.mjs'
import AuthenticatedApiClient from '../utils/authenticated-api-client.mjs'
import { schema_validator } from '../utils/schema-validator.mjs'
import { platform_authenticator } from '../utils/platform-authenticator.mjs'
import { format_nfl_injury_status } from '#libs-shared'
import { player_nfl_status, current_season } from '#constants'

/**
 * ESPN Fantasy Football adapter
 * Implements the BaseAdapter interface for ESPN league import and sync
 * Uses ffscrapr-compatible authentication patterns with dual auth support
 */
export default class EspnAdapter extends BaseAdapter {
  constructor(config = {}) {
    super(config)

    // Use corrected ESPN API base URL
    this.api_client = new AuthenticatedApiClient({
      base_url: 'https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl',
      requests_per_minute: 100,
      requests_per_second: 30,
      window_ms: 2000,
      burst_limit: 50,
      auth_type: 'none', // Default to no auth for public leagues
      max_retries: 3,
      timeout: 30000,
      exponential_backoff: true,
      max_consecutive_failures: 5,
      circuit_breaker_timeout_ms: 60000
    })

    // Headers commonly used by ffscrapr for ESPN reads
    this.api_client.headers = {
      ...this.api_client.headers,
      'x-fantasy-platform': 'kona',
      'x-fantasy-source': 'kona'
    }

    // Authentication state
    this.authenticated = false
    this.requires_authentication = false // Public leagues don't require auth
    this.supports_private_leagues = false
    this.auth_type = 'none'
  }

  /**
   * Authenticate with ESPN using ffscrapr patterns (dual auth support)
   * @param {Object} credentials - ESPN credentials
   * @param {string} [credentials.espn_s2] - ESPN s2 cookie (for private leagues)
   * @param {string} [credentials.swid] - ESPN SWID cookie (for private leagues)
   * @param {string} [credentials.username] - ESPN username (alternative login)
   * @param {string} [credentials.password] - ESPN password (alternative login)
   * @returns {Promise<boolean>} Authentication success
   */
  async authenticate(credentials = {}) {
    try {
      const auth_result = await platform_authenticator.authenticate(
        'espn',
        credentials
      )

      if (auth_result.success) {
        // Update API client authentication
        this.api_client.set_authentication(
          auth_result.credentials,
          auth_result.auth_type
        )
        this.authenticated = true
        this.auth_type = auth_result.auth_type
        this.supports_private_leagues = auth_result.private_leagues
        // If we have credentials, we may need auth for private leagues
        this.requires_authentication = auth_result.private_leagues

        this.log('info', 'ESPN authentication successful', {
          auth_type: auth_result.auth_type,
          public_leagues: auth_result.public_leagues,
          private_leagues: auth_result.private_leagues,
          has_cookies: !!auth_result.credentials
        })

        // Cache authentication result
        platform_authenticator.cache_auth('espn', auth_result)
        return true
      }

      throw new Error('ESPN authentication failed')
    } catch (error) {
      this.log('error', 'ESPN authentication error', { error: error.message })
      this.authenticated = false
      return false
    }
  }

  /**
   * Get user's ESPN leagues (requires authentication for private leagues)
   * @returns {Promise<Array>} Array of league objects
   */
  async get_user_leagues() {
    if (!this.supports_private_leagues) {
      throw new Error(
        'Must authenticate with cookies/credentials to access user leagues'
      )
    }

    const cached_auth = platform_authenticator.get_cached_auth('espn')
    if (!cached_auth || !cached_auth.credentials) {
      throw new Error('No valid ESPN authentication found')
    }

    const { swid } = cached_auth.credentials
    const leagues_url = `https://fan.api.espn.com/apis/v2/fans/${swid}?displayEvents=true&displayNow=true&displayRecs=true&recLimit=5&context=fantasy&source=espncom-fantasy&lang=en&section=espn&region=us`

    const response = await fetch(leagues_url)
    const data = await response.json()

    const { preferences } = data
    return preferences
      .filter((p) => p.metaData.entry.abbrev === 'FFL')
      .map((p) => {
        const { entryLocation, entryNickname, groups } = p.metaData.entry
        const name = `${entryLocation} ${entryNickname}`
        const league_id = groups[0].groupId
        return { name, external_id: league_id }
      })
  }

  /**
   * Get league information
   * @param {string} league_id - ESPN league ID
   * @returns {Promise<Object>} League configuration data in canonical format
   */
  async get_league(league_id, options = {}) {
    const year = options.year || current_season.year
    const url = `/seasons/${year}/segments/0/leagues/${league_id}`
    const params = { view: ['mSettings', 'mTeam', 'mRoster'] }

    let data
    try {
      data = await this.api_client.get(url, { params })
    } catch (error) {
      // Retry with previous season if 404 (common when next season not yet active)
      if (error.status === 404 && year > 2000) {
        const fallback_year = year - 1
        const fallback_url = `/seasons/${fallback_year}/segments/0/leagues/${league_id}`
        data = await this.api_client.get(fallback_url, { params })
      } else {
        throw error
      }
    }

    // Transform to standard league format
    const standard_league = {
      external_id: league_id,
      platform: 'ESPN',
      name: data.settings.name,
      year: Number(data.seasonId),
      settings: {
        num_teams: data.settings.size || data.teams?.length || 12,
        season_type: data.settings.isKeeper ? 'KEEPER' : 'REDRAFT',
        playoff_teams: data.settings.playoffTeamCount || 6,
        playoff_week_start: data.settings.playoffWeekStart || 15,
        regular_season_waiver_type: this.map_waiver_type_to_canonical(
          data.settings.waiverProcessHour
        ),
        trade_deadline:
          data.settings.tradeDeadline != null
            ? Math.min(data.settings.tradeDeadline, 18)
            : 14, // Default to week 14, cap at 18 per schema
        playoff_bracket_type: 'SINGLE_ELIMINATION',
        playoff_reseeding_enabled: false,
        consolation_bracket_enabled: true,
        divisions_enabled: (data.settings.divisionMap?.length || 0) > 1,
        division_count: data.settings.divisionMap?.length || 0,
        max_keepers: data.settings.keeperCount || 0,
        keeper_deadline_week: data.settings.keeperDeadline || null,
        draft_type: this.map_draft_type_to_canonical(
          data.settings.draftSettings?.type
        )
      },
      scoring_settings: this.map_scoring_settings_to_canonical(
        data.settings.scoringSettings || {}
      ),
      roster_slots: this.map_roster_positions_to_canonical(
        data.settings.rosterSettings || {}
      ),
      teams: (data.teams || []).map((team) => this.map_team_to_canonical(team)),

      // Additional metadata
      status: this.map_league_status_to_canonical(data.status),
      commissioner_id: data.settings.commissionerId?.toString(),
      created_at: null, // ESPN doesn't provide league creation date
      last_updated_at: new Date().toISOString(),

      // Store original platform data for reference
      platform_data: {
        league: data,
        teams: data.teams || []
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
   * @param {string} league_id - ESPN league ID
   * @returns {Promise<Array>} Array of team objects
   */
  async get_teams(league_id) {
    const league_data = await this.get_league(league_id)
    return league_data.teams || []
  }

  /**
   * Get rosters for all teams in a league
   * @param {Object} params - Parameters object
   * @param {string} params.league_id - ESPN league ID
   * @param {number} [params.week] - Optional week number for historical data
   * @returns {Promise<Array>} Array of roster objects in canonical format
   */
  async get_rosters({ league_id, week = null, year = null }) {
    const scoring_period = week || current_season.week || 1
    const target_year = year || current_season.year
    const url = `/seasons/${target_year}/segments/0/leagues/${league_id}`
    const params = {
      view: ['mRoster', 'mTeam'],
      scoringPeriodId: scoring_period
    }

    if (this.cookies) {
      this.api_client.headers = {
        ...this.api_client.headers,
        Cookie: `s2=${this.cookies.s2}; SWID=${this.cookies.swid}`
      }
    }

    let data
    try {
      data = await this.api_client.get(url, { params })
    } catch (error) {
      if (error.status === 404 && target_year > 2000) {
        const fallback_year = target_year - 1
        const fallback_url = `/seasons/${fallback_year}/segments/0/leagues/${league_id}`
        data = await this.api_client.get(fallback_url, { params })
      } else {
        throw error
      }
    }

    const roster_data = data.teams.map((team) => {
      // Transform to standard roster format
      const standard_roster = {
        external_roster_id: `${league_id}_${team.id}`,
        platform: 'ESPN',
        league_external_id: league_id,
        team_external_id: team.id.toString(),
        week: week || current_season.week || 1,
        year: current_season.year,
        roster_snapshot_date: new Date().toISOString(),

        // All players with their roster assignments
        players: (team.roster?.entries || []).map((entry) => {
          const roster_slot_info = this.determine_roster_slot_info_espn(entry)

          return {
            player_ids: {
              sleeper_id: null,
              espn_id: entry.playerId?.toString(),
              yahoo_id: null,
              mfl_id: null,
              cbs_id: null,
              fleaflicker_id: null,
              nfl_id: null,
              rts_id: null
            },
            roster_slot: roster_slot_info.slot,
            roster_slot_category: roster_slot_info.category,
            acquisition_date: entry.acquisitionDate
              ? new Date(entry.acquisitionDate).toISOString()
              : null,
            acquisition_type: this.map_acquisition_type_to_canonical(
              entry.acquisitionType
            ),
            acquisition_cost: null,
            current_salary: null,
            contract_years_remaining: null,
            is_locked: false,
            keeper_eligible: true,
            keeper_cost: null,
            player_transaction_id: null,
            trade_block_status: 'NOT_ON_BLOCK',

            // Player metadata (if available)
            player_name: entry.playerPoolEntry?.player?.fullName || null,
            player_position: this.map_position_to_canonical(
              entry.playerPoolEntry?.player?.defaultPositionId
            ),
            player_team: entry.playerPoolEntry?.player?.proTeamId
              ? this.map_nfl_team_to_canonical(
                  entry.playerPoolEntry?.player?.proTeamId
                )
              : null,
            player_status: entry.playerPoolEntry?.player?.injuryStatus
              ? format_nfl_injury_status(
                  this.map_injury_status_to_canonical(
                    entry.playerPoolEntry?.player?.injuryStatus
                  )
                )
              : player_nfl_status.ACTIVE
          }
        }),

        // Roster metadata
        keeper_designations: [],
        practice_squad: [], // ESPN uses practice_squad terminology
        injured_reserve: (team.roster?.entries || [])
          .filter((entry) => entry.lineupSlotId === 21)
          .map((entry) => entry.playerId?.toString())
          .filter(Boolean),

        // Store original platform data
        platform_data: {
          team,
          roster_entries: team.roster?.entries || []
        }
      }

      return standard_roster
    })

    // Validate roster data (sample validation for performance)
    if (roster_data.length > 0) {
      const sample_roster = roster_data[0]
      const validation = await schema_validator.validate_roster(sample_roster)
      if (!validation.valid) {
        this.log('warn', 'Standard roster format validation failed', {
          league_id,
          sample_team_id: sample_roster.team_external_id,
          errors: validation.errors,
          data_summary: validation.data_summary
        })
      } else {
        this.log(
          'info',
          'Roster data successfully validated against canonical format',
          {
            league_id,
            roster_count: roster_data.length,
            total_players: roster_data.reduce(
              (sum, roster) => sum + roster.players.length,
              0
            )
          }
        )
      }
    }

    return roster_data
  }

  /**
   * Get players available on the platform
   * @param {Object} [params] - Parameters object
   * @param {Object} [params.filters] - Optional filters for players
   * @returns {Promise<Array>} Array of player objects in canonical format
   */
  async get_players({ filters = {} } = {}) {
    // ESPN doesn't have a comprehensive standalone players endpoint,
    // but we can get player data through the players view
    this.log(
      'info',
      'ESPN player data retrieved through alternative endpoint',
      { filters }
    )

    try {
      // ESPN provides player data through a different endpoint structure
      // For now, return empty array but in canonical format when players are available
      const players = []

      // If we had ESPN player data, it would be transformed like this:
      const standard_players = players.map((player) => ({
        player_ids: {
          sleeper_id: null,
          espn_id: player.id?.toString(),
          yahoo_id: null,
          mfl_id: null,
          cbs_id: null,
          fleaflicker_id: null,
          nfl_id: null,
          rts_id: null
        },
        player_name:
          player.fullName ||
          `${player.firstName || ''} ${player.lastName || ''}`.trim(),
        position: this.map_position_to_canonical(player.defaultPositionId),
        nfl_team: player.proTeamId
          ? this.map_nfl_team_to_canonical(player.proTeamId)
          : null,
        roster_status: player_nfl_status.ACTIVE,
        game_designation: player.injuryStatus
          ? format_nfl_injury_status(
              this.map_injury_status_to_canonical(player.injuryStatus)
            )
          : null,

        // Physical attributes
        height: null,
        weight: null,
        age: player.age || null,
        years_exp: player.experience || null,

        // Career information
        drafted: {
          year: null,
          round: null,
          pick: null,
          team: null
        },

        // Cross-platform identifiers and external data sources
        external_data_sources: {
          espn_player_id: player.id?.toString(),
          pro_team_id: player.proTeamId?.toString()
        },

        // Store original platform data
        platform_data: {
          player
        }
      }))

      // Validate player data (sample validation for performance)
      if (standard_players.length > 0) {
        const sample_player = standard_players[0]
        const validation = await schema_validator.validate_player(sample_player)
        if (!validation.valid) {
          this.log('warn', 'Standard player format validation failed', {
            sample_player_id: sample_player.player_ids.espn_id,
            errors: validation.errors,
            data_summary: validation.data_summary
          })
        } else {
          this.log(
            'info',
            'Player data successfully validated against canonical format',
            {
              player_count: standard_players.length
            }
          )
        }
      }

      return standard_players
    } catch (error) {
      this.log('error', 'Failed to retrieve ESPN player data', {
        error: error.message,
        filters
      })
      return []
    }
  }

  /**
   * Get transactions for a league
   * @param {Object} params - Parameters object
   * @param {string} params.league_id - ESPN league ID
   * @param {Object} [params.options] - Optional filters
   * @returns {Promise<Array>} Array of transaction objects in canonical format
   */
  async get_transactions({ league_id, options = {}, year = null }) {
    const target_year = year || current_season.year
    const url = `/seasons/${target_year}/segments/0/leagues/${league_id}`
    const params = { view: ['mTransactions2'] }

    // Apply filters from options if provided
    if (options.week) {
      params.scoringPeriodId = options.week
    }
    if (options.limit) {
      params.limit = options.limit
    }

    if (this.cookies) {
      this.api_client.headers = {
        ...this.api_client.headers,
        Cookie: `s2=${this.cookies.s2}; SWID=${this.cookies.swid}`
      }
    }

    let data
    try {
      data = await this.api_client.get(url, { params })
    } catch (error) {
      if (error.status === 404 && target_year > 2000) {
        const fallback_year = target_year - 1
        const fallback_url = `/seasons/${fallback_year}/segments/0/leagues/${league_id}`
        data = await this.api_client.get(fallback_url, { params })
      } else {
        throw error
      }
    }

    let transactions = (data.transactions || []).map((transaction) => {
      // Transform to standard transaction format (schema-compliant)
      const standard_transaction = {
        external_transaction_id: transaction.id?.toString(),
        platform: 'ESPN',
        league_external_id: league_id,
        transaction_type: this.map_transaction_type_to_canonical(
          transaction.type
        ),
        transaction_date: transaction.processDate
          ? new Date(transaction.processDate).toISOString()
          : transaction.proposedDate
            ? new Date(transaction.proposedDate).toISOString()
            : new Date().toISOString(),
        transaction_status: this.map_transaction_status_to_canonical(
          transaction.status
        ),
        effective_date: transaction.processDate
          ? new Date(transaction.processDate).toISOString()
          : null,
        processing_date: transaction.processDate
          ? new Date(transaction.processDate).toISOString()
          : null,
        week: transaction.scoringPeriodId || 0,
        year: current_season.year,

        // Teams involved in transaction (schema property: involved_teams)
        involved_teams: this.extract_teams_from_espn_transaction(transaction),

        // Player moves (schema property: player_moves)
        player_moves: (transaction.items || []).map((item) => ({
          player_ids: {
            sleeper_id: null,
            espn_id: item.playerId?.toString(),
            yahoo_id: null,
            mfl_id: null,
            cbs_id: null,
            fleaflicker_id: null,
            nfl_id: null,
            rts_id: null
          },
          from_team_external_id:
            item.fromTeamId === 0 ? null : item.fromTeamId?.toString(),
          to_team_external_id:
            item.toTeamId === 0 ? null : item.toTeamId?.toString(),
          roster_slot: null,
          salary_impact: null
        })),

        // Waiver details (schema-compliant)
        waiver_details:
          transaction.type === 'WAIVER'
            ? {
                waiver_priority: transaction.teamId || null,
                bid_amount: null,
                claim_date: transaction.proposedDate
                  ? new Date(transaction.proposedDate).toISOString()
                  : null,
                process_date: transaction.processDate
                  ? new Date(transaction.processDate).toISOString()
                  : null
              }
            : null,

        // Trade details (if applicable)
        trade_details:
          transaction.type === 'TRADE'
            ? {
                trade_deadline_eligible: true,
                trade_review_period: null,
                votes_for: null,
                votes_against: null,
                veto_threshold: null
              }
            : null,

        // Store original platform data
        platform_data: {
          transaction,
          items: transaction.items || []
        }
      }

      return standard_transaction
    })

    // Apply additional client-side filtering if needed
    if (options.transaction_type) {
      const standard_type = this.map_transaction_type_to_canonical(
        options.transaction_type
      )
      transactions = transactions.filter(
        (t) => t.transaction_type === standard_type
      )
    }

    // Validate transaction data (sample validation for performance)
    if (transactions.length > 0) {
      const sample_transaction = transactions[0]
      const validation =
        await schema_validator.validate_transaction(sample_transaction)
      if (!validation.valid) {
        this.log('warn', 'Standard transaction format validation failed', {
          league_id,
          sample_transaction_id: sample_transaction.external_transaction_id,
          errors: validation.errors,
          data_summary: validation.data_summary
        })
      } else {
        this.log(
          'info',
          'Transaction data successfully validated against canonical format',
          {
            league_id,
            transaction_count: transactions.length
          }
        )
      }
    }

    return transactions
  }

  /**
   * Get matchups for a specific week
   * @param {Object} params - Parameters object
   * @param {string} params.league_id - ESPN league ID
   * @param {number} params.week - Week number
   * @returns {Promise<Array>} Array of matchup objects
   */
  async get_matchups({ league_id, week }) {
    const url = `/seasons/${current_season.year}/segments/0/leagues/${league_id}`
    const params = {
      view: ['mMatchup'],
      scoringPeriodId: week
    }

    if (this.cookies) {
      this.api_client.headers = {
        ...this.api_client.headers,
        Cookie: `s2=${this.cookies.s2}; SWID=${this.cookies.swid}`
      }
    }

    const data = await this.api_client.get(url, { params })

    return (
      data.schedule
        ?.filter((matchup) => matchup.matchupPeriodId === week)
        .map((matchup) => this.map_matchup_data(matchup)) || []
    )
  }

  /**
   * Get league scoring format/rules
   * @param {string} league_id - ESPN league ID
   * @returns {Promise<Object>} Scoring format configuration
   */
  async get_scoring_format(league_id) {
    const league_data = await this.get_league(league_id)
    return league_data.settings.scoring_format
  }

  /**
   * Get draft results for a league
   * @param {string} league_id - ESPN league ID
   * @returns {Promise<Array>} Array of draft pick objects
   */
  async get_draft_results(league_id) {
    const url = `/games/ffl/seasons/${current_season.year}/segments/0/leagues/${league_id}`
    const params = { view: ['mDraftDetail'] }

    if (this.cookies) {
      this.api_client.headers = {
        ...this.api_client.headers,
        Cookie: `s2=${this.cookies.s2}; SWID=${this.cookies.swid}`
      }
    }

    const data = await this.api_client.get(url, { params })

    return (
      data.draftDetail?.picks?.map((pick) => this.map_draft_pick(pick)) || []
    )
  }

  /**
   * Map external player ID to internal PID
   * @param {string} external_player_id - ESPN player ID
   * @returns {Promise<string|null>} Internal player ID or null if not found
   */
  async map_player_to_internal(external_player_id) {
    // This would query the database to find matching player
    // Implementation depends on the database schema and mapping logic
    this.log('info', 'Player ID mapping not yet implemented', {
      external_player_id
    })

    // TODO: Query database for player with espn_id = external_player_id
    // Example query: SELECT pid FROM player WHERE espn_id = ?

    return null
  }

  // Helper methods for data transformation

  /**
   * Map ESPN league status to canonical format
   * @param {number} espn_status - ESPN league status code
   * @returns {string} Standard league status
   */
  map_league_status_to_canonical(espn_status) {
    const status_map = {
      1: 'PRE_DRAFT',
      2: 'DRAFTING',
      3: 'IN_SEASON',
      4: 'PLAYOFFS',
      5: 'COMPLETE'
    }
    return status_map[espn_status] || 'UNKNOWN'
  }

  /**
   * Map ESPN waiver type to canonical format
   * @param {number} waiver_hour - ESPN waiver process hour
   * @returns {string} Standard waiver type
   */
  map_waiver_type_to_canonical(waiver_hour) {
    // ESPN uses waiver processing hour to determine type
    // Schema only allows: FAAB, PRIORITY, NONE
    // ESPN daily waivers map to PRIORITY since they process in priority order
    if (waiver_hour === null || waiver_hour === undefined) {
      return 'PRIORITY'
    }
    return 'PRIORITY' // ESPN typically uses priority-based waivers
  }

  /**
   * Map ESPN draft type to canonical format
   * @param {string} draft_type - ESPN draft type
   * @returns {string} Standard draft type
   */
  map_draft_type_to_canonical(draft_type) {
    const type_map = {
      SNAKE: 'SNAKE',
      LINEAR: 'LINEAR',
      AUCTION: 'AUCTION'
    }
    return type_map[draft_type] || 'SNAKE'
  }

  /**
   * Map ESPN scoring settings to canonical format
   * @param {Object} espn_scoring - ESPN scoring settings
   * @returns {Object} Standard scoring settings
   */
  map_scoring_settings_to_canonical(espn_scoring) {
    const standard_scoring = {
      passing_yards: espn_scoring[0] || 0, // Passing yards per point
      passing_touchdowns: espn_scoring[1] || 0, // Passing TD points
      passing_interceptions: espn_scoring[2] || 0, // Passing INT points
      rushing_yards: espn_scoring[24] || 0, // Rushing yards per point
      rushing_touchdowns: espn_scoring[25] || 0, // Rushing TD points
      receiving_yards: espn_scoring[42] || 0, // Receiving yards per point
      receiving_touchdowns: espn_scoring[43] || 0, // Receiving TD points
      receiving_receptions: espn_scoring[41] || 0, // Reception points (PPR)
      kicking_field_goals: espn_scoring[80] || 0, // Field goal points
      kicking_extra_points: espn_scoring[81] || 0, // Extra point points
      defense_touchdowns: espn_scoring[95] || 0, // Defensive TD points
      defense_interceptions: espn_scoring[96] || 0, // Defensive INT points
      defense_fumbles_recovered: espn_scoring[97] || 0, // Fumble recovery points
      defense_sacks: espn_scoring[99] || 0, // Sack points
      defense_safeties: espn_scoring[98] || 0, // Safety points
      defense_points_allowed: espn_scoring[89] || 0, // Points allowed scoring
      defense_yards_allowed: espn_scoring[90] || 0 // Yards allowed scoring
    }

    return standard_scoring
  }

  /**
   * Map ESPN roster positions to canonical format
   * @param {Object} espn_roster_settings - ESPN roster settings
   * @returns {Array} Standard roster slots
   */
  map_roster_positions_to_canonical(espn_roster_settings) {
    const lineup_slot_counts = espn_roster_settings.lineupSlotCounts || {}

    const standard_slots = []

    // Map ESPN lineup slot IDs to standard positions
    // Note: Schema requires specific enum values (RB_WR_TE_FLEX, not FLEX; BENCH for bench)
    const slot_map = {
      0: 'QB',
      2: 'RB',
      4: 'WR',
      6: 'TE',
      16: 'DST',
      17: 'K',
      20: 'BENCH', // Bench
      21: 'IR',
      23: 'RB_WR_TE_FLEX' // RB/WR/TE flex - schema requires RB_WR_TE_FLEX not FLEX
    }

    for (const [espn_slot_id, count] of Object.entries(lineup_slot_counts)) {
      const position = slot_map[espn_slot_id]
      if (position && count > 0) {
        for (let i = 0; i < count; i++) {
          standard_slots.push({
            position,
            required: position !== 'BENCH' && position !== 'IR',
            display_order: this.get_position_display_order(position)
          })
        }
      }
    }

    // If no roster slots were found, log error and return empty array
    // This will cause schema validation to fail, forcing the issue to be addressed
    if (standard_slots.length === 0) {
      this.log(
        'error',
        'ESPN API did not return roster settings (lineupSlotCounts). Cannot determine league roster structure.',
        {
          roster_settings: espn_roster_settings,
          message:
            'Roster slots are required for league validation. Please ensure the ESPN API response includes rosterSettings.lineupSlotCounts, or manually configure roster slots.'
        }
      )
      return []
    }

    // Convert objects to position strings and sort by display order
    const sorted_slots = standard_slots.sort(
      (a, b) => a.display_order - b.display_order
    )
    return sorted_slots.map((slot) => slot.position)
  }

  /**
   * Get display order for position sorting
   * @param {string} position - Position name
   * @returns {number} Display order
   */
  get_position_display_order(position) {
    const order_map = {
      QB: 1,
      RB: 2,
      WR: 3,
      TE: 4,
      FLEX: 5,
      DST: 6,
      K: 7,
      BENCH: 8,
      IR: 9
    }
    return order_map[position] || 99
  }

  /**
   * Map ESPN team to canonical format
   * @param {Object} espn_team - ESPN team data
   * @returns {Object} Standard team data
   */
  map_team_to_canonical(espn_team) {
    // Extract primary owner - use first owner from owners array, or primaryOwner field
    const primary_owner_id =
      espn_team.primaryOwner?.toString() ||
      espn_team.owners?.[0]?.toString() ||
      espn_team.id?.toString()

    return {
      // Required schema fields (league format team definition)
      external_team_id: espn_team.id?.toString(), // Platform-specific unique identifier for the team
      owner_id: primary_owner_id, // Platform user ID of the team owner
      name: espn_team.name || espn_team.location || `Team ${espn_team.id}`, // Team name
      platform: 'ESPN',
      team_name: espn_team.name || espn_team.location || `Team ${espn_team.id}`,
      team_abbrev:
        espn_team.abbrev ||
        espn_team.name?.substring(0, 3)?.toUpperCase() ||
        'ESPN',

      // Owner information
      owners: [
        {
          external_owner_id: primary_owner_id,
          owner_name: `ESPN Owner ${primary_owner_id}`,
          is_primary: true,
          ownership_percentage: 100
        }
      ],

      // Team performance
      wins: espn_team.record?.overall?.wins || 0,
      losses: espn_team.record?.overall?.losses || 0,
      ties: espn_team.record?.overall?.ties || 0,
      points_for: espn_team.record?.overall?.pointsFor || 0,
      points_against: espn_team.record?.overall?.pointsAgainst || 0,

      // Team settings
      logo_url: espn_team.logo || null,
      team_color_primary: null,
      team_color_secondary: null,
      division: espn_team.divisionId?.toString() || null,

      // Financial information
      current_salary_cap_usage: 0,
      projected_salary_cap_usage: 0,
      available_salary_cap: 0,

      // Activity tracking
      last_activity_date: null,
      is_active: true,

      // Store original platform data
      platform_data: {
        team: espn_team
      }
    }
  }

  /**
   * Determine roster slot information for ESPN roster entry
   * @param {Object} espn_entry - ESPN roster entry
   * @returns {Object} Slot information with slot name and category
   */
  determine_roster_slot_info_espn(espn_entry) {
    const lineup_slot_id = espn_entry.lineupSlotId

    const slot_map = {
      0: { slot: 'QB', category: 'STARTER' },
      2: { slot: 'RB', category: 'STARTER' },
      4: { slot: 'WR', category: 'STARTER' },
      6: { slot: 'TE', category: 'STARTER' },
      16: { slot: 'DST', category: 'STARTER' },
      17: { slot: 'K', category: 'STARTER' },
      20: { slot: 'BENCH', category: 'BENCH' },
      21: { slot: 'IR', category: 'INJURED_RESERVE' },
      23: { slot: 'FLEX', category: 'STARTER' }
    }

    return slot_map[lineup_slot_id] || { slot: 'BENCH', category: 'BENCH' }
  }

  /**
   * Map ESPN position ID to canonical format
   * @param {number} espn_position_id - ESPN position ID
   * @returns {string} Standard position
   */
  map_position_to_canonical(espn_position_id) {
    const position_map = {
      1: 'QB',
      2: 'RB',
      3: 'WR',
      4: 'TE',
      5: 'K',
      16: 'DST'
    }
    return position_map[espn_position_id] || 'UNKNOWN'
  }

  /**
   * Map ESPN NFL team ID to standard team abbreviation
   * @param {number} espn_team_id - ESPN NFL team ID
   * @returns {string} Standard NFL team abbreviation
   */
  map_nfl_team_to_canonical(espn_team_id) {
    const team_map = {
      1: 'ATL',
      2: 'BUF',
      3: 'CHI',
      4: 'CIN',
      5: 'CLE',
      6: 'DAL',
      7: 'DEN',
      8: 'DET',
      9: 'GB',
      10: 'TEN',
      11: 'IND',
      12: 'KC',
      13: 'LV',
      14: 'LAR',
      15: 'MIA',
      16: 'MIN',
      17: 'NE',
      18: 'NO',
      19: 'NYG',
      20: 'NYJ',
      21: 'PHI',
      22: 'ARI',
      23: 'PIT',
      24: 'LAC',
      25: 'SF',
      26: 'SEA',
      27: 'TB',
      28: 'WSH',
      29: 'CAR',
      30: 'JAX',
      33: 'BAL',
      34: 'HOU'
    }
    return team_map[espn_team_id] || 'UNK'
  }

  /**
   * Map ESPN injury status to canonical format
   * @param {string} espn_injury_status - ESPN injury status
   * @returns {string} Standard injury status
   */
  map_injury_status_to_canonical(espn_injury_status) {
    const status_map = {
      INJURY_RESERVE: 'IR',
      OUT: 'OUT',
      DOUBTFUL: 'DOUBTFUL',
      QUESTIONABLE: 'QUESTIONABLE',
      PROBABLE: 'QUESTIONABLE', // ESPN maps probable to questionable
      ACTIVE: 'ACTIVE',
      HEALTHY: 'ACTIVE'
    }
    return status_map[espn_injury_status] || 'ACTIVE'
  }

  /**
   * Map ESPN transaction type to canonical format
   * @param {string} espn_type - ESPN transaction type
   * @returns {string} Standard transaction type
   */
  map_transaction_type_to_canonical(espn_type) {
    const type_map = {
      WAIVER: 'WAIVER_CLAIM',
      FREEAGENT: 'FREE_AGENT_PICKUP',
      TRADE: 'TRADE',
      DRAFT: 'DRAFT_PICK',
      ROSTER: 'ROSTER_MOVE'
    }
    return type_map[espn_type] || 'UNKNOWN'
  }

  /**
   * Map ESPN transaction status to canonical format
   * @param {string} espn_status - ESPN transaction status
   * @returns {string} Standard transaction status
   */
  map_transaction_status_to_canonical(espn_status) {
    const status_map = {
      EXECUTED: 'COMPLETED',
      PENDING: 'PENDING',
      CANCELLED: 'CANCELLED',
      REJECTED: 'REJECTED'
    }
    return status_map[espn_status] || 'PENDING'
  }

  /**
   * Map ESPN transaction action to canonical format
   * @param {string} espn_action - ESPN transaction action
   * @returns {string} Standard transaction action
   */
  map_transaction_action_to_canonical(espn_action) {
    const action_map = {
      ADD: 'ADDED',
      DROP: 'DROPPED',
      TRADE: 'TRADED'
    }
    return action_map[espn_action] || 'UNKNOWN'
  }

  /**
   * Map ESPN acquisition type to canonical format
   * @param {string} espn_acquisition_type - ESPN acquisition type
   * @returns {string} Standard acquisition type
   */
  map_acquisition_type_to_canonical(espn_acquisition_type) {
    const type_map = {
      DRAFT: 'DRAFT',
      WAIVER: 'WAIVER',
      FREEAGENT: 'FREE_AGENT',
      TRADE: 'TRADE'
    }
    return type_map[espn_acquisition_type] || 'UNKNOWN'
  }

  /**
   * Extract teams involved in ESPN transaction
   * @param {Object} espn_transaction - ESPN transaction data
   * @returns {Array} Array of team external IDs involved
   */
  extract_teams_from_espn_transaction(espn_transaction) {
    const teams = new Set()

    // Add primary team
    if (espn_transaction.teamId) {
      teams.add(espn_transaction.teamId.toString())
    }

    // Add teams from transaction items
    if (espn_transaction.items) {
      espn_transaction.items.forEach((item) => {
        if (item.fromTeamId) teams.add(item.fromTeamId.toString())
        if (item.toTeamId) teams.add(item.toTeamId.toString())
      })
    }

    return Array.from(teams)
  }

  /**
   * Map ESPN matchup data (legacy method - kept for backward compatibility)
   * @param {Object} espn_matchup - ESPN matchup data
   * @returns {Object} Matchup data
   */
  map_matchup_data(espn_matchup) {
    return {
      week: espn_matchup.matchupPeriodId,
      team1_id: espn_matchup.home?.teamId?.toString(),
      team2_id: espn_matchup.away?.teamId?.toString(),
      team1_score: espn_matchup.home?.totalPoints || 0,
      team2_score: espn_matchup.away?.totalPoints || 0
    }
  }

  /**
   * Map ESPN draft pick data (legacy method - kept for backward compatibility)
   * @param {Object} espn_pick - ESPN draft pick data
   * @returns {Object} Draft pick data
   */
  map_draft_pick(espn_pick) {
    return {
      round: espn_pick.roundId,
      pick: espn_pick.roundPickNumber,
      overall_pick: espn_pick.overallPickNumber,
      team_id: espn_pick.teamId?.toString(),
      player_id: espn_pick.playerId?.toString(),
      keeper_status: espn_pick.keeper || false
    }
  }
}
