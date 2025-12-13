import debug from 'debug'

import {
  generate_league_format_hash,
  generate_scoring_format_hash
} from '#libs-shared'

const log = debug('external:league-config-mapper')

/**
 * League configuration mapper
 * Maps external platform league settings (scoring, roster, league rules) to internal format hashes
 * Generates league_format_hash and scoring_format_hash for league matching and compatibility
 */
export default class LeagueConfigMapper {
  constructor() {
    // Platform-specific scoring mappings
    this.scoring_mappings = {
      sleeper: {
        pass_yd: 'py',
        pass_td: 'tdp',
        pass_int: 'ints',
        pass_cmp: 'pc',
        pass_att: 'pa',
        rush_yd: 'ry',
        rush_td: 'tdr',
        rush_att: 'ra',
        rush_fd: 'rush_first_down',
        rec: 'rec',
        rec_yd: 'recy',
        rec_td: 'tdrec',
        rec_fd: 'rec_first_down',
        bonus_rec_rb: 'rbrec',
        bonus_rec_wr: 'wrrec',
        bonus_rec_te: 'terec',
        pass_2pt: 'twoptc',
        rush_2pt: 'twoptc',
        rec_2pt: 'twoptc',
        fum_lost: 'fuml',
        def_pr_td: 'prtd',
        def_kr_td: 'krtd',
        rec_tgt: 'trg'
      },
      espn: {
        passing_yards: 'py',
        passing_touchdowns: 'tdp',
        passing_interceptions: 'ints',
        passing_completions: 'pc',
        passing_attempts: 'pa',
        rushing_yards: 'ry',
        rushing_touchdowns: 'tdr',
        rushing_attempts: 'ra',
        rushing_first_downs: 'rush_first_down',
        receiving_receptions: 'rec',
        receiving_yards: 'recy',
        receiving_touchdowns: 'tdrec',
        receiving_first_downs: 'rec_first_down',
        receiving_targets: 'trg',
        '2_point_conversions': 'twoptc',
        fumbles_lost: 'fuml',
        punt_return_touchdowns: 'prtd',
        kickoff_return_touchdowns: 'krtd'
      },
      yahoo: {
        PY: 'py',
        PTD: 'tdp',
        INT: 'ints',
        PC: 'pc',
        PA: 'pa',
        RY: 'ry',
        RTD: 'tdr',
        RA: 'ra',
        RFD: 'rush_first_down',
        REC: 'rec',
        REY: 'recy',
        RETD: 'tdrec',
        REFD: 'rec_first_down',
        TAR: 'trg',
        '2PC': 'twoptc',
        FL: 'fuml',
        PRTD: 'prtd',
        KRTD: 'krtd'
      }
    }

    // Platform-specific roster position mappings
    this.roster_mappings = {
      sleeper: {
        QB: 'sqb',
        RB: 'srb',
        WR: 'swr',
        TE: 'ste',
        FLEX: 'srbwr',
        REC_FLEX: 'swrte',
        SUPER_FLEX: 'sqbrbwrte',
        WR_TE_FLEX: 'swrte',
        DEF: 'sdst',
        K: 'sk',
        BN: 'bench', // Sleeper's raw format uses BN
        BENCH: 'bench', // Canonical format uses BENCH
        IR: 'ir',
        TAXI: 'ps'
      },
      espn: {
        QB: 'sqb',
        RB: 'srb',
        'RB/WR': 'srbwr',
        WR: 'swr',
        'WR/TE': 'swrte',
        TE: 'ste',
        OP: 'sqbrbwrte',
        'D/ST': 'sdst',
        K: 'sk',
        BE: 'bench',
        IR: 'ir'
      },
      yahoo: {
        QB: 'sqb',
        WR: 'swr',
        RB: 'srb',
        TE: 'ste',
        'W/R': 'srbwr',
        'W/T': 'swrte',
        'W/R/T': 'srbwrte',
        'Q/W/R/T': 'sqbrbwrte',
        DEF: 'sdst',
        K: 'sk',
        BN: 'bench',
        IR: 'ir'
      }
    }
  }

  /**
   * Map external platform league configuration to internal format hashes
   * @param {Object} params - Parameters object
   * @param {string} params.platform - Platform identifier (sleeper, espn, yahoo)
   * @param {Object} params.league_config - External league configuration (num_teams, salary_cap, etc.)
   * @param {Object} params.scoring_config - External scoring configuration (points per stat)
   * @param {Object} params.roster_config - External roster configuration (position counts)
   * @returns {Object} Object containing:
   *   - league_format: Full league format object with hash
   *   - scoring_format: Full scoring format object with hash
   *   - league_format_hash: Hash string for league format matching
   *   - scoring_format_hash: Hash string for scoring format matching
   */
  map_league_config({
    platform,
    league_config,
    scoring_config,
    roster_config
  }) {
    try {
      // Map scoring settings
      const scoring_params = this.map_scoring_config({
        platform,
        scoring_config
      })
      const scoring_format = generate_scoring_format_hash(scoring_params)

      // Map roster and league settings
      const league_params = this.map_roster_config({
        platform,
        roster_config,
        league_config
      })

      // Add scoring format hash to league params
      league_params.scoring_format_hash = scoring_format.scoring_format_hash

      // Generate league format hash
      const league_format = generate_league_format_hash(league_params)

      log(`Mapped ${platform} league config to format hashes`, {
        scoring_format_hash: scoring_format.scoring_format_hash,
        league_format_hash: league_format.league_format_hash
      })

      return {
        league_format,
        scoring_format,
        league_format_hash: league_format.league_format_hash,
        scoring_format_hash: scoring_format.scoring_format_hash
      }
    } catch (error) {
      log(`Error mapping league config for ${platform}: ${error.message}`)
      throw error
    }
  }

  /**
   * Map external scoring configuration to internal scoring parameters
   * @param {Object} params - Parameters object
   * @param {string} params.platform - Platform identifier
   * @param {Object} params.scoring_config - External scoring configuration
   * @returns {Object} Internal scoring parameters
   */
  map_scoring_config({ platform, scoring_config }) {
    const scoring_map = this.scoring_mappings[platform.toLowerCase()]
    if (!scoring_map) {
      throw new Error(`Unsupported platform: ${platform}`)
    }

    const scoring_params = this.get_default_scoring_params()

    // Map external scoring keys to internal parameters
    for (const [external_key, internal_key] of Object.entries(scoring_map)) {
      if (
        scoring_config[external_key] !== undefined &&
        scoring_config[external_key] !== null
      ) {
        // Handle special cases for decimal scoring values
        let value = scoring_config[external_key]

        // Convert points per yard values (usually decimal like 0.04 for 1 point per 25 yards)
        if (['py', 'ry', 'recy'].includes(internal_key) && value < 1) {
          value = Math.round(value * 100) // Convert 0.04 to 4 (1 point per 25 yards)
        }

        scoring_params[internal_key] = value
      }
    }

    // Handle platform-specific special cases
    this.apply_platform_scoring_rules({
      platform,
      scoring_config,
      scoring_params
    })

    return scoring_params
  }

  /**
   * Map external roster configuration to internal league parameters
   * @param {Object} params - Parameters object
   * @param {string} params.platform - Platform identifier
   * @param {Object} params.roster_config - External roster configuration
   * @param {Object} params.league_config - External league configuration
   * @returns {Object} Internal league parameters
   */
  map_roster_config({ platform, roster_config, league_config }) {
    const roster_map = this.roster_mappings[platform.toLowerCase()]
    if (!roster_map) {
      throw new Error(`Unsupported platform: ${platform}`)
    }

    const league_params = this.get_default_league_params()

    // Set number of teams from league config
    if (league_config.num_teams) {
      league_params.num_teams = league_config.num_teams
    } else if (league_config.total_rosters) {
      league_params.num_teams = league_config.total_rosters
    }

    // Map roster positions
    if (Array.isArray(roster_config)) {
      // Handle array format (e.g., Sleeper)
      for (const position of roster_config) {
        const internal_position = roster_map[position]
        if (
          internal_position &&
          league_params[internal_position] !== undefined
        ) {
          league_params[internal_position]++
        }
      }
    } else if (typeof roster_config === 'object') {
      // Handle object format (e.g., ESPN)
      for (const [external_pos, count] of Object.entries(roster_config)) {
        const internal_position = roster_map[external_pos]
        if (
          internal_position &&
          league_params[internal_position] !== undefined
        ) {
          league_params[internal_position] = count
        }
      }
    }

    // Set salary cap if available
    if (league_config.salary_cap) {
      league_params.cap = league_config.salary_cap
    }

    // Set minimum bid if available
    if (league_config.min_bid !== undefined) {
      league_params.min_bid = league_config.min_bid
    }

    return league_params
  }

  /**
   * Apply platform-specific scoring rules and adjustments
   * @param {Object} params - Parameters object
   * @param {string} params.platform - Platform identifier
   * @param {Object} params.scoring_config - External scoring configuration
   * @param {Object} params.scoring_params - Internal scoring parameters to modify
   * @private
   */
  apply_platform_scoring_rules({ platform, scoring_config, scoring_params }) {
    switch (platform.toLowerCase()) {
      case 'sleeper':
        // Sleeper might have QB kneel exclusion setting
        if (scoring_config.exclude_qb_kneels) {
          scoring_params.exclude_qb_kneels = true
        }
        break

      case 'espn':
        // ESPN might use different reception scoring by position
        if (scoring_config.receiving_receptions_rb !== undefined) {
          scoring_params.rbrec =
            scoring_config.receiving_receptions_rb - scoring_params.rec
        }
        if (scoring_config.receiving_receptions_wr !== undefined) {
          scoring_params.wrrec =
            scoring_config.receiving_receptions_wr - scoring_params.rec
        }
        if (scoring_config.receiving_receptions_te !== undefined) {
          scoring_params.terec =
            scoring_config.receiving_receptions_te - scoring_params.rec
        }
        break

      case 'yahoo':
        // Yahoo-specific adjustments
        // Yahoo might have bonus reception points built into the main reception value
        break

      default:
        log(`No special scoring rules for platform: ${platform}`)
    }
  }

  /**
   * Get default scoring parameters
   * @returns {Object} Default scoring parameters
   */
  get_default_scoring_params() {
    return {
      pa: 0,
      pc: 0,
      py: 0,
      ints: 0,
      tdp: 0,
      ra: 0,
      ry: 0,
      tdr: 0,
      rush_first_down: 0,
      rec: 0,
      rbrec: 0,
      wrrec: 0,
      terec: 0,
      recy: 0,
      rec_first_down: 0,
      twoptc: 0,
      tdrec: 0,
      fuml: 0,
      prtd: 0,
      krtd: 0,
      trg: 0,
      exclude_qb_kneels: false
    }
  }

  /**
   * Get default league parameters
   * @returns {Object} Default league parameters
   */
  get_default_league_params() {
    return {
      num_teams: 12,
      sqb: 0,
      srb: 0,
      swr: 0,
      ste: 0,
      srbwr: 0,
      srbwrte: 0,
      sqbrbwrte: 0,
      swrte: 0,
      sdst: 0,
      sk: 0,
      bench: 0,
      ps: 0,
      ir: 0,
      cap: 0,
      min_bid: 0
    }
  }

  /**
   * Validate mapped configuration
   * @param {Object} params - Parameters object
   * @param {Object} params.league_format - Mapped league format
   * @param {Object} params.scoring_format - Mapped scoring format
   * @returns {boolean} True if valid
   */
  validate_mapped_config({ league_format, scoring_format }) {
    // Validate scoring format has required fields
    if (!scoring_format || !scoring_format.scoring_format_hash) {
      log('Invalid scoring format: missing hash')
      return false
    }

    // Validate league format has required fields
    if (!league_format || !league_format.league_format_hash) {
      log('Invalid league format: missing hash')
      return false
    }

    // Validate roster has at least some starters
    const total_starters =
      league_format.sqb +
      league_format.srb +
      league_format.swr +
      league_format.ste +
      league_format.srbwr +
      league_format.srbwrte +
      league_format.sqbrbwrte +
      league_format.swrte +
      league_format.sdst +
      league_format.sk

    if (total_starters === 0) {
      log('Invalid league format: no starting roster positions')
      return false
    }

    return true
  }
}
