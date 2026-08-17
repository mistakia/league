import debug from 'debug'

const log = debug('external:league-config-mapper')

const SLEEPER_FIELD_GOAL_BAND_KEYS = [
  'fgm_0_19',
  'fgm_20_29',
  'fgm_30_39',
  'fgm_40_49',
  'fgm_50p'
]

const SLEEPER_POINTS_ALLOWED_KEYS = [
  'pts_allow_0',
  'pts_allow_1_6',
  'pts_allow_7_13',
  'pts_allow_14_20',
  'pts_allow_21_27',
  'pts_allow_28_34',
  'pts_allow_35p'
]

/**
 * League configuration mapper
 * Pure transform from external platform league settings (scoring, roster,
 * league rules) to internal format parameter objects. Identity assignment
 * (find-or-create -> opaque id) is performed by the caller via the
 * find_or_create_* helpers; this class does no DB I/O.
 */
export default class LeagueConfigMapper {
  constructor() {
    // Platform-specific scoring mappings
    this.scoring_mappings = {
      sleeper: {
        pass_yd: 'passing_yards',
        pass_td: 'passing_touchdowns',
        pass_int: 'passing_interceptions',
        pass_cmp: 'passing_completions',
        pass_att: 'passing_attempts',
        rush_yd: 'rushing_yards',
        rush_td: 'rushing_touchdowns',
        rush_att: 'rushing_attempts',
        rush_fd: 'rushing_first_downs',
        rec: 'receptions',
        rec_yd: 'receiving_yards',
        rec_td: 'receiving_touchdowns',
        rec_fd: 'receiving_first_downs',
        bonus_rec_rb: 'running_back_reception',
        bonus_rec_wr: 'wide_receiver_reception',
        bonus_rec_te: 'tight_end_reception',
        pass_2pt: 'two_point_conversions',
        rush_2pt: 'two_point_conversions',
        rec_2pt: 'two_point_conversions',
        fum_lost: 'fumbles_lost',
        def_pr_td: 'punt_return_touchdowns',
        def_kr_td: 'kickoff_return_touchdowns',
        rec_tgt: 'targets',

        // Kicking. Sleeper scores field goals by distance band, so mapping any
        // of these also zeroes field_goal_yards below -- our scoring is
        // additive (bands PLUS the per-yard term) and the registry default for
        // the rate is 0.1, which would otherwise double-score every kick.
        fgm_0_19: 'field_goals_made_0_19_yards',
        fgm_20_29: 'field_goals_made_20_29_yards',
        fgm_30_39: 'field_goals_made_30_39_yards',
        fgm_40_49: 'field_goals_made_40_49_yards',
        fgm_50p: 'field_goals_made_50_plus_yards',
        xpm: 'extra_points_made',

        // DST flat events. `int` is the DST interception; a passing
        // interception is `pass_int` above.
        sack: 'defensive_sacks',
        int: 'defensive_interceptions',
        ff: 'defensive_forced_fumbles',
        fum_rec: 'defensive_recovered_fumbles',
        def_td: 'defensive_touchdowns',
        safe: 'defensive_safeties',
        blk_kick: 'defensive_blocked_kicks'
      },
      espn: {
        passing_yards: 'passing_yards',
        passing_touchdowns: 'passing_touchdowns',
        passing_interceptions: 'passing_interceptions',
        passing_completions: 'passing_completions',
        passing_attempts: 'passing_attempts',
        rushing_yards: 'rushing_yards',
        rushing_touchdowns: 'rushing_touchdowns',
        rushing_attempts: 'rushing_attempts',
        rushing_first_downs: 'rushing_first_downs',
        receiving_receptions: 'receptions',
        receiving_yards: 'receiving_yards',
        receiving_touchdowns: 'receiving_touchdowns',
        receiving_first_downs: 'receiving_first_downs',
        receiving_targets: 'targets',
        '2_point_conversions': 'two_point_conversions',
        fumbles_lost: 'fumbles_lost',
        punt_return_touchdowns: 'punt_return_touchdowns',
        kickoff_return_touchdowns: 'kickoff_return_touchdowns'
      },
      yahoo: {
        PY: 'passing_yards',
        PTD: 'passing_touchdowns',
        INT: 'passing_interceptions',
        PC: 'passing_completions',
        PA: 'passing_attempts',
        RY: 'rushing_yards',
        RTD: 'rushing_touchdowns',
        RA: 'rushing_attempts',
        RFD: 'rushing_first_downs',
        REC: 'receptions',
        REY: 'receiving_yards',
        RETD: 'receiving_touchdowns',
        REFD: 'receiving_first_downs',
        TAR: 'targets',
        '2PC': 'two_point_conversions',
        FL: 'fumbles_lost',
        PRTD: 'punt_return_touchdowns',
        KRTD: 'kickoff_return_touchdowns'
      }
    }

    // Platform-specific roster position mappings
    this.roster_mappings = {
      sleeper: {
        QB: 'starter_slots_quarterback',
        RB: 'starter_slots_running_back',
        WR: 'starter_slots_wide_receiver',
        TE: 'starter_slots_tight_end',
        FLEX: 'starter_slots_running_back_wide_receiver_flex',
        REC_FLEX: 'starter_slots_wide_receiver_tight_end_flex',
        SUPER_FLEX: 'sqbrbwrte',
        WR_TE_FLEX: 'starter_slots_wide_receiver_tight_end_flex',
        DEF: 'starter_slots_defense_special_teams',
        K: 'starter_slots_kicker',
        BN: 'bench_slot_count', // Sleeper's raw format uses BN
        BENCH: 'bench_slot_count', // Canonical format uses BENCH
        IR: 'ir',
        TAXI: 'practice_squad_slot_count'
      },
      espn: {
        QB: 'starter_slots_quarterback',
        RB: 'starter_slots_running_back',
        'RB/WR': 'starter_slots_running_back_wide_receiver_flex',
        WR: 'starter_slots_wide_receiver',
        'WR/TE': 'starter_slots_wide_receiver_tight_end_flex',
        TE: 'starter_slots_tight_end',
        OP: 'sqbrbwrte',
        'D/ST': 'starter_slots_defense_special_teams',
        K: 'starter_slots_kicker',
        BE: 'bench_slot_count',
        IR: 'ir'
      },
      yahoo: {
        QB: 'starter_slots_quarterback',
        WR: 'starter_slots_wide_receiver',
        RB: 'starter_slots_running_back',
        TE: 'starter_slots_tight_end',
        'W/R': 'starter_slots_running_back_wide_receiver_flex',
        'W/T': 'starter_slots_wide_receiver_tight_end_flex',
        'W/R/T': 'srbwrte',
        'Q/W/R/T': 'sqbrbwrte',
        DEF: 'starter_slots_defense_special_teams',
        K: 'starter_slots_kicker',
        BN: 'bench_slot_count',
        IR: 'ir'
      }
    }
  }

  /**
   * Map external platform league configuration to internal format hashes
   * @param {Object} params - Parameters object
   * @param {string} params.platform - Platform identifier (sleeper, espn, yahoo)
   * @param {Object} params.league_config - External league configuration (number_teams, salary_cap, etc.)
   * @param {Object} params.scoring_config - External scoring configuration (points per stat)
   * @param {Object} params.roster_config - External roster configuration (position counts)
   * @returns {Object} Object containing:
   *   - scoring_params: Mapped scoring parameters (config-tuple fields)
   *   - league_params: Mapped league parameters (roster + cap fields)
   */
  map_league_config({
    platform,
    league_config,
    scoring_config,
    roster_config
  }) {
    try {
      const scoring_params = this.map_scoring_config({
        platform,
        scoring_config
      })

      const league_params = this.map_roster_config({
        platform,
        roster_config,
        league_config
      })

      log(`Mapped ${platform} league config`)

      return { scoring_params, league_params }
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
        if (
          ['passing_yards', 'rushing_yards', 'receiving_yards'].includes(
            internal_key
          ) &&
          value < 1
        ) {
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
    if (league_config.number_teams) {
      league_params.number_teams = league_config.number_teams
    } else if (league_config.total_rosters) {
      league_params.number_teams = league_config.total_rosters
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
      league_params.salary_cap = league_config.salary_cap
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
          scoring_params.is_excluding_quarterback_kneels = true
        }

        // Field goal scoring here is additive: the five distance bands PLUS a
        // per-yard rate. Sleeper is purely banded, so a league that scores any
        // band must score nothing per yard -- left absent, find-or-create fills
        // field_goal_yards from the registry default of 0.1 and every field
        // goal is scored twice.
        if (SLEEPER_FIELD_GOAL_BAND_KEYS.some((key) => key in scoring_config)) {
          scoring_params.field_goal_yards = 0
        }

        // Sleeper scores points and yards allowed as a step function over
        // seven bands (pts_allow_0, pts_allow_1_6, ... pts_allow_35p). Our
        // schema holds a rate applied per unit BEYOND a threshold, which cannot
        // represent a step function -- there is no pair of numbers that
        // reproduces those bands. Zero the rate rather than let the registry
        // default (-0.4 per point beyond 20) stand: that default is OUR
        // scoring, not theirs, and inventing it silently is worse than
        // dropping a component the import cannot carry.
        if (SLEEPER_POINTS_ALLOWED_KEYS.some((key) => key in scoring_config)) {
          scoring_params.defensive_points_against = 0
          log(
            'sleeper league scores points allowed in bands, which the rate/threshold config cannot represent; points against scoring dropped'
          )
        }
        break

      case 'espn':
        // ESPN might use different reception scoring by position
        if (scoring_config.receiving_receptions_rb !== undefined) {
          scoring_params.running_back_reception =
            scoring_config.receiving_receptions_rb - scoring_params.receptions
        }
        if (scoring_config.receiving_receptions_wr !== undefined) {
          scoring_params.wide_receiver_reception =
            scoring_config.receiving_receptions_wr - scoring_params.receptions
        }
        if (scoring_config.receiving_receptions_te !== undefined) {
          scoring_params.tight_end_reception =
            scoring_config.receiving_receptions_te - scoring_params.receptions
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
      passing_attempts: 0,
      passing_completions: 0,
      passing_yards: 0,
      passing_interceptions: 0,
      passing_touchdowns: 0,
      rushing_attempts: 0,
      rushing_yards: 0,
      rushing_touchdowns: 0,
      rushing_first_downs: 0,
      receptions: 0,
      running_back_reception: 0,
      wide_receiver_reception: 0,
      tight_end_reception: 0,
      receiving_yards: 0,
      receiving_first_downs: 0,
      two_point_conversions: 0,
      receiving_touchdowns: 0,
      fumbles_lost: 0,
      punt_return_touchdowns: 0,
      kickoff_return_touchdowns: 0,
      // 0, matching every sibling. This was 6, which silently gave every
      // imported league six points per fumble return touchdown whether or not
      // the platform scored them -- and no platform map has a source key for
      // it, so the default was the only value it could ever take. A default
      // here means "the platform did not tell us", and the honest reading of
      // that is not-scored.
      fumble_return_touchdowns: 0,
      targets: 0,
      is_excluding_quarterback_kneels: false

      // The 21 kicking and DST columns are deliberately ABSENT rather than
      // listed at 0. find-or-create fills an absent key from the registry
      // default, so an imported league that carries no kicking or DST scoring
      // gets the standard values instead of a format that scores them at
      // nothing. Anything the platform DOES specify is mapped above and
      // overrides the default.
    }
  }

  /**
   * Get default league parameters
   * @returns {Object} Default league parameters
   */
  get_default_league_params() {
    return {
      number_teams: 12,
      starter_slots_quarterback: 0,
      starter_slots_running_back: 0,
      starter_slots_wide_receiver: 0,
      starter_slots_tight_end: 0,
      starter_slots_running_back_wide_receiver_flex: 0,
      srbwrte: 0,
      sqbrbwrte: 0,
      starter_slots_wide_receiver_tight_end_flex: 0,
      starter_slots_defense_special_teams: 0,
      starter_slots_kicker: 0,
      bench_slot_count: 0,
      practice_squad_slot_count: 0,
      ir: 0,
      reserve_short_term_limit: 0,
      salary_cap: 0,
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
  validate_mapped_config({ league_params, scoring_params }) {
    if (!scoring_params) {
      log('Invalid scoring params: missing')
      return false
    }
    if (!league_params) {
      log('Invalid league params: missing')
      return false
    }

    const total_starters =
      league_params.starter_slots_quarterback +
      league_params.starter_slots_running_back +
      league_params.starter_slots_wide_receiver +
      league_params.starter_slots_tight_end +
      league_params.starter_slots_running_back_wide_receiver_flex +
      league_params.srbwrte +
      league_params.sqbrbwrte +
      league_params.starter_slots_wide_receiver_tight_end_flex +
      league_params.starter_slots_defense_special_teams +
      league_params.starter_slots_kicker

    if (total_starters === 0) {
      log('Invalid league params: no starting roster positions')
      return false
    }

    return true
  }
}
